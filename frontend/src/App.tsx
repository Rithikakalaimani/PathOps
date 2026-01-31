import { useCallback, useMemo, useState } from 'react'
import { Graph } from './engine/graph'
import { DSPEngine } from './engine/dspEngine'
import type { PathResult } from './engine/types'
import { GraphControls } from './components/GraphControls'
import { GraphVisualization } from './components/GraphVisualization'
import { ShortestPathQuery } from './components/ShortestPathQuery'
import { MetricsPanel } from './components/MetricsPanel'

const MAX_NODES = 1000

function createEngineState() {
  const graph = new Graph(MAX_NODES)
  return { graph, engine: new DSPEngine(graph) }
}

export default function App() {
  const [{ graph, engine }, setEngineState] = useState(createEngineState)
  const [edges, setEdges] = useState<{ from: number; to: number; weight: number }[]>([])
  const [pathResult, setPathResult] = useState<{
    path: number[]
    pathEdgeKeys: Set<string>
  } | null>(null)
  const [metrics, setMetrics] = useState(engine.getMetrics())
  const [resetKey, setResetKey] = useState(0)

  const refreshEdges = useCallback(() => {
    setEdges(graph.getAllEdges())
  }, [graph])

  const refreshMetrics = useCallback(() => {
    setMetrics(engine.getMetrics())
  }, [engine])

  const onAddEdge = useCallback(
    (from: number, to: number, weight: number) => {
      if (from < 0 || from >= MAX_NODES || to < 0 || to >= MAX_NODES) {
        return { success: false, message: 'Node IDs must be 0–' + (MAX_NODES - 1) }
      }
      if (weight < 0) return { success: false, message: 'Weight must be non-negative' }
      try {
        const added = engine.addEdge(from, to, weight)
        refreshEdges()
        refreshMetrics()
        return added
          ? { success: true, message: `Edge ${from}→${to} added` }
          : { success: false, message: 'Edge already exists' }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : 'Error' }
      }
    },
    [engine, refreshEdges, refreshMetrics],
  )

  const onRemoveEdge = useCallback(
    (from: number, to: number) => {
      try {
        const removed = engine.removeEdge(from, to)
        refreshEdges()
        refreshMetrics()
        return removed
          ? { success: true, message: `Edge ${from}→${to} removed` }
          : { success: false, message: 'No such edge' }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : 'Error' }
      }
    },
    [engine, refreshEdges, refreshMetrics],
  )

  const onUpdateWeight = useCallback(
    (from: number, to: number, weight: number) => {
      if (from < 0 || from >= MAX_NODES || to < 0 || to >= MAX_NODES) {
        return { success: false, message: 'Node IDs out of range' }
      }
      if (weight < 0) return { success: false, message: 'Weight must be non-negative' }
      try {
        const hasEdge = graph.getEdgeWeight(from, to) >= 0
        if (!hasEdge) return { success: false, message: 'No such edge; add it first' }
        engine.setEdge(from, to, weight)
        refreshEdges()
        refreshMetrics()
        return { success: true, message: `Weight updated to ${weight}` }
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : 'Error' }
      }
    },
    [engine, graph, refreshEdges, refreshMetrics],
  )

  const onResetGraph = useCallback(() => {
    const { graph: g, engine: eng } = createEngineState()
    setEngineState({ graph: g, engine: eng })
    setEdges([])
    setPathResult(null)
    setMetrics(eng.getMetrics())
    setResetKey((k) => k + 1)
  }, [])

  const onComputePath = useCallback(
    (source: number, target: number): { result: PathResult; timeMs: number } => {
      engine.setSource(source)
      const t0 = performance.now()
      const result = engine.getShortestPath(target)
      const timeMs = performance.now() - t0
      const pathEdgeKeys = new Set<string>()
      for (let i = 0; i < result.path.length - 1; i++) {
        pathEdgeKeys.add(`${result.path[i]}-${result.path[i + 1]}`)
      }
      setPathResult({
        path: result.path,
        pathEdgeKeys,
      })
      setMetrics(engine.getMetrics())
      return { result, timeMs }
    },
    [engine],
  )

  const pathNodeIds = useMemo(
    () => (pathResult ? new Set(pathResult.path) : new Set<number>()),
    [pathResult],
  )
  const pathEdgeKeys = useMemo(
    () => (pathResult ? pathResult.pathEdgeKeys : new Set<string>()),
    [pathResult],
  )

  return (
    <div className="min-h-screen flex flex-col w-full max-w-[100vw] overflow-x-hidden">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-panel)]/95 backdrop-blur-sm safe-area-inset-top">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] font-mono font-semibold text-sm">
              P
            </span>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-[var(--text)] truncate">
                PathOps
              </h1>
              <p className="text-xs text-[var(--text-secondary)] truncate sm:whitespace-normal">
                Live Routing · DSP-E
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 flex flex-col gap-4 sm:gap-5 min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 sm:gap-5 flex-1 min-h-0">
        <aside className="lg:max-h-[70vh] overflow-y-auto min-w-0 order-2 lg:order-1">
          <GraphControls
            key={resetKey}
            onAddEdge={onAddEdge}
            onRemoveEdge={onRemoveEdge}
            onUpdateWeight={onUpdateWeight}
            onResetGraph={onResetGraph}
          />
        </aside>
        <section className="min-h-[260px] sm:min-h-[320px] flex flex-col gap-4 min-w-0 order-1 lg:order-2">
          <GraphVisualization
            edges={edges}
            pathNodeIds={pathNodeIds}
            pathEdgeKeys={pathEdgeKeys}
          />
        </section>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 min-w-0 pb-safe">
        <ShortestPathQuery key={resetKey} onComputePath={onComputePath} />
        <MetricsPanel metrics={metrics} />
      </section>
      </main>
    </div>
  )
}
