# DSP-E: Implementation Summary

## Problem Statement

Given a **weighted directed graph** with up to **10⁵ nodes**, support:

- **Dynamic edge insertions and deletions**
- **Real-time shortest path queries**
- **Minimal recomputation** after updates (no full recompute from scratch when avoidable)

---

## Constraints Covered

| Constraint | How It Is Covered |
|------------|-------------------|
| **Graph size: up to 10⁵ nodes** | `Graph` constructor enforces `maxNodes` in `[1, 100_000]`; adjacency list and engine arrays scale to this size. |
| **Dynamic edge insertions** | `Graph.addEdge(from, to, weight)` and `DSPEngine.addEdge(...)`; engine uses **Case A** (incremental heal) when possible. |
| **Dynamic edge deletions** | `Graph.removeEdge(from, to)` and `DSPEngine.removeEdge(...)`; engine uses **Case B** (versioning, recompute on next query). |
| **Real-time shortest path queries** | `DSPEngine.getShortestPath(target)` and `getDistance(target)`; answers use cached state + incremental update when applicable. |
| **Minimal recomputation** | **Case A**: only re-run Dijkstra from affected node (localized healing). **Case B**: pay full recompute only when a path is queried (lazy). **Heap reuse**: same heap, inject impacted nodes only; lazy discard of stale entries. |
| **No full recompute when avoidable** | After edge add/decrease, `onEdgeAddedOrDecreased` runs incremental Dijkstra from the improved node; full Dijkstra only on new source, after remove/weight-increase, or when graph is edited externally and `invalidate()` is used. |

---

## What Was Implemented

### 1. Base Layer — Classic Dijkstra

| Component | Implementation |
|-----------|----------------|
| **Adjacency list** | `Graph`: `List<List<Edge>> outEdges` — `outEdges.get(v)` = outgoing edges from node `v`. |
| **Min-heap (priority queue)** | `DSPEngine`: `PriorityQueue<HeapEntry>` ordered by `dist`; used for Dijkstra expansion. |
| **Distance array** | `DSPEngine`: `double[] dist` — shortest distance from current source to each node. |
| **Parent array** | `DSPEngine`: `int[] parent` — for path reconstruction. |
| **Full Dijkstra run** | `runFullDijkstra()`: clear heap, set `dist[source]=0`, push source; while heap not empty, poll, relax outgoing edges, push improved nodes; pruning applied (see below). |

### 2. Incremental Upgrade — Lazy Re-Dijkstra

| Case | Behavior | Where in Code |
|------|----------|----------------|
| **Case A (batch)** | Edge add/decrease is recorded in `pendingCaseA`; on next query we flush: push all improved `(to, dist[from]+weight)` into the heap once, then run one `runIncrementalDijkstra()`. Localized healing with one heap run for multiple updates. | `notifyEdgeAdded` / `notifyEdgeWeightChanged` (decrease) → `pendingCaseA.add(...)`; in `ensureComputed` / `ensureComputedUntil`: `flushPendingCaseA()` then `runIncrementalDijkstra()`. |
| **Case B (dirty set)** | Edge removal/weight increase marks head `to` and all its SPT-descendants as `dirtyNodes`. On query: if we have valid full state (`lastComputedVersion >= 0`), run `runDirtyRecompute()` (set `dist[d]=INF` for dirty, seed heap with source and boundary nodes, run Dijkstra); else full Dijkstra. | `notifyEdgeRemoved` / `notifyEdgeWeightChanged` (increase) → `addDirtyWithDescendants(to)`; in `ensureComputed`: if `!dirtyNodes.isEmpty()` then dirty recompute or full. |

### 3. Heap Reuse Optimization

| Requirement | Implementation |
|-------------|----------------|
| **Keep heap alive** | Same `PriorityQueue<HeapEntry>` used across incremental runs; not cleared in Case A. |
| **Inject only impacted nodes** | In Case A, only the improved node `to` (and later nodes relaxed from it) are pushed; no full re-push of all nodes. |
| **Ignore stale heap entries** | When polling: `if (d > dist[u]) continue;` — lazy check so outdated heap entries are skipped. |

### 4. Target Pruning

| Feature | Implementation |
|---------|----------------|
| **Early stop at target** | `getShortestPath(target)` uses `ensureComputedUntil(target)` and `runFullDijkstra(stopTarget)` / `runIncrementalDijkstra(stopTarget)` so Dijkstra stops once the target is extracted. When stopping early we do not set `lastComputedVersion` so next full query recomputes. |

### 5. Graph Pruning

| Feature | Implementation |
|---------|----------------|
| **Skip edges that cannot improve** | Before updating a neighbor: `if (newDist >= dist[v]) continue;` in `runDijkstraLoop()`. |
| **Optional distance threshold** | `setDistanceThreshold(limit)`: nodes with `dist > limit` are not expanded. Useful for road networks. |

### 6. Bidirectional Dijkstra

