# DSP-E: Algorithm & Implementation Optimizations

What you have today (incremental Dijkstra, Case A/B, heap reuse, pruning) is already strong. Below are further optimizations you can add, ordered by **impact vs effort** for your setting (up to 10⁵ nodes, dynamic edges, real-time queries).

---

## 1. Quick wins (low effort, clear benefit)

### 1.1 Target pruning / early termination

**Idea:** For a **single-target** query `getShortestPath(target)`, stop Dijkstra as soon as the **target** is extracted from the heap. Its distance is then final; no need to expand the rest of the graph.

**Where:** In `runFullDijkstra()` and `runIncrementalDijkstra()`: after polling `(u, d)`, if `u == target` then **break** (and optionally return early from a target-aware overload).

**Impact:** Large when the graph is big and the target is close to the source; avoids expanding the whole reachable set.

**Caveat:** Only applies when the caller asks for one target. Your current API is “set source, then query target,” so this fits well for `getShortestPath(target)` and `getDistance(target)`.

**Implemented (Java):** `getShortestPath(target)` uses `ensureComputedUntil(target)` and `runFullDijkstra(stopTarget)` so Dijkstra stops once the target is extracted. When stopping early we do not set `lastComputedVersion`, so the next query triggers a full run and stays correct.

---

### 1.2 Batch updates (Case A)

**Idea:** If multiple edges are added or decreased **before** the next query, do **one** incremental run: collect all affected heads (with best tentative distances), push them all into the heap once, then run a single `runIncrementalDijkstra()`.

**Where:** Instead of calling `onEdgeAddedOrDecreased` per edge, maintain a small “pending Case A” buffer; on first query (or when flushing), push all pending nodes and run incremental once.

**Impact:** Fewer heap operations and better locality when many edges change between queries.

---

### 1.3 Lazy Case B: dirty set (advanced quick win)

**Idea:** On edge **removal** or **weight increase**, instead of invalidating the whole source, mark only nodes that might have had their distance **increased** as “dirty.” On query, either:
- run Dijkstra only from dirty nodes (forward), or  
- use a backward pass from dirty nodes to propagate increased distances.

**Where:** New state: e.g. `Set<Integer> dirtyNodes`. On remove/increase of edge `(u,v)`, add `v` (and optionally nodes reachable from `v` in the current shortest-path DAG) to `dirtyNodes`. In `ensureComputed()`, if dirty set is non-empty, run a limited recompute (e.g. only from dirty nodes) and clear the set.

**Impact:** Avoids full recompute when only a small part of the graph is affected by the removal/increase.

**Effort:** Medium (need to define and maintain dirty set correctly).

---

## 2. Algorithmic upgrades (medium effort)

### 2.1 Bidirectional Dijkstra (single s–t query)

**Idea:** Run Dijkstra from **source** and from **target** (on **reverse** graph). Stop when the two frontiers meet (e.g. when the sum of the best forward and backward distances for some node is no better than the best s–t distance found so far).

**Where:** New method e.g. `getShortestPathBidirectional(source, target)` using two heaps, two `dist` arrays (forward/backward), and a reverse graph (or reverse adjacency).

**Impact:** Can reduce expanded nodes from Θ(reachable from s) to roughly √(reachable) in favorable graphs (e.g. road networks).

**Caveat:** Complicates incremental/versioning: you’d maintain two sides and need to invalidate both on updates. Often used for one-off queries or when you’re okay recomputing both sides.

---

### 2.2 A* with a feasible heuristic

**Idea:** Replace “distance from source” with “distance + heuristic(target)” in the heap key. If the heuristic is **consistent** (e.g. Euclidean distance in road networks), A* finds the same shortest path while expanding fewer nodes.

**Where:** Heap key = `dist[u] + heuristic(u, target)`. You need a reverse graph or precomputed distances for a backward heuristic; or a geometric heuristic if coordinates exist.

**Impact:** Big in spatial networks (e.g. roads) with a good heuristic; less useful in abstract graphs without a notion of “closeness.”

