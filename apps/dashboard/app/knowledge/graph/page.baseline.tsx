/**
 * BASELINE SNAPSHOT — Knowledge Graph UI as of 2026-09-04 (commit 7b4beb5).
 * To revert enhanced animation/interaction changes, copy this file over page.tsx.
 */
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import type { KnowledgeNode, KnowledgeEdge, NodeType } from '@/lib/knowledge-types'
import { NODE_TYPE_COLOR } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { BrainCircuit, ZoomIn, ZoomOut, RotateCcw, Info, RefreshCw } from 'lucide-react'

const NODE_RADIUS = 28
const NODE_TYPES: NodeType[] = ['feature', 'screen', 'api', 'service', 'journey', 'team', 'deployment', 'document']

type GraphNode = KnowledgeNode & { vx: number; vy: number; fx?: number; fy?: number }

function applyForces(nodes: GraphNode[], edges: KnowledgeEdge[], width: number, height: number) {
  const cx = width / 2
  const cy = height / 2
  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.5

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].vx = 0
    nodes[i].vy = 0
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const force = (k * k) / dist
      nodes[i].vx += (dx / dist) * force * 0.05
      nodes[i].vy += (dy / dist) * force * 0.05
    }
  }

  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source_id)
    const target = nodes.find((n) => n.id === edge.target_id)
    if (!source || !target) continue
    const dx = target.x - source.x
    const dy = target.y - source.y
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
    const force = (dist * dist) / k * 0.02
    source.vx += (dx / dist) * force
    source.vy += (dy / dist) * force
    target.vx -= (dx / dist) * force
    target.vy -= (dy / dist) * force
  }

  for (const n of nodes) {
    n.vx += (cx - n.x) * 0.003
    n.vy += (cy - n.y) * 0.003
    n.x = Math.max(NODE_RADIUS + 10, Math.min(width - NODE_RADIUS - 10, n.x + n.vx))
    n.y = Math.max(NODE_RADIUS + 10, Math.min(height - NODE_RADIUS - 10, n.y + n.vy))
  }
}

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
  return res.json() as Promise<{ nodes: number; edges: number; sources?: Record<string, number> }>
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
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [typeFilter, setTypeFilter] = useState<Set<NodeType>>(new Set(NODE_TYPES))
  const svgRef = useRef<SVGSVGElement>(null)
  const animRef = useRef<number | null>(null)
  const isDragging = useRef(false)
  const dragNode = useRef<GraphNode | null>(null)
  const lastPos = useRef({ x: 0, y: 0 })

  const width = 900
  const height = 600

  const loadGraph = useCallback(async (projectId: string) => {
    const sb = createClient()
    const [{ data: n }, { data: e }] = await Promise.all([
      sb.from('knowledge_nodes').select('*').eq('project_id', projectId),
      sb.from('knowledge_edges').select('*').eq('project_id', projectId),
    ])
    const raw = (n ?? []) as KnowledgeNode[]
    const graphNodes: GraphNode[] = raw.map((node) => ({
      ...node,
      x: node.x || width / 2 + (Math.random() - 0.5) * 400,
      y: node.y || height / 2 + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0,
    }))
    setNodes(graphNodes)
    setEdges((e ?? []) as KnowledgeEdge[])
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
    await loadGraph(projectId)
    setLoading(false)
  }, [loadGraph])

  useEffect(() => {
    if (app.id === '__loading__') return
    setLoading(true)
    syncAndLoad(app.id)
  }, [app.id, syncAndLoad])

  const tick = useCallback(() => {
    setNodes((prev) => {
      if (prev.length === 0) return prev
      const next = prev.map((n) => ({ ...n }))
      applyForces(next, edges, width, height)
      return next
    })
    animRef.current = requestAnimationFrame(tick)
  }, [edges])

  useEffect(() => {
    if (nodes.length > 0) {
      animRef.current = requestAnimationFrame(tick)
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [nodes.length > 0, tick])

  const visibleNodes = nodes.filter((n) => typeFilter.has(n.node_type as NodeType))
  const visibleEdges = edges.filter((e) =>
    visibleNodes.some((n) => n.id === e.source_id) && visibleNodes.some((n) => n.id === e.target_id)
  )

  const typeCounts = NODE_TYPES.reduce((acc, t) => {
    acc[t] = nodes.filter((n) => n.node_type === t).length
    return acc
  }, {} as Record<NodeType, number>)

  const handleMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation()
    isDragging.current = true
    dragNode.current = node
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !dragNode.current) return
    const dx = (e.clientX - lastPos.current.x) / zoom
    const dy = (e.clientY - lastPos.current.y) / zoom
    lastPos.current = { x: e.clientX, y: e.clientY }
    setNodes((prev) => prev.map((n) => n.id === dragNode.current!.id ? { ...n, x: n.x + dx, y: n.y + dy } : n))
  }

  const handleMouseUp = () => { isDragging.current = false; dragNode.current = null }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-ai" />
            <h1 className="text-xl font-bold">Knowledge Graph</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visual map of features, screens, APIs, services, journeys, teams, deployments and documents
          </p>
          {!loading && nodes.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {nodes.length} nodes · {edges.length} relationships
              {lastSync ? ` · synced ${lastSync.nodes} entities` : ''}
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
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {syncError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {syncError}
        </div>
      )}

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
            {typeCounts[t] > 0 && (
              <span className="opacity-70">({typeCounts[t]})</span>
            )}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl border bg-muted/30" style={{ height: 600 }}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Building knowledge graph from registries and live telemetry…
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
            <BrainCircuit className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-semibold">No graph data yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                The graph is built from your knowledge registries plus live telemetry (sessions, events, deployments).
                Register features and APIs or run AI Analysis to populate it.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Link href="/knowledge" className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Open Knowledge Base
              </Link>
              <button
                onClick={() => syncAndLoad(app.id)}
                disabled={syncing}
                className="rounded-lg bg-ai/10 px-3 py-1.5 text-xs font-medium text-ai hover:bg-ai/20 disabled:opacity-50"
              >
                Try sync again
              </button>
            </div>
          </div>
        ) : visibleNodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-6">
            <p className="text-sm font-semibold">All node types filtered out</p>
            <p className="text-xs text-muted-foreground">Re-enable a type above to see the graph</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${-pan.x} ${-pan.y} ${width / zoom} ${height / zoom}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-grab active:cursor-grabbing"
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="currentColor" className="text-border" />
              </marker>
            </defs>

            {visibleEdges.map((edge) => {
              const src = visibleNodes.find((n) => n.id === edge.source_id)
              const tgt = visibleNodes.find((n) => n.id === edge.target_id)
              if (!src || !tgt) return null
              return (
                <g key={edge.id}>
                  <line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke="currentColor" strokeWidth={1.5} strokeOpacity={0.3}
                    markerEnd="url(#arrow)" className="text-muted-foreground"
                  />
                  {edge.label && (
                    <text x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 - 4}
                      className="fill-muted-foreground" fontSize={9} textAnchor="middle">
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {visibleNodes.map((node) => {
              const color = NODE_TYPE_COLOR[node.node_type as NodeType] ?? '#8ba0b4'
              const isSelected = selected?.id === node.id
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onMouseDown={(e) => handleMouseDown(e, node)}
                  onClick={() => setSelected(isSelected ? null : node)}
                  className="cursor-pointer"
                >
                  <circle r={NODE_RADIUS} fill={color + '18'} stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} />
                  <text y={4} textAnchor="middle" fontSize={9} fontWeight="600" fill={color}>
                    {node.node_type.slice(0, 3).toUpperCase()}
                  </text>
                  <text y={NODE_RADIUS + 14} textAnchor="middle" fontSize={10} fontWeight="500" className="fill-foreground">
                    {node.label.length > 14 ? node.label.slice(0, 13) + '…' : node.label}
                  </text>
                </g>
              )
            })}
          </svg>
        )}

        {selected && (
          <div className="absolute right-4 top-4 w-56 rounded-xl border bg-card shadow-lg p-4 space-y-2">
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
            {selected.description && (
              <p className="text-xs text-muted-foreground">{selected.description}</p>
            )}
            {(selected.metadata as { source?: string })?.source && (
              <p className="text-[10px] text-muted-foreground capitalize">
                Source: {(selected.metadata as { source: string }).source}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {visibleEdges.filter((e) => e.source_id === selected.id || e.target_id === selected.id).length} connections
            </p>
          </div>
        )}

        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border bg-card/80 backdrop-blur-sm px-3 py-2">
          <Info className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Drag nodes · Click to inspect · Auto-syncs on load</span>
        </div>
      </div>
    </div>
  )
}
