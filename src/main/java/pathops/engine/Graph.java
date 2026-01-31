package pathops.engine;

import java.util.*;

/**
 * Weighted directed graph backed by adjacency lists.
 * Supports dynamic edge insertions and deletions.
 * Maintains reverse edges (inEdges) for bidirectional Dijkstra.
 */
public final class Graph {

    private final int maxNodes;
    private final List<List<Edge>> outEdges;  // outEdges.get(v) = edges from v
    private final List<List<InEdge>> inEdges; // inEdges.get(v) = edges into v (for reverse search)
    private int edgeCount;

    /** Reverse edge: (from, weight) meaning edge from 'from' into this node with weight. */
    public static final class InEdge {
        private final int from;
        private final double weight;
        public InEdge(int from, double weight) { this.from = from; this.weight = weight; }
        public int getFrom() { return from; }
        public double getWeight() { return weight; }
    }

    public Graph(int maxNodes) {
        if (maxNodes <= 0 || maxNodes > 100_000)
            throw new IllegalArgumentException("maxNodes must be in [1, 100_000]");
        this.maxNodes = maxNodes;
        this.outEdges = new ArrayList<>(maxNodes);
        this.inEdges = new ArrayList<>(maxNodes);
        for (int i = 0; i < maxNodes; i++) {
            outEdges.add(new ArrayList<>());
            inEdges.add(new ArrayList<>());
        }
        this.edgeCount = 0;
    }

    public int getMaxNodes() { return maxNodes; }
    public int getEdgeCount() { return edgeCount; }

    /** Returns true if the edge was added (no duplicate from→to). */
    public boolean addEdge(int from, int to, double weight) {
        checkNode(from);
        checkNode(to);
        List<Edge> list = outEdges.get(from);
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).getTo() == to) return false; // already exists
        }
        list.add(new Edge(from, to, weight));
        inEdges.get(to).add(new InEdge(from, weight));
        edgeCount++;
        return true;
    }

    /** Removes the first edge from→to. Returns true if one was removed. */
    public boolean removeEdge(int from, int to) {
        checkNode(from);
        checkNode(to);
        List<Edge> list = outEdges.get(from);
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).getTo() == to) {
                list.remove(i);
                removeInEdge(to, from);
                edgeCount--;
                return true;
            }
        }
        return false;
    }

    private void removeInEdge(int to, int from) {
        List<InEdge> in = inEdges.get(to);
        for (int i = 0; i < in.size(); i++) {
            if (in.get(i).getFrom() == from) {
                in.remove(i);
                return;
            }
        }
    }

    /** Updates weight of edge from→to; adds edge if absent. Returns previous weight or -1 if new. */
    public double setEdgeWeight(int from, int to, double newWeight) {
        checkNode(from);
        checkNode(to);
        List<Edge> list = outEdges.get(from);
        for (int i = 0; i < list.size(); i++) {
            Edge e = list.get(i);
            if (e.getTo() == to) {
                double old = e.getWeight();
                list.set(i, new Edge(from, to, newWeight));
                updateInEdge(to, from, newWeight);
                return old;
            }
        }
        list.add(new Edge(from, to, newWeight));
        inEdges.get(to).add(new InEdge(from, newWeight));
        edgeCount++;
        return -1;
    }

    private void updateInEdge(int to, int from, double newWeight) {
        List<InEdge> in = inEdges.get(to);
        for (int i = 0; i < in.size(); i++) {
            if (in.get(i).getFrom() == from) {
                in.set(i, new InEdge(from, newWeight));
                return;
            }
        }
    }

    /** Gets current weight of edge from→to, or -1 if no such edge. */
    public double getEdgeWeight(int from, int to) {
        checkNode(from);
        checkNode(to);
        for (Edge e : outEdges.get(from)) {
            if (e.getTo() == to) return e.getWeight();
        }
        return -1;
    }

    public List<Edge> getOutEdges(int node) {
        checkNode(node);
        return Collections.unmodifiableList(outEdges.get(node));
    }

    /** Incoming edges into node (for reverse / backward Dijkstra). */
    public List<InEdge> getInEdges(int node) {
        checkNode(node);
        return Collections.unmodifiableList(inEdges.get(node));
    }

    private void checkNode(int v) {
        if (v < 0 || v >= maxNodes)
            throw new IllegalArgumentException("Node out of range: " + v);
    }
}