---

### 2.3 Better heap: k-ary or Fibonacci

**Idea:**  
- **k-ary heap** (e.g. 4-ary): Fewer levels, better cache locality; same asymptotic complexity, often faster in practice.  
- **Fibonacci heap**: Theoretically better for Dijkstra (O(E + V log V) vs O((E+V) log V)), but constants and implementation complexity often make binary heap faster up to large sizes.

**Where:** Swap `PriorityQueue` for a custom k-ary heap or a Fibonacci heap implementation.

**Impact:** k-ary: moderate speedup; Fibonacci: mainly for very large graphs and when you’ve already optimized everything else.

---

## 3. Data structure & memory (medium effort)

### 3.1 Compact graph representation (e.g. CSR)

**Idea:** Store graph as **Compressed Sparse Row (CSR)**: one array of edge targets, one array of edge weights, one array of “start index per node.” Improves cache locality during traversal.

**Where:** New `Graph` representation (or a second “compact” view) built from current adjacency list; engine reads from it during Dijkstra.

**Impact:** Can noticeably reduce traversal time on large graphs (10⁵ nodes, many edges).

---

### 3.2 Integer weights + bucketing (Dial’s algorithm)

**Idea:** If **all edge weights are small integers** (e.g. 1..W_max), use a **bucket queue**: bucket[i] = nodes with tentative distance ≡ i (mod (W_max+1)). Each insert/decrease is O(1); each deleteMin is amortized O(1) over the run.

**Where:** Replace `PriorityQueue` with an array of deques (or similar) when `weight` is integral and bounded.

**Impact:** Very fast for small integer weights; not applicable if weights are arbitrary or floating.

---

## 4. Structural / preprocessing (higher effort)

### 4.1 Contraction Hierarchies (CH) or Highway nodes

**Idea:** Preprocess the graph so that a query only needs to relax a small “highway” subgraph. Works best when the graph is **mostly static**; dynamic CH is possible but complex.

**Where:** Separate preprocessing step; query runs a bidirectional search on the contracted graph.

**Impact:** Huge for static or slowly changing road networks; overkill for highly dynamic graphs.

---

### 4.2 Multi-source / distance oracles

**Idea:** If you have a **fixed set of sources** (e.g. depots), you can precompute or maintain distances from each source and merge results. Or use distance oracles (e.g. landmark-based) for approximate or exact queries.

**Where:** New layer on top of DSP-E (e.g. one engine per source, or a small cache of (source, target) → distance).

**Impact:** Depends on query pattern; useful when the same sources are queried repeatedly.

---

## 5. Summary table

| Optimization              | Effort  | Impact (typical)     | When to consider                    |
|---------------------------|--------|------------------------|-------------------------------------|
| Target pruning / early stop| Low   | High (single-target)  | Always for getShortestPath(target)  |
| Batch Case A updates      | Low    | Medium                | Many edge updates between queries   |
| Dirty set (Case B)        | Medium | Medium–high           | Few edges removed per query        |
| Bidirectional Dijkstra    | Medium | High (s–t only)       | One-off or rare s–t queries         |
| A* + heuristic            | Medium | High (spatial graphs) | Road networks, coordinates          |
| k-ary heap                | Low–Med| Moderate             | After profiling                     |
| CSR graph                 | Medium | Medium–high           | Large graphs, cache-bound           |
| Dial (integer weights)    | Medium | Very high             | Small integer weights only          |
| CH / highway              | High   | Very high             | Mostly static road networks         |

---

## 6. What to do next

1. **Implement target pruning** in full and incremental Dijkstra (stop when `u == target`).  
2. If you have **one target per query**, consider **bidirectional** for that API.  
3. If **many edges** change between queries, add **batch Case A**.  
4. If **removals** are common but local, design the **dirty set** for Case B.  
5. For **road networks** with coordinates, add **A*** next; for **static** road networks, consider **CH** later.

The first concrete step implemented in code (see below) is **target pruning** in the Java engine for `getShortestPath(target)`.
