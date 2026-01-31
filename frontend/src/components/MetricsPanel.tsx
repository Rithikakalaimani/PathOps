import type { EngineMetrics } from '../engine/types'

export interface MetricsPanelProps {
  metrics: Readonly<EngineMetrics> | null
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) {
    return (
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[var(--accent)] text-lg" aria-hidden>▣</span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Metrics & Logs
          </h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Compute a path to see metrics.</p>
      </div>
    )
  }

  const heapOps = metrics.heapPushes + metrics.heapPolls
  const cacheTotal = metrics.cacheHits + metrics.cacheMisses
  const hitRate = cacheTotal > 0 ? ((metrics.cacheHits / cacheTotal) * 100).toFixed(1) : '0'
  const heapPushPopRatio =
    metrics.heapPolls > 0 ? (metrics.heapPushes / metrics.heapPolls).toFixed(2) : '—'
  const recomputationAvoidancePct =
    metrics.totalPathQueries > 0
      ? ((metrics.cacheHits / metrics.totalPathQueries) * 100).toFixed(1)
      : '0'
  const avgNodesRevisitedPerUpdate =
    metrics.edgeUpdateCount > 0
      ? (metrics.nodesProcessed / metrics.edgeUpdateCount).toFixed(1)
      : '—'

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <span className="text-[var(--accent)] text-lg" aria-hidden>▣</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Metrics & Logs
        </h2>
      </div>

      {/* Core algorithm metrics */}
      <div className="mb-4">
        <p className="text-xs font-medium text-[var(--muted)] mb-2 uppercase tracking-wider">
          Core
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-sm min-w-0">
          <MetricCard label="Nodes processed" value={metrics.nodesProcessed} accent />
          <MetricCard label="Heap ops" value={heapOps} sub={`push ${metrics.heapPushes} / poll ${metrics.heapPolls}`} accent />
          <MetricCard label="Heap push/pop ratio" value={heapPushPopRatio} title="Pushes ÷ polls" />
          <MetricCard label="Peak heap size" value={metrics.peakHeapSize} title="Max heap size last run" />
          <MetricCard label="Cache hits" value={metrics.cacheHits} success />
          <MetricCard label="Cache misses" value={metrics.cacheMisses} error />
          <MetricCard label="Hit rate" value={`${hitRate}%`} />
          <MetricCard label="Incremental vs full" value="" sub={`Inc: ${metrics.incrementalCount} / Full: ${metrics.fullRecomputeCount}`} />
        </div>
      </div>

      {/* Impact metrics */}
      <div>
        <p className="text-xs font-medium text-[var(--muted)] mb-2 uppercase tracking-wider">
          Impact
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-sm min-w-0">
          <MetricCard
            label="Recomputation avoidance"
            value={`${recomputationAvoidancePct}%`}
            title="% queries served from cache (no recompute)"
            accent
          />
          <MetricCard
            label="Affected subgraph size"
            value={metrics.lastRunAffectedNodes}
            title="Distinct nodes whose distance was updated in last run"
          />
          <MetricCard
            label="Avg nodes revisited / update"
            value={avgNodesRevisitedPerUpdate}
            title="Nodes processed ÷ edge updates"
          />
          <MetricCard label="Total path queries" value={metrics.totalPathQueries} />
          <MetricCard label="Last path length (edges)" value={metrics.lastPathLength} title="Edges in last shortest path" />
          <MetricCard label="Edge updates" value={metrics.edgeUpdateCount} title="Add/remove/weight changes" />
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  title,
  accent,
  success,
  error,
}: {
  label: string
  value: string | number
  sub?: string
  title?: string
  accent?: boolean
  success?: boolean
  error?: boolean
}) {
  const valueClass = accent
    ? 'text-[var(--accent)]'
    : success
      ? 'text-[var(--path)]'
      : error
        ? 'text-[var(--error)]'
        : 'text-[var(--text)]'
  return (
    <div
      className="p-2.5 sm:p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] hover:border-[var(--border)] transition-colors min-w-0"
      title={title}
    >
      <p className="text-[var(--text-secondary)] text-xs font-medium mb-0.5 truncate">{label}</p>
      <p className={`font-mono font-semibold text-base sm:text-lg truncate ${valueClass}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{sub}</p>}
    </div>
  )
}
