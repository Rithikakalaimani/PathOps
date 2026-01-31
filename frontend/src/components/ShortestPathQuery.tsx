import { useState } from 'react'
import type { PathResult } from '../engine/types'

export interface ShortestPathQueryProps {
  onComputePath: (source: number, target: number) => { result: PathResult; timeMs: number }
}

export function ShortestPathQuery({ onComputePath }: ShortestPathQueryProps) {
  const [source, setSource] = useState('0')
  const [target, setTarget] = useState('1')
  const [output, setOutput] = useState<{
    path: number[]
    distance: number
    timeMs: number
    reachable: boolean
  } | null>(null)

  const handleCompute = () => {
    const s = parseInt(source, 10)
    const t = parseInt(target, 10)
    if (Number.isNaN(s) || Number.isNaN(t)) {
      setOutput(null)
      return
    }
    const { result, timeMs } = onComputePath(s, t)
    setOutput({
      path: result.path,
      distance: result.distance,
      timeMs,
      reachable: result.reachable,
    })
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <span className="text-[var(--path)] text-lg" aria-hidden>→</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Shortest Path Query
        </h2>
      </div>
      <div className="flex flex-wrap gap-3 sm:gap-4 items-end">
        <div className="flex-1 min-w-[80px] max-w-[100px] sm:max-w-none sm:flex-initial">
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Source</label>
          <input
            type="number"
            min={0}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full min-w-0 px-2.5 py-2 rounded-md bg-[var(--bg-panel)] border border-[var(--border)] text-sm font-mono text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            aria-label="Source node"
          />
        </div>
        <div className="flex-1 min-w-[80px] max-w-[100px] sm:max-w-none sm:flex-initial">
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Destination</label>
          <input
            type="number"
            min={0}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full min-w-0 px-2.5 py-2 rounded-md bg-[var(--bg-panel)] border border-[var(--border)] text-sm font-mono text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            aria-label="Destination node"
          />
        </div>
        <button
          type="button"
          onClick={handleCompute}
          className="btn-success px-4 py-2.5 sm:py-2 rounded-md text-sm font-medium w-full sm:w-auto min-h-[44px] sm:min-h-0"
        >
          Compute Path
        </button>
      </div>
      {output && (
        <div className="mt-4 p-3 sm:p-4 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-sm space-y-2 border-l-4 border-l-[var(--path)] overflow-x-auto">
          {output.reachable ? (
            <>
              <p>
                <span className="text-[var(--text-secondary)]">Path: </span>
                <span className="font-mono text-[var(--text)] break-all sm:break-normal">{output.path.join(' → ')}</span>
              </p>
              <p>
                <span className="text-[var(--text-secondary)]">Total distance: </span>
                <span className="font-mono font-semibold text-[var(--path)]">{output.distance}</span>
              </p>
            </>
          ) : (
            <p className="text-[var(--error)]">No path from source to destination.</p>
          )}
          <p>
            <span className="text-[var(--text-secondary)]">Time: </span>
            <span className="font-mono font-medium text-[var(--accent)]">{output.timeMs.toFixed(2)} ms</span>
          </p>
        </div>
      )}
    </div>
  )
}
