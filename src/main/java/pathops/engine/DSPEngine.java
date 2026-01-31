package pathops.engine;

import java.util.*;

/**
 * Dynamic Shortest Path Engine (DSP-E).
 * Maintains near-instant shortest path answers under continuous edge updates
 * using incremental Dijkstra with lazy re-optimization.
 * <ul>
 *   <li>Case A (edge add / weight decrease): localized re-Dijkstra; batch pending updates.</li>
 *   <li>Case B (edge remove / weight increase): lazy dirty set; limited recompute from boundary.</li>
 *   <li>Target pruning: stop Dijkstra once target is settled.</li>
 *   <li>Bidirectional Dijkstra: optional s-t query from both ends.</li>
 * </ul>
 */
public final class DSPEngine {

    private static final double INF = Double.POSITIVE_INFINITY;

    private final Graph graph;
    private final int n;

    // --- Versioning ---
    private long graphVersion = 0;
    private int currentSource = -1;
    private long lastComputedVersion = -1;

    // --- Per-source state ---
    private final double[] dist;
    private final int[] parent;
    private final PriorityQueue<HeapEntry> heap;

    // --- Batch Case A: pending (from, to, weight) to apply in one incremental run ---
    private final List<CaseAPending> pendingCaseA = new ArrayList<>();

    // --- Lazy Case B: nodes whose distance might have increased (head of removed/increased edge + SPT descendants) ---
    private final Set<Integer> dirtyNodes = new HashSet<>();

    // --- Pruning ---
    private double distanceThreshold = INF;

    private static final class CaseAPending {
        final int from, to;
        final double weight;
        CaseAPending(int from, int to, double weight) { this.from = from; this.to = to; this.weight = weight; }
    }

    public DSPEngine(Graph graph) {
        this.graph = graph;
        this.n = graph.getMaxNodes();
        this.dist = new double[n];
        this.parent = new int[n];
        this.heap = new PriorityQueue<>(Comparator.comparingDouble(e -> e.dist));
    }

    /**
     * Sets the source for subsequent shortest-path queries.
     * Next query will use this source (with incremental update if possible).
     */
    public void setSource(int source) {
        if (source < 0 || source >= n)
            throw new IllegalArgumentException("Source out of range: " + source);
        if (currentSource != source) {
            currentSource = source;
            lastComputedVersion = -1;
            pendingCaseA.clear();
            dirtyNodes.clear();
        }
    }

    public int getCurrentSource() { return currentSource; }

    /**
     * Optional: set a distance cap. Nodes with distance &gt; threshold are not expanded (pruning).
     */
    public void setDistanceThreshold(double threshold) {
        this.distanceThreshold = threshold >= 0 ? threshold : INF;
    }

    /**
     * Ensures distances from current source are up to date.
     * Order: dirty set (Case B) → batch Case A flush + incremental → full Dijkstra.
     */
    private void ensureComputed() {
        if (currentSource < 0)
            throw new IllegalStateException("No source set");
        if (lastComputedVersion == graphVersion)
            return;
        if (!dirtyNodes.isEmpty()) {
            if (lastComputedVersion >= 0) {
                runDirtyRecompute();
            } else {
                runFullDijkstra(-1);
            }
            dirtyNodes.clear();
            pendingCaseA.clear();
            lastComputedVersion = graphVersion;
            return;
        }
        if (!pendingCaseA.isEmpty() && lastComputedVersion >= 0) {
            flushPendingCaseA();
            runIncrementalDijkstra(-1);
            pendingCaseA.clear();
            lastComputedVersion = graphVersion;
            return;
        }
        runFullDijkstra(-1);
        lastComputedVersion = graphVersion;
    }

    /**
     * Ensures distance to {@code target} is computed; may stop early once target is settled (target pruning).
     */
    private void ensureComputedUntil(int target) {
        if (currentSource < 0)
            throw new IllegalStateException("No source set");
        if (lastComputedVersion == graphVersion)
            return;
        if (!dirtyNodes.isEmpty()) {
            if (lastComputedVersion >= 0) {
                runDirtyRecompute();
            } else {
                runFullDijkstra(target);
            }
            dirtyNodes.clear();
            pendingCaseA.clear();
            lastComputedVersion = graphVersion;
            return;
        }
        if (!pendingCaseA.isEmpty() && lastComputedVersion >= 0) {
            flushPendingCaseA();
            runIncrementalDijkstra(target);
            pendingCaseA.clear();
            lastComputedVersion = graphVersion;
            return;
        }
        runFullDijkstra(target);
        if (target < 0) lastComputedVersion = graphVersion;
    }

