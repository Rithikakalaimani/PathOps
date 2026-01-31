import { useState } from 'react'

export interface GraphControlsProps {
  onAddEdge: (from: number, to: number, weight: number) => { success: boolean; message: string }
  onRemoveEdge: (from: number, to: number) => { success: boolean; message: string }
  onUpdateWeight: (from: number, to: number, weight: number) => { success: boolean; message: string }
  onResetGraph: () => void
}

export function GraphControls({
  onAddEdge,
  onRemoveEdge,
  onUpdateWeight,
  onResetGraph,
}: GraphControlsProps) {
  const [addFrom, setAddFrom] = useState('0')
  const [addTo, setAddTo] = useState('1')
  const [addWeight, setAddWeight] = useState('1')
  const [addFeedback, setAddFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const [remFrom, setRemFrom] = useState('0')
  const [remTo, setRemTo] = useState('1')
  const [remFeedback, setRemFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const [upFrom, setUpFrom] = useState('0')
  const [upTo, setUpTo] = useState('1')
  const [upWeight, setUpWeight] = useState('1')
  const [upFeedback, setUpFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const handleAdd = () => {
    const from = parseInt(addFrom, 10)
    const to = parseInt(addTo, 10)
    const weight = parseFloat(addWeight)
    if (Number.isNaN(from) || Number.isNaN(to) || Number.isNaN(weight)) {
      setAddFeedback({ type: 'err', msg: 'Invalid numbers' })
      return
    }
    const { success, message } = onAddEdge(from, to, weight)
    setAddFeedback({ type: success ? 'ok' : 'err', msg: message })
  }

  const handleRemove = () => {
    const from = parseInt(remFrom, 10)
    const to = parseInt(remTo, 10)
    if (Number.isNaN(from) || Number.isNaN(to)) {
      setRemFeedback({ type: 'err', msg: 'Invalid numbers' })
      return
    }
    const { success, message } = onRemoveEdge(from, to)
    setRemFeedback({ type: success ? 'ok' : 'err', msg: message })
  }

  const handleUpdate = () => {
    const from = parseInt(upFrom, 10)
    const to = parseInt(upTo, 10)
    const weight = parseFloat(upWeight)
    if (Number.isNaN(from) || Number.isNaN(to) || Number.isNaN(weight)) {
      setUpFeedback({ type: 'err', msg: 'Invalid numbers' })
      return
    }
    const { success, message } = onUpdateWeight(from, to, weight)
    setUpFeedback({ type: success ? 'ok' : 'err', msg: message })
  }

  const inputClass =
    'min-w-0 w-14 sm:w-16 px-2 sm:px-2.5 py-2 rounded-md bg-[var(--bg-panel)] border border-[var(--border)] text-sm font-mono text-[var(--text)] placeholder:text-[var(--muted)]'
  const inputWeightClass = 'min-w-0 w-16 sm:w-20 px-2 sm:px-2.5 py-2 rounded-md bg-[var(--bg-panel)] border border-[var(--border)] text-sm font-mono text-[var(--text)]'

  return (
    <div className="card flex flex-col gap-4 sm:gap-5 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="text-[var(--accent)] text-lg" aria-hidden>◇</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Graph Controls
        </h2>
      </div>

      {/* Add Edge */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">Add Edge (u, v, weight)</label>
        <div className="flex flex-wrap gap-2 items-end">
          <input type="number" min={0} value={addFrom} onChange={(e) => setAddFrom(e.target.value)} className={inputClass} placeholder="from" aria-label="From node" />
          <input type="number" min={0} value={addTo} onChange={(e) => setAddTo(e.target.value)} className={inputClass} placeholder="to" aria-label="To node" />
          <input type="number" min={0} step={0.1} value={addWeight} onChange={(e) => setAddWeight(e.target.value)} className={inputWeightClass} placeholder="w" aria-label="Weight" />
          <button type="button" onClick={handleAdd} className="btn-primary px-3 py-2.5 sm:py-2 rounded-md text-sm min-h-[44px] sm:min-h-0">
            Add
          </button>
        </div>
        {addFeedback && (
          <p className={`text-xs ${addFeedback.type === 'ok' ? 'text-[var(--path)]' : 'text-[var(--error)]'}`}>
            {addFeedback.msg}
          </p>
        )}
      </div>

      <hr className="border-[var(--border-subtle)]" />

      {/* Remove Edge */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">Remove Edge</label>
        <div className="flex flex-wrap gap-2 items-end">
          <input type="number" min={0} value={remFrom} onChange={(e) => setRemFrom(e.target.value)} className={inputClass} />
          <input type="number" min={0} value={remTo} onChange={(e) => setRemTo(e.target.value)} className={inputClass} />
          <button type="button" onClick={handleRemove} className="btn-primary px-3 py-2.5 sm:py-2 rounded-md text-sm min-h-[44px] sm:min-h-0">
            Remove
          </button>
        </div>
        {remFeedback && (
          <p className={`text-xs ${remFeedback.type === 'ok' ? 'text-[var(--path)]' : 'text-[var(--error)]'}`}>
            {remFeedback.msg}
          </p>
        )}
      </div>

      <hr className="border-[var(--border-subtle)]" />

      {/* Update Weight */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">Update Edge Weight</label>
        <div className="flex flex-wrap gap-2 items-end">
          <input type="number" min={0} value={upFrom} onChange={(e) => setUpFrom(e.target.value)} className={inputClass} />
          <input type="number" min={0} value={upTo} onChange={(e) => setUpTo(e.target.value)} className={inputClass} />
          <input type="number" min={0} step={0.1} value={upWeight} onChange={(e) => setUpWeight(e.target.value)} className={inputWeightClass} />
          <button type="button" onClick={handleUpdate} className="btn-primary px-3 py-2.5 sm:py-2 rounded-md text-sm min-h-[44px] sm:min-h-0">
            Update
          </button>
        </div>
        {upFeedback && (
          <p className={`text-xs ${upFeedback.type === 'ok' ? 'text-[var(--path)]' : 'text-[var(--error)]'}`}>
            {upFeedback.msg}
          </p>
        )}
      </div>

      <button type="button" onClick={onResetGraph} className="btn-ghost mt-1 px-3 py-2.5 sm:py-2 rounded-md text-sm transition-colors min-h-[44px] sm:min-h-0">
        Reset Graph
      </button>
    </div>
  )
}