| Feature | Implementation |
|---------|----------------|
| **One-off s–t query** | `getShortestPathBidirectional(source, target)`: run Dijkstra from `source` (forward) and from `target` (backward via `Graph.getInEdges`). Stop when `min(heapF.peek(), heapB.peek()) + … >= bestDist`. Build path from meeting node. Does not use or update single-source state. |
| **Reverse graph** | `Graph` maintains `inEdges` (incoming edges per node) for the backward search; updated on add/remove/set edge. |

### 7. Graph Data Structure & Edge API

| Feature | Implementation |
|---------|----------------|
| **Directed weighted edges** | `Edge(from, to, weight)`; weight must be non-negative. |
| **Add edge** | `Graph.addEdge(from, to, weight)` — no duplicate `from→to`; returns `true` if added. |
| **Remove edge** | `Graph.removeEdge(from, to)` — removes first matching edge; returns `true` if removed. |
| **Update weight** | `Graph.setEdgeWeight(from, to, newWeight)` — updates if exists, else adds; returns previous weight or `-1`. |
| **Query edge weight** | `Graph.getEdgeWeight(from, to)` — returns weight or `-1`. |
| **Out-edges** | `Graph.getOutEdges(node)` — read-only list of outgoing edges. |

### 8. Engine API & Lifecycle

| API | Purpose |
|-----|---------|
| `DSPEngine(Graph graph)` | Build engine over existing graph. |
| `setSource(int source)` | Set single source for subsequent path/distance queries; new source forces full recompute. |
| `getShortestPath(int target)` | Returns `PathResult`: distance, path list, reachable flag; triggers `ensureComputed()` so state is up to date. |
| `getDistance(int target)` | Returns distance only; same guarantee as above. |
| `addEdge(from, to, weight)` | Add edge in graph and notify engine (Case A if applicable). |
| `removeEdge(from, to)` | Remove edge in graph and notify engine (Case B). |
| `setEdge(from, to, weight)` | Add or update edge and notify engine (Case A or B depending on old/new weight). |
| `setDistanceThreshold(double)` | Optional pruning cap; no cap if not set. |
| `invalidate()` | Call after modifying the graph directly (outside engine); next query does full recompute. |
| `getShortestPathBidirectional(source, target)` | One-off s–t shortest path using bidirectional Dijkstra; does not update single-source state. |

---

## File & Class Summary

| File | Role |
|------|------|
| **Edge.java** | Immutable directed edge: `from`, `to`, `weight` (non-negative). |
| **Graph.java** | Adjacency list + inEdges (reverse); max nodes 1–100_000; edge add/remove/set/get; `getOutEdges`, `getInEdges`. |
| **PathResult.java** | Query result: `distance`, `path` (list of nodes), `reachable`; factory `unreachable()` and `of(distance, path)`. |
| **DSPEngine.java** | Core engine: versioning, single-source state (`dist`, `parent`, heap), batch Case A (`pendingCaseA`, `flushPendingCaseA`), lazy Case B (`dirtyNodes`, `addDirtyWithDescendants`, `runDirtyRecompute`), target pruning (`ensureComputedUntil`, `runFullDijkstra(stopTarget)`), `runDijkstraLoop`, and `getShortestPathBidirectional`. |

---

## Algorithm Summary

1. **Baseline**: Classic Dijkstra from a fixed source — adjacency list, min-heap, distance/parent arrays.
2. **Case A** (add/decrease): Push the head of the improved edge with new distance; run Dijkstra from the heap only; reuse existing distances — **localized healing**.
3. **Case B** (remove/increase): Bump version; on next query, if stale, run full Dijkstra — **pay only when needed**.
4. **Heap**: Reuse same heap; add only impacted nodes; on poll, skip if `polledDist > dist[node]` — **lazy stale check**.
5. **Pruning**: Skip relaxation when `newDist >= dist[v]`; optionally skip when `newDist > distanceThreshold`. **Target pruning**: stop Dijkstra once target is settled for single-target queries.  
6. **Batch Case A**: Multiple add/decrease updates are batched in `pendingCaseA`; one flush + incremental run on next query.  
7. **Lazy Case B dirty set**: On remove/increase, mark head and SPT-descendants dirty; recompute only dirty region when we have valid full state.  
8. **Bidirectional**: `getShortestPathBidirectional(s, t)` runs forward from s and backward from t (using `getInEdges`), stops when frontiers meet.

---

## Tests (What Is Verified)

- **ClassicDijkstra**: Single node, simple path, unreachable target.
- **IncrementalCaseA**: Add edge after query (localized heal), decrease weight (localized heal).
- **CaseB_DirtyRecompute**: Remove edge then query (recompute), increase weight then query (recompute).
- **Pruning**: Distance threshold caps expansion; nodes beyond threshold are unreachable in result.
- **GraphOnly**: Graph edge add/remove/set/get behavior and duplicate handling.

All of the above are covered by the current test suite (9 tests).
