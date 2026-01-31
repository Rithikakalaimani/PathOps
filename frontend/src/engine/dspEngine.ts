import type { PathResult, EngineMetrics } from './types'
import { Graph } from './graph'

const INF = Number.POSITIVE_INFINITY

interface HeapEntry {
  node: number
  dist: number
}

export class DSPEngine {
  private readonly graph: Graph
  private readonly n: number
  private graphVersion = 0
  private currentSource = -1
  private lastComputedVersion = -1
  private readonly dist: number[] = []
  private readonly parent: number[] = []
  private readonly heap: HeapEntry[] = []
  private distanceThreshold = INF

  /** Metrics for UI */
  private metrics: EngineMetrics = {
    nodesProcessed: 0,
    heapPushes: 0,
    heapPolls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    incrementalCount: 0,
    fullRecomputeCount: 0,
    edgeUpdateCount: 0,
    totalPathQueries: 0,
    lastRunAffectedNodes: 0,
    lastPathLength: 0,
    peakHeapSize: 0,
  }

  private lastRunAffectedSet = new Set<number>()
  private runPeakHeapSize = 0

  constructor(graph: Graph) {
    this.graph = graph
    this.n = graph.getMaxNodes()
    for (let i = 0; i < this.n; i++) {
      this.dist[i] = INF
      this.parent[i] = -1
    }
  }

  setSource(source: number): void {
    if (source < 0 || source >= this.n) throw new Error(`Source out of range: ${source}`)
    if (this.currentSource !== source) {
      this.currentSource = source
      this.lastComputedVersion = -1
    }
  }

  getCurrentSource(): number {
    return this.currentSource
  }

  setDistanceThreshold(threshold: number): void {
    this.distanceThreshold = threshold >= 0 ? threshold : INF
  }

  getMetrics(): Readonly<EngineMetrics> {
    return { ...this.metrics }
  }

  private ensureComputed(): void {
    if (this.currentSource < 0) throw new Error('No source set')
    if (this.lastComputedVersion === this.graphVersion) {
      this.metrics.cacheHits++
      this.metrics.totalPathQueries++
      return
    }
    this.metrics.cacheMisses++
    this.metrics.totalPathQueries++
    this.runFullDijkstra()
    this.lastComputedVersion = this.graphVersion
  }

  private heapCmp(a: HeapEntry, b: HeapEntry): number {
    return a.dist - b.dist
  }

  private heapPush(entry: HeapEntry): void {
    this.heap.push(entry)
    this.metrics.heapPushes++
    this.runPeakHeapSize = Math.max(this.runPeakHeapSize, this.heap.length)
    this.heap.sort(this.heapCmp)
  }

  private heapPop(): HeapEntry | undefined {
    const e = this.heap.shift()
    if (e) this.metrics.heapPolls++
    return e
  }

  private runFullDijkstra(): void {
    this.metrics.fullRecomputeCount++
    this.lastRunAffectedSet.clear()
    this.runPeakHeapSize = 0
    for (let i = 0; i < this.n; i++) {
      this.dist[i] = INF
      this.parent[i] = -1
    }
    this.dist[this.currentSource] = 0
    this.parent[this.currentSource] = this.currentSource
    this.heap.length = 0
    this.heapPush({ node: this.currentSource, dist: 0 })

    while (this.heap.length > 0) {
      const e = this.heapPop()!
      const u = e.node
      const d = e.dist
      if (d > this.dist[u]!) continue
      if (d > this.distanceThreshold) continue
      this.metrics.nodesProcessed++

      for (const edge of this.graph.getOutEdges(u)) {
        const v = edge.to
        const w = edge.weight
        const newDist = d + w
        if (newDist >= this.dist[v]!) continue
        if (newDist > this.distanceThreshold) continue
        this.dist[v] = newDist
        this.parent[v] = u
        this.lastRunAffectedSet.add(v)
        this.heapPush({ node: v, dist: newDist })
      }
    }
    this.metrics.lastRunAffectedNodes = this.lastRunAffectedSet.size
    this.metrics.peakHeapSize = this.runPeakHeapSize
  }

