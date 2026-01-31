# Dynamic Shortest Path Engine (DSP-E)

A real-time graph engine that maintains near-instant shortest path answers under continuous edge updates, without full recomputation.

## Algorithm: Incremental Dijkstra with Lazy Re-Optimization

- **Base layer**: Classic Dijkstra — adjacency list, min-heap (priority queue), distance array.
- **Case A** (edge added / weight decreased): Localized healing — only push the affected node into the heap and resume Dijkstra; reuse existing distances.
- **Case B** (edge removed / weight increased): Mark paths dirty via versioning; recompute only when queried.
- **Heap reuse**: Keep the heap alive; inject only impacted nodes; ignore stale entries with lazy checks when polling.
- **Graph pruning**: Skip edges whose weight cannot improve the current best; optional distance threshold for road networks.

## Constraints

- Directed weighted graph, up to **10⁵** nodes.
- Dynamic edge insertions and deletions.
- Real-time shortest path queries with minimal recomputation (no full recompute when Case A applies).

## Build & Test

```bash
mvn clean test
```

## Usage

```java
// Build graph and engine
Graph graph = new Graph(100_000);
DSPEngine engine = new DSPEngine(graph);

// Single source: set source then query
engine.setSource(0);

// Updates go through the engine (so incremental logic runs)
engine.addEdge(0, 1, 2.0);
engine.addEdge(1, 2, 1.0);
engine.addEdge(0, 2, 5.0);

PathResult r = engine.getShortestPath(2);
if (r.isReachable()) {
    System.out.println("Distance: " + r.getDistance());
    System.out.println("Path: " + r.getPath());
}

// Case A: add a shortcut → incremental heal
engine.addEdge(0, 2, 1.0);  // cheaper path
PathResult r2 = engine.getShortestPath(2);  // uses cached state + localized re-Dijkstra

// Case B: remove edge → next query recomputes (versioning)
engine.removeEdge(0, 2);

// Optional: distance threshold (e.g. road networks)
engine.setDistanceThreshold(100.0);

// If you modify the graph directly, invalidate so next query recomputes
graph.addEdge(3, 4, 1.0);
engine.invalidate();
```

## Project layout

```
src/main/java/pathops/engine/
  Edge.java       - Directed edge (from, to, weight)
  Graph.java      - Adjacency list, edge add/remove/set
  PathResult.java - Query result (distance + path)
  DSPEngine.java  - Incremental Dijkstra engine
```

## Live Routing Dashboard (frontend)

A React + Vite + TypeScript UI with Tailwind CSS and React Flow:

- **Graph Controls**: Add / Remove / Update edge; Reset graph; instant success/error feedback
- **Graph Visualization**: Nodes as circles, edges with weight on hover, shortest path highlighted (bold/green)
- **Shortest Path Query**: Source, destination, Compute Path → path sequence, total distance, **time taken (ms)**
- **Metrics & Logs**: Nodes processed, heap operations, cache hits/misses, incremental vs full recomputation count

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

See `frontend/README.md` for details.

## Later: production-ready

Planned extensions:

- Persistence, replication, metrics.
- Multi-source or batch queries.
- Tuning (e.g. when to fall back to full Dijkstra).
- API layer (REST/gRPC) and deployment.
