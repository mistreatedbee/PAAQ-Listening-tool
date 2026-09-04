'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import type { KnowledgeNode, KnowledgeEdge, NodeType } from '@/lib/knowledge-types'
import { NODE_TYPE_COLOR } from '@/lib/knowledge-types'
import {
  type GraphNode,
  seedRadialLayout,
  applyOrbitalForces,
  edgeCurvePath,
  pointOnQuad,
  curveControl,
} from '@/lib/knowledge-graph-physics'
import {
  GRAPH_VIEW_MODES,
  RELATIONSHIP_LABELS,
  VIEW_NODE_TYPES,
  type GraphViewMode,
} from '@/lib/knowledge-graph-labels'
import type { EdgeRelationship } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { BrainCircuit, ZoomIn, ZoomOut, RotateCcw, RefreshCw, Route, Rocket, GitBranch } from 'lucide-react'

const NODE_RADIUS = 26
const NODE_TYPES: NodeType[] = ['feature', 'screen', 'api', 'service', 'journey', 'team', 'deployment', 'document']
const DRAG_THRESHOLD_PX = 4
const RING_LABELS = ['Hub', 'Product', 'Experience', 'Platform', 'Ops', 'Ship']

async function syncGraph(projectId: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-knowledge-graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ project_id: projectId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Sync failed (${res.status})`)
  }
  return res.json() as Promise<{ nodes: number; edges: number }>
}

function neighborIds(nodeId: string, edges: KnowledgeEdge[]): Set<string> {
  const set = new Set<string>()
  for (const e of edges) {
    if (e.source_id === nodeId) set.add(e.target_id)
    if (e.target_id === nodeId) set.add(e.source_id)
  }
  return set
}

export default function KnowledgeGraphPage() {
  const { app } = useConnectedApp()
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<KnowledgeEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<{ nodes: number; edges: number } | null>(null)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [viewMode, setViewMode] = useState<GraphViewMode>('executive')
  const [focusNeighborhood, setFocusNeighborhood] = useState(true)
  const [typeFilter, setTypeFilter] = useState<Set<NodeType>>(new Set(VIEW_NODE_TYPES.executive))
  const [animFrame, setAnimFrame] = useState(0)
  const [size, setSize] = useState({ width: 1100, height: 640 })

  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<KnowledgeEdge[]>([])
  const animRef = useRef<number | null>(null)
  const frameRef = useRef(0)
  const dragIdRef = useRef<string | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const didDragRef = useRef(false)
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const lastTick = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 100 && height > 100) setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const loadGraph = useCallback(async (projectId: string, w: number, h: number) => {
    const sb = createClient()
    const [{ data: n }, { data: e }] = await Promise.all([
      sb.from('knowledge_nodes').select('*').eq('project_id', projectId),
      sb.from('knowledge_edges').select('*').eq('project_id', projectId),
    ])
    const raw = (n ?? []) as KnowledgeNode[]
    const edgeList = (e ?? []) as KnowledgeEdge[]
    const graphNodes = seedRadialLayout(raw, edgeList, w, h)
    nodesRef.current = graphNodes
    edgesRef.current = edgeList
    setNodes(graphNodes)
    setEdges(edgeList)
  }, [])

  const syncAndLoad = useCallback(async (projectId: string) => {
    setSyncError(null)
    setSyncing(true)
    try {
      const result = await syncGraph(projectId)
      setLastSync({ nodes: result.nodes, edges: result.edges })
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync graph')
    } finally {
      setSyncing(false)
    }
    await loadGraph(projectId, size.width, size.height)
    setLoading(false)
  }, [loadGraph, size.width, size.height])

  useEffect(() => {
    if (app.id === '__loading__') return
    setLoading(true)
    void loadGraph(app.id, size.width, size.height).finally(() => setLoading(false))
  }, [app.id, loadGraph, size.width, size.height])

  useEffect(() => {
    if (nodes.length === 0) return
    const { width, height } = size

    const loop = (now: number) => {
      if (now - lastTick.current >= 28) {
        lastTick.current = now
        frameRef.current += 1
        const next = nodesRef.current.map((n) => ({ ...n }))
        applyOrbitalForces(next, edgesRef.current, width, height, dragIdRef.current, frameRef.current)
        nodesRef.current = next
        setNodes(next)
        setAnimFrame(frameRef.current)
      }
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [nodes.length, edges.length, size.width, size.height])

  const applyViewMode = useCallback((mode: GraphViewMode) => {
    setViewMode(mode)
    setTypeFilter(new Set(VIEW_NODE_TYPES[mode]))
    setSelected(null)
  }, [])

  const visibleNodes = useMemo(() => {
    let list = nodes.filter((n) => typeFilter.has(n.node_type as NodeType))
    if (focusNeighborhood && selected) {
      const ids = neighborIds(selected.id, edges)
      ids.add(selected.id)
      list = list.filter((n) => ids.has(n.id))
    }
    return list
  }, [nodes, typeFilter, focusNeighborhood, selected, edges])

  const visibleEdges = edges.filter((e) =>
    visibleNodes.some((n) => n.id === e.source_id) && visibleNodes.some((n) => n.id === e.target_id),
  )

  const focusId = selected?.id ?? hovered
  const highlightIds = useMemo(() => {
    if (!focusId) return null
    const ids = neighborIds(focusId, visibleEdges)
    ids.add(focusId)
    return ids
  }, [focusId, visibleEdges])

  const selectedConnections = useMemo(() => {
    if (!selected) return []
    return visibleEdges
      .filter((e) => e.source_id === selected.id || e.target_id === selected.id)
      .map((e) => {
        const otherId = e.source_id === selected.id ? e.target_id : e.source_id
        const other = nodes.find((n) => n.id === otherId)
        const direction = e.source_id === selected.id ? 'out' : 'in'
        const rel = RELATIONSHIP_LABELS[e.relationship as EdgeRelationship] ?? e.relationship
        return {
          id: e.id,
          label: other?.label ?? 'Node',
          type: other?.node_type ?? 'feature',
          relationship: rel,
          direction,
          detail: e.label,
        }
      })
      .slice(0, 12)
  }, [selected, visibleEdges, nodes])

  const journeyFlow = useMemo(() => {
    if (!selected || selected.node_type !== 'journey') return []
    return visibleEdges
      .filter((e) => e.source_id === selected.id && e.relationship === 'includes')
      .map((e, i) => {
        const target = visibleNodes.find((n) => n.id === e.target_id)
        return { step: i + 1, label: target?.label ?? e.label ?? 'Step', edgeId: e.id }
      })
  }, [selected, visibleEdges, visibleNodes])

  const deploymentTimeline = useMemo(() => {
    return visibleNodes
      .filter((n) => n.node_type === 'deployment')
      .sort((a, b) => String(a.metadata?.deployed_at ?? a.created_at).localeCompare(String(b.metadata?.deployed_at ?? b.created_at)))
      .map((n, i) => ({
        order: i + 1,
        label: n.label,
        version: String(n.metadata?.version ?? n.label),
        at: String(n.metadata?.deployed_at ?? n.created_at).slice(0, 10),
        id: n.id,
      }))
  }, [visibleNodes])

  const typeCounts = NODE_TYPES.reduce((acc, t) => {
    acc[t] = nodes.filter((n) => n.node_type === t).length
    return acc
  }, {} as Record<NodeType, number>)

  const cx = size.width / 2
  const cy = size.height / 2
  const ringRadii = [0.1, 0.26, 0.34, 0.44, 0.56, 0.78].map((r) => r * Math.min(size.width, size.height) * 0.46)

  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation()
    dragIdRef.current = node.id
    didDragRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleCanvasMouseDown = () => {
    isPanning.current = true
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragIdRef.current) {
      const dx = (e.clientX - lastPos.current.x) / zoom
      const dy = (e.clientY - lastPos.current.y) / zoom
      if (Math.abs(e.clientX - dragStartRef.current.x) > DRAG_THRESHOLD_PX || Math.abs(e.clientY - dragStartRef.current.y) > DRAG_THRESHOLD_PX) {
        didDragRef.current = true
      }
      lastPos.current = { x: e.clientX, y: e.clientY }
      nodesRef.current = nodesRef.current.map((n) =>
        n.id === dragIdRef.current ? { ...n, x: n.x + dx, y: n.y + dy, vx: 0, vy: 0 } : n,
      )
      setNodes(nodesRef.current)
      return
    }
    if (isPanning.current) {
      setPan((p) => ({ x: p.x - e.movementX / zoom, y: p.y - e.movementY / zoom }))
    }
  }

  const handleMouseUp = () => {
    if (dragIdRef.current && !didDragRef.current) {
      const node = nodesRef.current.find((n) => n.id === dragIdRef.current)
      if (node) setSelected((s) => (s?.id === node.id ? null : node))
    }
    dragIdRef.current = null
    isPanning.current = false
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    const bare: KnowledgeNode[] = nodesRef.current.map(({ vx: _vx, vy: _vy, orbit: _o, ring: _r, mass: _m, ...n }) => n)
    const graphNodes = seedRadialLayout(bare, edgesRef.current, size.width, size.height)
    nodesRef.current = graphNodes
    setNodes(graphNodes)
  }

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes kg-orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes kg-hub-pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.03); }
        }
        @keyframes kg-flow {
          to { stroke-dashoffset: -28; }
        }
        .kg-edge-flow {
          stroke-dasharray: 8 6;
          animation: kg-flow 0.9s linear infinite;
        }
        .kg-hub-glow {
          animation: kg-hub-pulse 3s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-ai" />
            <h1 className="text-xl font-bold">Knowledge Graph</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            How your product fits together — features, user flows, and what shipped when
          </p>
          {!loading && nodes.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {visibleNodes.length} shown · {visibleEdges.length} relationships
              {lastSync ? ` · last rebuilt ${lastSync.nodes} entities` : ' · click Refresh to rebuild'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (app.id !== '__loading__') syncAndLoad(app.id) }}
            disabled={syncing || app.id === '__loading__'}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Refresh graph'}
          </button>
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 3))} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.35))} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={resetView} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {syncError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {syncError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {GRAPH_VIEW_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => applyViewMode(mode.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === mode.id ? 'border-ai/50 bg-ai/10 text-ai' : 'hover:bg-muted/50 text-muted-foreground'
            }`}
            title={mode.desc}
          >
            {mode.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFocusNeighborhood((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
            focusNeighborhood ? 'border-primary/40 bg-primary/10' : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          Focus on selection
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {NODE_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter((prev) => {
              const n = new Set(prev)
              n.has(t) ? n.delete(t) : n.add(t)
              return n
            })}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all capitalize"
            style={{
              background: typeFilter.has(t) ? NODE_TYPE_COLOR[t] + '18' : 'transparent',
              borderColor: typeFilter.has(t) ? NODE_TYPE_COLOR[t] + '50' : undefined,
              color: typeFilter.has(t) ? NODE_TYPE_COLOR[t] : undefined,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: NODE_TYPE_COLOR[t] }} />
            {t}
            {typeCounts[t] > 0 && <span className="opacity-70">({typeCounts[t]})</span>}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/40 via-background to-muted/20"
        style={{ height: 'min(72vh, 720px)', minHeight: 520 }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Building orbital knowledge graph…
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
            <BrainCircuit className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-semibold">No graph data yet</p>
            <Link href="/knowledge" className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              Open Knowledge Base
            </Link>
          </div>
        ) : visibleNodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-6">
            <p className="text-sm font-semibold">All node types filtered out</p>
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox={`${-pan.x} ${-pan.y} ${size.width / zoom} ${size.height / zoom}`}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-grab active:cursor-grabbing"
          >
            <defs>
              <radialGradient id="kg-center-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--color-ai, #51C9D3)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="currentColor" className="text-border" />
              </marker>
            </defs>

            <circle cx={cx} cy={cy} r={ringRadii[5] + 40} fill="url(#kg-center-glow)" className="kg-hub-glow" />

            {ringRadii.map((r, i) => (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.06 + i * 0.01}
                  strokeWidth={1}
                  strokeDasharray={i % 2 === 0 ? '4 8' : '1 0'}
                />
                <text
                  x={cx + r + 6}
                  y={cy - 4}
                  fontSize={9}
                  className="fill-muted-foreground"
                  opacity={0.5}
                >
                  {RING_LABELS[i]}
                </text>
              </g>
            ))}

            {visibleEdges.map((edge, ei) => {
              const src = visibleNodes.find((n) => n.id === edge.source_id)
              const tgt = visibleNodes.find((n) => n.id === edge.target_id)
              if (!src || !tgt) return null
              const lit = !highlightIds || (highlightIds.has(edge.source_id) && highlightIds.has(edge.target_id))
              const isFlow = edge.relationship === 'includes' || edge.relationship === 'part-of' || edge.relationship === 'calls'
              const path = edgeCurvePath(src.x, src.y, tgt.x, tgt.y, 0.15 + (ei % 3) * 0.04)
              const ctrl = curveControl(src.x, src.y, tgt.x, tgt.y, 0.15 + (ei % 3) * 0.04)
              const flowT = ((animFrame * 0.012 + ei * 0.17) % 1)
              const particle = pointOnQuad(src.x, src.y, ctrl.cx, ctrl.cy, tgt.x, tgt.y, flowT)
              const flowStep = journeyFlow.find((j) => j.edgeId === edge.id)?.step
              const mid = pointOnQuad(src.x, src.y, ctrl.cx, ctrl.cy, tgt.x, tgt.y, 0.5)

              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={lit ? 2.4 : 1}
                    strokeOpacity={highlightIds ? (lit ? 0.75 : 0.08) : 0.28}
                    markerEnd={lit ? 'url(#arrow)' : undefined}
                    className={`text-muted-foreground ${lit && isFlow ? 'kg-edge-flow' : ''}`}
                  />
                  {lit && isFlow && (
                    <circle r={3.5} cx={particle.x} cy={particle.y} fill="#51C9D3" opacity={0.9} />
                  )}
                  {lit && edge.label && (
                    <text x={mid.x} y={mid.y - 8} fontSize={8} textAnchor="middle" className="fill-muted-foreground">
                      {edge.label}
                    </text>
                  )}
                  {lit && flowStep != null && (
                    <g transform={`translate(${mid.x},${mid.y + 10})`}>
                      <circle r={9} fill="var(--background)" stroke="#51C9D3" strokeWidth={1.5} />
                      <text y={3} textAnchor="middle" fontSize={8} fontWeight="700" fill="#51C9D3">{flowStep}</text>
                    </g>
                  )}
                </g>
              )
            })}

            {visibleNodes.map((node) => {
              const color = NODE_TYPE_COLOR[node.node_type as NodeType] ?? '#8ba0b4'
              const isSelected = selected?.id === node.id
              const isHovered = hovered === node.id
              const lit = !highlightIds || highlightIds.has(node.id)
              const isHub = node.ring < 0.12
              const isDeploy = node.node_type === 'deployment'
              const deployOrder = deploymentTimeline.find((d) => d.id === node.id)?.order

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered((h) => (h === node.id ? null : h))}
                  className="cursor-pointer"
                  style={{ opacity: lit ? 1 : 0.22 }}
                  filter={isSelected || isHovered ? 'url(#glow)' : undefined}
                >
                  {isHub && (
                    <circle r={NODE_RADIUS + 14} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.35}
                      style={{ animation: `kg-orbit-spin ${14 + node.orbit * 4}s linear infinite` }}
                    />
                  )}
                  <circle
                    r={isSelected ? NODE_RADIUS + 3 : isHub ? NODE_RADIUS + 4 : NODE_RADIUS}
                    fill={color + (isHub ? '33' : '22')}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : isHovered ? 2.2 : 1.5}
                  />
                  <text y={4} textAnchor="middle" fontSize={8} fontWeight="700" fill={color}>
                    {node.node_type.slice(0, 3).toUpperCase()}
                  </text>
                  {isDeploy && deployOrder != null && (
                    <text y={-NODE_RADIUS - 6} textAnchor="middle" fontSize={8} fontWeight="700" fill={color}>
                      #{deployOrder}
                    </text>
                  )}
                  <text y={NODE_RADIUS + 14} textAnchor="middle" fontSize={10} fontWeight="500" className="fill-foreground">
                    {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                  </text>
                </g>
              )
            })}
          </svg>
        )}

        {/* Detail / timeline panel */}
        <div className="absolute right-4 top-4 w-64 rounded-xl border bg-card/95 backdrop-blur-md shadow-lg p-4 space-y-3 max-h-[85%] overflow-y-auto">
          {selected ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: NODE_TYPE_COLOR[selected.node_type as NodeType] }}>
                    {selected.node_type}
                  </span>
                  <p className="text-sm font-semibold mt-0.5">{selected.label}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">×</button>
              </div>
              {selected.description && <p className="text-xs text-muted-foreground">{selected.description}</p>}
              {selected.metadata?.health_score != null && (
                <p className="text-xs rounded-lg bg-muted/50 px-2 py-1">
                  Health: <span className="font-semibold">{Math.round(Number(selected.metadata.health_score) * 100)}%</span>
                  {selected.metadata.trend ? ` · ${String(selected.metadata.trend)}` : ''}
                </p>
              )}
              {selectedConnections.length > 0 && (
                <div className="space-y-1.5 border-t border-border/50 pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <GitBranch className="h-3 w-3" /> Connected to
                  </div>
                  <ul className="space-y-1">
                    {selectedConnections.map((c) => (
                      <li key={c.id} className="text-xs flex gap-2">
                        <span className="text-muted-foreground shrink-0">{c.direction === 'out' ? '→' : '←'}</span>
                        <span>
                          <span className="font-medium">{c.label}</span>
                          <span className="text-muted-foreground"> · {c.relationship}</span>
                          {c.detail && <span className="text-muted-foreground"> ({c.detail})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {journeyFlow.length > 0 && (
                <div className="space-y-1.5 border-t border-border/50 pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Route className="h-3 w-3" /> User flow
                  </div>
                  <ol className="space-y-1">
                    {journeyFlow.map((step) => (
                      <li key={step.edgeId} className="flex items-center gap-2 text-xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ai/15 text-[10px] font-bold text-ai">{step.step}</span>
                        <span>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                {selectedConnections.length} direct connection{selectedConnections.length === 1 ? '' : 's'} in this view
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <GitBranch className="h-3 w-3" /> Relationships
              </div>
              <p className="text-xs text-muted-foreground">
                Start with <strong className="font-semibold text-foreground">Executive</strong> view for a clean overview.
                Click any node to see what it connects to. Arrows show user flows and dependencies.
              </p>
              {deploymentTimeline.length > 0 && (
                <div className="space-y-1.5 border-t border-border/50 pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Rocket className="h-3 w-3" /> Deployment timeline
                  </div>
                  <ol className="space-y-1.5">
                    {deploymentTimeline.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 text-xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[10px] font-bold text-orange-400">
                          {d.order}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{d.version}</p>
                          <p className="text-[10px] text-muted-foreground">{d.at}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        <div className="absolute bottom-4 left-4 rounded-lg border bg-card/85 backdrop-blur-sm px-3 py-2 text-[10px] text-muted-foreground max-w-md">
          Executive view hides raw pages/APIs · Click a node to focus · Drag to rearrange · Refresh graph after new telemetry
        </div>
      </div>
    </div>
  )
}
