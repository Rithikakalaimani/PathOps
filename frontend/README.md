# PathOps Live Routing Dashboard

React + Vite + TypeScript + Tailwind CSS + React Flow dashboard for the DSP-E (Dynamic Shortest Path Engine).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview   # serve dist
```

## Layout

- **Header**: PathOps | Live Routing Dashboard
- **Left panel**: Graph Controls — Add Edge, Remove Edge, Update Weight, Reset Graph (instant feedback)
- **Center**: Graph Visualization (React Flow) — nodes as circles, edges with weight on hover, shortest path highlighted (green, thicker)
- **Shortest Path Query**: Source, Destination, Compute Path — shows path sequence, total distance, **time taken (ms)**
- **Metrics & Logs**: Nodes processed, heap operations (push/poll), cache hits/misses, hit rate, incremental vs full recomputation count

## Tech stack

- React 18 + Vite 5
- TypeScript
- Tailwind CSS
- React Flow (graph visualization)