    /** Lazy Case B: recompute only dirty nodes; seed heap with source and boundary (non-dirty nodes with edge into dirty). */
    private void runDirtyRecompute() {
        for (int d : dirtyNodes) {
            dist[d] = INF;
            parent[d] = -1;
        }
        dist[currentSource] = 0;
        parent[currentSource] = currentSource;
        heap.clear();
        heap.add(new HeapEntry(currentSource, 0));
        for (int v = 0; v < n; v++) {
            if (dirtyNodes.contains(v)) continue;
            for (Edge e : graph.getOutEdges(v)) {
                int u = e.getTo();
                if (dirtyNodes.contains(u))
                    heap.add(new HeapEntry(v, dist[v]));
            }
        }
        runDijkstraLoop(-1);
    }

    /** Single Dijkstra loop from current heap state (used by full, incremental, dirty). */
    private void runDijkstraLoop(int stopTarget) {
        while (!heap.isEmpty()) {
            HeapEntry e = heap.poll();
            int u = e.node;
            double d = e.dist;
            if (d > dist[u]) continue;
            if (d > distanceThreshold) continue;
            if (stopTarget >= 0 && u == stopTarget) break;
            for (Edge edge : graph.getOutEdges(u)) {
                int v = edge.getTo();
                double w = edge.getWeight();
                double newDist = d + w;
                if (newDist >= dist[v]) continue;
                if (newDist > distanceThreshold) continue;
                dist[v] = newDist;
                parent[v] = u;
                heap.add(new HeapEntry(v, newDist));
            }
        }
    }

    /** Batch Case A: push all improved (to, dist[from]+weight) into heap, then incremental run. */
    private void flushPendingCaseA() {
        for (CaseAPending p : pendingCaseA) {
            double dFrom = dist[p.from];
            if (dFrom == INF) continue;
            double newDistTo = dFrom + p.weight;
            if (newDistTo >= dist[p.to]) continue;
            dist[p.to] = newDistTo;
            parent[p.to] = p.from;
            heap.add(new HeapEntry(p.to, newDistTo));
        }
    }

    /** Collect node and all its descendants in the current SPT (nodes w with parent chain through node). */
    private void addDirtyWithDescendants(int node) {
        dirtyNodes.add(node);
        if (lastComputedVersion != graphVersion - 1) return;
        Deque<Integer> q = new ArrayDeque<>();
        q.add(node);
        while (!q.isEmpty()) {
            int u = q.poll();
            for (int w = 0; w < n; w++) {
                if (parent[w] == u && dirtyNodes.add(w))
                    q.add(w);
            }
        }
    }

    /**
     * Full Dijkstra from current source; optionally stop at stopTarget (target pruning).
     */
    private void runFullDijkstra(int stopTarget) {
        Arrays.fill(dist, INF);
        Arrays.fill(parent, -1);
        dist[currentSource] = 0;
        parent[currentSource] = currentSource;
        heap.clear();
        heap.add(new HeapEntry(currentSource, 0));
        runDijkstraLoop(stopTarget);
    }

    /**
     * Continues Dijkstra from current heap (heap reuse); lazy stale check.
     */
    private void runIncrementalDijkstra(int stopTarget) {
        runDijkstraLoop(stopTarget);
    }

    /** Batch Case A: record (from, to, weight); flush on next ensureComputed. */
    public void notifyEdgeAdded(int from, int to, double weight) {
        graphVersion++;
        pendingCaseA.add(new CaseAPending(from, to, weight));
    }

    /** Lazy Case B: mark head and SPT-descendants dirty; limited recompute on next query. */
    public void notifyEdgeRemoved(int from, int to) {
        graphVersion++;
        addDirtyWithDescendants(to);
    }

    public void notifyEdgeWeightChanged(int from, int to, double oldWeight, double newWeight) {
        graphVersion++;
        if (newWeight < oldWeight)
            pendingCaseA.add(new CaseAPending(from, to, newWeight));
        else
            addDirtyWithDescendants(to);
    }

    /**
     * Shortest path from current source to target. Uses cached state with incremental/dirty logic.
     * Uses target pruning: stops Dijkstra once target is settled when a full recompute is needed.
     */
    public PathResult getShortestPath(int target) {
        if (target < 0 || target >= n)
            throw new IllegalArgumentException("Target out of range: " + target);
        ensureComputedUntil(target);
        if (dist[target] == INF)
            return PathResult.unreachable();
        List<Integer> path = buildPath(target);
        return PathResult.of(dist[target], path);
    }

    public double getDistance(int target) {
        if (target < 0 || target >= n)
            throw new IllegalArgumentException("Target out of range: " + target);
        ensureComputed();
        return dist[target];
    }

