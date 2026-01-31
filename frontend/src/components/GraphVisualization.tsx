import { useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { Edge as GraphEdge } from '../engine/types'

const NODE_RADIUS = 24
const LAYOUT_RADIUS = 200

function layoutNodes(nodeIds: number[]): Map<number, { x: number; y: number }> {
  const map = new Map<number, { x: number; y: number }>()
  const n = nodeIds.length
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
    map.set(nodeIds[i]!, {
      x: LAYOUT_RADIUS + LAYOUT_RADIUS * Math.cos(angle),
      y: LAYOUT_RADIUS + LAYOUT_RADIUS * Math.sin(angle),
    })
  }
  return map
}

export interface GraphVisualizationProps {
  edges: GraphEdge[]
  pathNodeIds: Set<number>
  pathEdgeKeys: Set<string>
}

export function GraphVisualization({
  edges,
  pathNodeIds,
  pathEdgeKeys,
}: GraphVisualizationProps) {
  const nodeIds = useMemo(() => {
    const ids = new Set<number>()
    for (const e of edges) {
      ids.add(e.from)
      ids.add(e.to)
    }
    return Array.from(ids).sort((a, b) => a - b)
  }, [edges])

  const pathNodeIdsKey = [...pathNodeIds].sort().join(',')
  const pathEdgeKeysKey = [...pathEdgeKeys].sort().join(',')

  const stableNodes = useMemo(() => {
    const pos = layoutNodes(nodeIds)
    return nodeIds.map((id) => {
      const position = pos.get(id) ?? { x: 0, y: 0 }
      const onPath = pathNodeIds.has(id)
      return {
        id: String(id),
        type: 'default',
        position,
        data: { label: String(id) },
        style: {
          width: NODE_RADIUS * 2,
          height: NODE_RADIUS * 2,
          borderRadius: '50%',
          backgroundColor: onPath ? 'var(--path)' : 'var(--bg-elevated)',
          border: onPath ? '2px solid var(--path)' : '2px solid var(--border)',
          boxShadow: onPath ? '0 0 12px rgba(63, 185, 80, 0.4)' : '0 2px 6px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: onPath ? 600 : 500,
          color: onPath ? '#fff' : 'var(--text)',
        },
      } satisfies Node
    })
  }, [nodeIds, pathNodeIdsKey])

  const stableEdges = useMemo(
    () =>
      edges.map((e) => {
        const key = `${e.from}-${e.to}`
        const isPath = pathEdgeKeys.has(key)
        return {
          id: key,
          source: String(e.from),
          target: String(e.to),
          label: String(e.weight),
          labelBgStyle: { fill: 'var(--bg-card)' },
          labelStyle: { fill: 'var(--muted)', fontSize: 10 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          className: isPath ? 'path-edge' : undefined,
          style: { stroke: isPath ? 'var(--path)' : 'var(--border)', strokeWidth: isPath ? 3 : 2 },
        } satisfies Edge
      }),
    [edges, pathEdgeKeysKey],
  )

  const isEmpty = edges.length === 0

  return (
    <div className="card w-full h-full min-h-[240px] sm:min-h-[300px] md:min-h-[340px] overflow-hidden relative touch-pan-y touch-pan-x">
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-card)]/95 p-4">
          <div className="text-center max-w-[260px]">
            <p className="text-[var(--text-secondary)] text-sm font-medium mb-1">No edges yet</p>
            <p className="text-[var(--muted)] text-xs">
              Add edges in Graph Controls below to build your graph. Nodes and shortest path will appear here.
            </p>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={stableNodes}
        edges={stableEdges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={!isEmpty}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        panOnScroll
        panOnDrag
        zoomOnScroll
        zoomOnPinch
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--border)" />
        <Controls className="!bottom-2 sm:!bottom-3 !top-auto !left-2 sm:!left-3 !right-auto !flex" />
      </ReactFlow>
    </div>
  )
}
