export interface Edge {
  from: number
  to: number
  weight: number
}

export interface PathResult {
  distance: number
  path: number[]
  reachable: boolean
}

export interface EngineMetrics {
  nodesProcessed: number
  heapPushes: number
  heapPolls: number
  cacheHits: number
  cacheMisses: number
  incrementalCount: number
  fullRecomputeCount: number
  /** Edge add/remove/weight updates that triggered engine notify */
  edgeUpdateCount: number
  /** Total getShortestPath + getDistance calls */
  totalPathQueries: number
  /** Distinct nodes whose dist[] was updated in last Dijkstra run */
  lastRunAffectedNodes: number
  /** Edges in last shortest path (path.length - 1) */
  lastPathLength: number
  /** Max heap size during last run */
  peakHeapSize: number
}