    /**
     * Bidirectional Dijkstra: run from source and target, stop when frontiers meet.
     * Does not use or update single-source state; suitable for one-off s-t queries.
     */
    public PathResult getShortestPathBidirectional(int source, int target) {
        if (source < 0 || source >= n || target < 0 || target >= n)
            throw new IllegalArgumentException("Source or target out of range");
        if (source == target)
            return PathResult.of(0, List.of(source));

        double[] distF = new double[n];
        double[] distB = new double[n];
        int[] parentF = new int[n];
        int[] parentB = new int[n];
        Arrays.fill(distF, INF);
        Arrays.fill(distB, INF);
        Arrays.fill(parentF, -1);
        Arrays.fill(parentB, -1);
        distF[source] = 0;
        distB[target] = 0;
        parentF[source] = source;
        parentB[target] = target;

        PriorityQueue<HeapEntry> heapF = new PriorityQueue<>(Comparator.comparingDouble(e -> e.dist));
        PriorityQueue<HeapEntry> heapB = new PriorityQueue<>(Comparator.comparingDouble(e -> e.dist));
        heapF.add(new HeapEntry(source, 0));
        heapB.add(new HeapEntry(target, 0));

        double bestDist = INF;
        int meetingNode = -1;

        while (true) {
            double minF = heapF.isEmpty() ? INF : heapF.peek().dist;
            double minB = heapB.isEmpty() ? INF : heapB.peek().dist;
            if (minF + minB >= bestDist) break;

            if (minF <= minB) {
                if (heapF.isEmpty()) break;
                HeapEntry e = heapF.poll();
                int u = e.node;
                double d = e.dist;
                if (d > distF[u]) continue;
                if (d > distanceThreshold) continue;
                if (distB[u] < INF) {
                    double cand = distF[u] + distB[u];
                    if (cand < bestDist) { bestDist = cand; meetingNode = u; }
                }
                for (Edge edge : graph.getOutEdges(u)) {
                    int v = edge.getTo();
                    double w = edge.getWeight();
                    double newDist = d + w;
                    if (newDist >= distF[v] || newDist > distanceThreshold) continue;
                    distF[v] = newDist;
                    parentF[v] = u;
                    heapF.add(new HeapEntry(v, newDist));
                }
            } else {
                if (heapB.isEmpty()) break;
                HeapEntry e = heapB.poll();
                int u = e.node;
                double d = e.dist;
                if (d > distB[u]) continue;
                if (d > distanceThreshold) continue;
                if (distF[u] < INF) {
                    double cand = distF[u] + distB[u];
                    if (cand < bestDist) { bestDist = cand; meetingNode = u; }
                }
                for (Graph.InEdge in : graph.getInEdges(u)) {
                    int v = in.getFrom();
                    double w = in.getWeight();
                    double newDist = d + w;
                    if (newDist >= distB[v] || newDist > distanceThreshold) continue;
                    distB[v] = newDist;
                    parentB[v] = u;
                    heapB.add(new HeapEntry(v, newDist));
                }
            }
        }

        if (meetingNode < 0 || bestDist == INF)
            return PathResult.unreachable();
        List<Integer> path = new ArrayList<>();
        int v = meetingNode;
        while (v != source) {
            path.add(v);
            v = parentF[v];
        }
        path.add(source);
        Collections.reverse(path);
        v = parentB[meetingNode];
        while (v != target) {
            path.add(v);
            v = parentB[v];
        }
        path.add(target);
        return PathResult.of(bestDist, path);
    }

    private List<Integer> buildPath(int target) {
        List<Integer> path = new ArrayList<>();
        int v = target;
        while (v >= 0) {
            path.add(v);
            if (v == currentSource) break;
            v = parent[v];
        }
        Collections.reverse(path);
        return path;
    }

    /**
     * Add edge in graph and notify engine (for convenience).
     */
    public boolean addEdge(int from, int to, double weight) {
        boolean added = graph.addEdge(from, to, weight);
        if (added) notifyEdgeAdded(from, to, weight);
        return added;
    }

    /**
     * Remove edge in graph and notify engine.
     */
    public boolean removeEdge(int from, int to) {
        boolean removed = graph.removeEdge(from, to);
        if (removed) notifyEdgeRemoved(from, to);
        return removed;
    }

    /**
     * Set edge weight (add or update). Notifies engine.
     */
    public void setEdge(int from, int to, double weight) {
        double old = graph.setEdgeWeight(from, to, weight);
        if (old < 0)
            notifyEdgeAdded(from, to, weight);
        else
            notifyEdgeWeightChanged(from, to, old, weight);
    }

    public Graph getGraph() { return graph; }

    /**
     * Call after modifying the graph directly (without engine add/remove/set).
     * Forces recompute on next query (Case B style).
     */
    public void invalidate() {
        graphVersion++;
    }

    private static final class HeapEntry {
        final int node;
        final double dist;
        HeapEntry(int node, double dist) {
            this.node = node;
            this.dist = dist;
        }
    }
}
