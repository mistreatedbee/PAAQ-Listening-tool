'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { KnowledgeNode, KnowledgeEdge, NodeType } from '@/lib/knowledge-types'
import { NODE_TYPE_COLOR } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { BrainCircuit, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react'

const NODE_RADIUS = 28
const NODE_TYPES: NodeType[] = ['feature', 'screen', 'api', 'service', 'journey', 'team', 'deployment', 'document']

type GraphNode = KnowledgeNode & { vx: number; vy: number; fx?: number; fy?: number }

function applyForces(nodes: GraphNode[], edges: KnowledgeEdge[], width: number, height: number) {
  const cx = width / 2
  const cy = height / 2
  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.5

  // Repulsion
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

  // Attraction along edges
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

  // Gravity to center
  for (const n of nodes) {
    n.vx += (cx - n.x) * 0.003
    n.vy += (cy - n.y) * 0.003
    n.x = Math.max(NODE_RADIUS + 10, Math.min(width - NODE_RADIUS - 10, n.x + n.vx))
    n.y = Math.max(NODE_RADIUS + 10, Math.min(height - NODE_RADIUS - 10, n.y + n.vy))
  }
}

export default function KnowledgeGraphPage() {
  const { app } = useConnectedApp()
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<KnowledgeEdge[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('knowledge_nodes').select('*').eq('project_id', app.id),
      sb.from('knowledge_edges').select('*').eq('project_id', app.id),
    ]).then(([{ data: n }, { data: e }]) => {
      const raw = (n ?? []) as KnowledgeNode[]
      const graphNodes: GraphNode[] = raw.map((node, i) => ({
        ...node,
        x: node.x || width / 2 + (Math.random() - 0.5) * 400,
        y: node.y || height / 2 + (Math.random() - 0.5) * 300,
        vx: 0, vy: 0,
      }))
      setNodes(graphNodes)
      setEdges((e ?? []) as KnowledgeEdge[])
      setLoading(false)
    })
  }, [app.id])

  // Force simulation
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
          <p className="text-sm text-muted-foreground mt-0.5">Visual map of your application's dependencies and relationships</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Node type filter */}
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
          </button>
        ))}
      </div>

      {/* Graph canvas */}
      <div className="relative overflow-hidden rounded-2xl border bg-muted/30" style={{ height: 600 }}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading knowledge graph…
          </div>
        ) : visibleNodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <BrainCircuit className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-semibold">No nodes yet</p>
              <p className="text-xs text-muted-foreground mt-1">Register features, APIs, and services to build the graph</p>
            </div>
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

            {/* Edges */}
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

            {/* Nodes */}
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

        {/* Selected node panel */}
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
            <p className="text-[10px] text-muted-foreground">
              {visibleEdges.filter((e) => e.source_id === selected.id || e.target_id === selected.id).length} connections
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border bg-card/80 backdrop-blur-sm px-3 py-2">
          <Info className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Drag nodes · Click to inspect</span>
        </div>
      </div>
    </div>
  )
}
