# Logic Verification Summary

Review date: project-wide check of DSP-E logic.

---

## Java Backend

### Graph
- **addEdge(from, to, weight)**: Rejects duplicate from→to; maintains `outEdges` and `inEdges`; `Edge` enforces non-negative weight. ✓
- **removeEdge(from, to)**: Removes first matching edge; updates both `outEdges` and `inEdges` (removeInEdge). ✓
- **setEdgeWeight(from, to, newWeight)**: Updates or adds; keeps `inEdges` in sync via `updateInEdge`. ✓
- **getOutEdges / getInEdges**: Return correct lists; node bounds checked. ✓

### DSPEngine
- **Versioning**: `graphVersion` increments on every graph change; `lastComputedVersion` marks when current source was last computed; stale state triggers recompute. ✓
- **ensureComputed()**: Order is (1) dirty recompute if dirty set non-empty, (2) flush pending Case A + incremental if pending and valid state, (3) full Dijkstra. ✓
- **ensureComputedUntil(target)**: Same order; uses `runFullDijkstra(target)` or `runIncrementalDijkstra(target)` for target pruning; when stopping early does not set `lastComputedVersion`. ✓
- **runFullDijkstra(stopTarget)**: Init dist/parent, set source to 0, run `runDijkstraLoop(stopTarget)`. ✓
- **runDijkstraLoop(stopTarget)**: Lazy discard (`d > dist[u]`), threshold prune, stop when `u == stopTarget`; relax only when improving. ✓
- **runDirtyRecompute()**: Set `dist[d]=INF`, `parent[d]=-1` for dirty nodes; then **always** set `dist[currentSource]=0`, `parent[currentSource]=currentSource` and seed heap with `(currentSource, 0)` so the source is correct even when it was in the dirty set. ✓ (fixed)
- **flushPendingCaseA()**: For each pending (from, to, weight), if `dist[from] + weight < dist[to]` update dist/parent and push; then incremental run. ✓
- **addDirtyWithDescendants(node)**: Add node and all SPT-descendants (BFS via parent); only when `lastComputedVersion == graphVersion - 1`. ✓
- **getShortestPath(target)**: Validates target; calls `ensureComputedUntil(target)`; returns unreachable or path with correct distance. ✓
- **getDistance(target)**: Validates target; calls `ensureComputed()`; returns `dist[target]`. ✓ (validation added)
- **getShortestPathBidirectional(source, target)**: Forward from source, backward from target via `getInEdges`; stop when `minF + minB >= bestDist`; path built from meeting node via parentF and parentB. ✓
- **buildPath(target)**: Walk parent from target to source; reverse. ✓
- **notifyEdgeAdded / notifyEdgeRemoved / notifyEdgeWeightChanged**: Version bump; Case A (pending) vs Case B (dirty) applied correctly. ✓

### Edge cases
- Source == target: Handled in bidirectional (returns 0, [source]); single-source returns path [source] with distance 0. ✓
- Unreachable target: `dist[target] == INF` → unreachable result. ✓
- Empty graph / no edges: Dijkstra only reaches source; other nodes stay INF. ✓
- Source in dirty set (e.g. remove edge into source): `runDirtyRecompute` re-initializes source to 0 and seeds heap with (source, 0). ✓

---

## Frontend (TypeScript)

- **Graph**: Same semantics (addEdge, removeEdge, setEdgeWeight, getOutEdges, getAllEdges); no inEdges (no bidirectional in frontend). ✓
- **DSPEngine**: Simplified model (no batch Case A, no dirty set, no bidirectional); immediate `onEdgeAddedOrDecreased`; `ensureComputed` always runs full or incremental; metrics (nodesProcessed, heapPushes/Polls, cacheHits/Misses, incremental/full counts) updated correctly. ✓
- **getDistance(target)**: Target range validated. ✓ (added)

---

## Tests

- **ClassicDijkstra**: Single node, simple path, unreachable. ✓
- **IncrementalCaseA**: Add edge after query (batch flush + incremental), decrease weight. ✓
- **CaseB_DirtyRecompute**: Remove edge then query (full or dirty recompute), weight increase; **removeEdgeIntoSource_dirtyRecomputeResetsSource** (source in dirty set). ✓
- **Pruning**: Distance threshold. ✓
- **BidirectionalDijkstra**: Same result as single-source, unreachable, source == target. ✓
- **BatchCaseA**: Multiple adds then one query (flush once). ✓
- **GraphOnly**: CRUD and getInEdges. ✓

All tests pass after the runDirtyRecompute fix and getDistance validation.

---

## Fixes applied in this review

1. **runDirtyRecompute()**: After setting dirty nodes to INF, always set `dist[currentSource]=0`, `parent[currentSource]=currentSource`, and seed heap with `(currentSource, 0)` so the source is correct when it appears in the dirty set.
2. **getDistance(target)** (Java): Added bounds check `0 <= target < n`.
3. **getDistance(target)** (TS): Added bounds check for consistency.
4. **Test**: Added `removeEdgeIntoSource_dirtyRecomputeResetsSource` to guard the dirty-recompute source re-init.
