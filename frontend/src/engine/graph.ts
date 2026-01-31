import type { Edge } from './types'

const MAX_NODES = 100_000

export class Graph {
  private readonly maxNodes: number
  private readonly outEdges: Edge[][]
  private edgeCount = 0

  constructor(maxNodes: number) {
    if (maxNodes <= 0 || maxNodes > MAX_NODES) {
      throw new Error(`maxNodes must be in [1, ${MAX_NODES}]`)
    }
    this.maxNodes = maxNodes
    this.outEdges = Array.from({ length: maxNodes }, () => [])
  }

  getMaxNodes(): number {
    return this.maxNodes
  }

  getEdgeCount(): number {
    return this.edgeCount
  }

  addEdge(from: number, to: number, weight: number): boolean {
    this.checkNode(from)
    this.checkNode(to)
    if (weight < 0) throw new Error('Weight must be non-negative')
    const list = this.outEdges[from]!
    if (list.some((e) => e.to === to)) return false
    list.push({ from, to, weight })
    this.edgeCount++
    return true
  }

  removeEdge(from: number, to: number): boolean {
    this.checkNode(from)
    this.checkNode(to)
    const list = this.outEdges[from]!
    const i = list.findIndex((e) => e.to === to)
    if (i < 0) return false
    list.splice(i, 1)
    this.edgeCount--
    return true
  }

  setEdgeWeight(from: number, to: number, newWeight: number): number {
    this.checkNode(from)
    this.checkNode(to)
    if (newWeight < 0) throw new Error('Weight must be non-negative')
    const list = this.outEdges[from]!
    const e = list.find((x) => x.to === to)
    if (e) {
      const old = e.weight
      e.weight = newWeight
      return old
    }
    list.push({ from, to, weight: newWeight })
    this.edgeCount++
    return -1
  }

  getEdgeWeight(from: number, to: number): number {
    this.checkNode(from)
    this.checkNode(to)
    const e = this.outEdges[from]!.find((x) => x.to === to)
    return e ? e.weight : -1
  }

  getOutEdges(node: number): readonly Edge[] {
    this.checkNode(node)
    return this.outEdges[node]!
  }

  getAllEdges(): Edge[] {
    const out: Edge[] = []
    for (let v = 0; v < this.maxNodes; v++) {
      for (const e of this.outEdges[v]!) out.push(e)
    }
    return out
  }

  getNodeIds(): number[] {
    const seen = new Set<number>()
    for (let v = 0; v < this.maxNodes; v++) {
      if (this.outEdges[v]!.length > 0) seen.add(v)
      for (const e of this.outEdges[v]!) {
        seen.add(e.to)
      }
    }
    return Array.from(seen).sort((a, b) => a - b)
  }

  private checkNode(v: number): void {
    if (v < 0 || v >= this.maxNodes) throw new Error(`Node out of range: ${v}`)
  }
}
