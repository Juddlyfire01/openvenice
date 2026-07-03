import { useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge as FlowEdge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useXIntelStore } from '../../stores/x-intel-store'
import { useXAuthStore } from '../../stores/x-intel-auth-store'
import { runGather } from '../../lib/x-intel/orchestrate'
import type { Edge } from '../../lib/x-intel/types'
import { cn } from '../../lib/utils'

const KIND_COLORS: Record<Edge['kind'], string> = {
  mention: '#60a5fa',
  reply: '#34d399',
  quote: '#c084fc',
  retweet: '#fbbf24',
}

const KINDS: Edge['kind'][] = ['mention', 'reply', 'quote', 'retweet']

export function NetworkGraph() {
  const activeTarget = useXIntelStore((s) => s.activeTarget)
  const report = useXIntelStore((s) => (s.activeTarget ? s.reports[s.activeTarget] : undefined))
  const addTarget = useXIntelStore((s) => s.addTarget)
  const bearerToken = useXAuthStore((s) => s.bearerToken)
  const [kindFilter, setKindFilter] = useState<Set<Edge['kind']>>(new Set(KINDS))
  const [minWeight, setMinWeight] = useState(1)

  const edges = useMemo(
    () => (report?.edges ?? []).filter((e) => kindFilter.has(e.kind) && e.weight >= minWeight),
    [report?.edges, kindFilter, minWeight],
  )

  const { nodes, flowEdges } = useMemo(() => {
    if (!report?.profile) return { nodes: [] as Node[], flowEdges: [] as FlowEdge[] }

    const maxWeight = Math.max(1, ...edges.map((e) => e.weight))
    const nodes: Node[] = [{
      id: report.profile.id,
      position: { x: 0, y: 0 },
      data: { label: `@${report.profile.username}` },
      style: { background: '#fff', color: '#000', fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '6px 14px', border: 'none' },
    }]

    // circular layout around the pinned-center target
    // De-duplicate node IDs: the same target can appear across multiple edge kinds
    const placed = new Set<string>([report.profile.id])
    let placedCount = 0
    edges.forEach((e) => {
      if (placed.has(e.target)) return // node already placed; edge still wires to it
      placed.add(e.target)
      const angle = (2 * Math.PI * placedCount) / edges.length
      const radius = 260
      const size = 10 + (e.weight / maxWeight) * 16
      nodes.push({
        id: e.target,
        position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
        data: { label: e.targetUsername ? `@${e.targetUsername}` : `unknown (${e.target.slice(0, 12)}…)` },
        style: {
          background: '#0e0e0e', color: 'rgba(255,255,255,0.6)', fontSize: size,
          borderRadius: 999, padding: '4px 10px', border: `1px solid ${KIND_COLORS[e.kind]}55`,
        },
      })
      placedCount++
    })

    const flowEdges: FlowEdge[] = edges.map((e) => ({
      id: `${e.kind}-${e.target}`,
      source: report.profile!.id,
      target: e.target,
      label: `${e.kind} × ${e.weight}`,
      style: { stroke: KIND_COLORS[e.kind], strokeWidth: Math.min(1 + e.weight, 6), opacity: 0.6 },
      labelStyle: { fill: 'rgba(255,255,255,0.35)', fontSize: 9 },
    }))

    return { nodes, flowEdges }
  }, [report?.profile, edges])

  if (!activeTarget || !report?.profile) {
    return <div className="flex items-center justify-center h-full text-[12px] text-white/15">No target selected or no profile gathered</div>
  }

  const unresolved = (report.edges ?? []).filter((e) => !e.targetUsername && e.target.startsWith('post:'))

  const onNodeClick = (_: unknown, node: Node) => {
    const label = String(node.data.label)
    if (!label.startsWith('@') || node.id === report.profile!.id) return
    const username = label.slice(1)
    if (!bearerToken) {
      alert('Set your X API key (header → X Key) to add new targets from the network graph.')
      return
    }
    if (confirm(`Add @${username} as a new intel target?`)) {
      addTarget(username)
      runGather(username).catch(() => { /* surfaced in target rail */ })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.04] text-[10px]">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter((s) => {
              const next = new Set(s)
              if (next.has(k)) next.delete(k); else next.add(k)
              return next
            })}
            className={cn(
              'px-2 py-[2px] rounded-full font-medium transition-all border',
              kindFilter.has(k) ? 'text-white/60' : 'text-white/15 opacity-50',
            )}
            style={{ borderColor: `${KIND_COLORS[k]}55` }}
          >
            {k}
          </button>
        ))}
        <label className="flex items-center gap-1 text-white/25 ml-2">
          weight ≥
          <input
            type="number" min={1} value={minWeight}
            onChange={(e) => setMinWeight(Math.max(1, Number(e.target.value)))}
            className="w-10 bg-[#0e0e0e] border border-white/[0.08] rounded px-1 py-px text-white/60 outline-none"
          />
        </label>
        <div className="flex-1" />
        {unresolved.length > 0 && (
          <span className="text-white/15">{unresolved.length} unresolved (quote/reply targets need a post lookup — future)</span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          onNodeClick={onNodeClick}
          fitView
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,0.04)" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