  private onEdgeAddedOrDecreased(from: number, to: number, newWeight: number): void {
    if (this.currentSource < 0) return
    if (this.lastComputedVersion !== this.graphVersion - 1) return
    const dFrom = this.dist[from]!
    if (dFrom === INF) return
    const newDistTo = dFrom + newWeight
    if (newDistTo >= this.dist[to]!) return

    this.metrics.incrementalCount++
    this.dist[to] = newDistTo
    this.parent[to] = from
    this.lastRunAffectedSet.clear()
    this.lastRunAffectedSet.add(to)
    this.runPeakHeapSize = 0
    this.heapPush({ node: to, dist: newDistTo })
    this.runIncrementalDijkstra()
    this.lastComputedVersion = this.graphVersion
  }

  private runIncrementalDijkstra(): void {
    this.runPeakHeapSize = Math.max(this.runPeakHeapSize, this.heap.length)
    while (this.heap.length > 0) {
      const e = this.heapPop()!
      const u = e.node
      const d = e.dist
      if (d > this.dist[u]!) continue
      if (d > this.distanceThreshold) continue
      this.metrics.nodesProcessed++

      for (const edge of this.graph.getOutEdges(u)) {
        const v = edge.to
        const w = edge.weight
        const newDist = d + w
        if (newDist >= this.dist[v]!) continue
        if (newDist > this.distanceThreshold) continue
        this.dist[v] = newDist
        this.parent[v] = u
        this.lastRunAffectedSet.add(v)
        this.heapPush({ node: v, dist: newDist })
      }
    }
    this.metrics.lastRunAffectedNodes = this.lastRunAffectedSet.size
    this.metrics.peakHeapSize = Math.max(this.metrics.peakHeapSize, this.runPeakHeapSize)
  }

  notifyEdgeAdded(from: number, to: number, weight: number): void {
    this.graphVersion++
    this.metrics.edgeUpdateCount++
    this.onEdgeAddedOrDecreased(from, to, weight)
  }

  notifyEdgeRemoved(): void {
    this.graphVersion++
    this.metrics.edgeUpdateCount++
  }

  notifyEdgeWeightChanged(from: number, to: number, oldWeight: number, newWeight: number): void {
    this.graphVersion++
    this.metrics.edgeUpdateCount++
    if (newWeight < oldWeight) this.onEdgeAddedOrDecreased(from, to, newWeight)
  }

  getShortestPath(target: number): PathResult {
    if (target < 0 || target >= this.n) throw new Error(`Target out of range: ${target}`)
    this.ensureComputed()
    if (this.dist[target] === INF) return { distance: INF, path: [], reachable: false }
    const path = this.buildPath(target)
    this.metrics.lastPathLength = path.length > 1 ? path.length - 1 : 0
    return { distance: this.dist[target]!, path, reachable: true }
  }

  getDistance(target: number): number {
    if (target < 0 || target >= this.n) throw new Error(`Target out of range: ${target}`)
    this.ensureComputed()
    return this.dist[target] ?? INF
  }

  private buildPath(target: number): number[] {
    const path: number[] = []
    let v: number = target
    while (v >= 0) {
      path.push(v)
      if (v === this.currentSource) break
      v = this.parent[v]!
    }
    path.reverse()
    return path
  }

  addEdge(from: number, to: number, weight: number): boolean {
    const added = this.graph.addEdge(from, to, weight)
    if (added) this.notifyEdgeAdded(from, to, weight)
    return added
  }

  removeEdge(from: number, to: number): boolean {
    const removed = this.graph.removeEdge(from, to)
    if (removed) this.notifyEdgeRemoved()
    return removed
  }

  setEdge(from: number, to: number, weight: number): void {
    const old = this.graph.setEdgeWeight(from, to, weight)
    if (old < 0) this.notifyEdgeAdded(from, to, weight)
    else this.notifyEdgeWeightChanged(from, to, old, weight)
  }

  getGraph(): Graph {
    return this.graph
  }

  invalidate(): void {
    this.graphVersion++
  }
}
