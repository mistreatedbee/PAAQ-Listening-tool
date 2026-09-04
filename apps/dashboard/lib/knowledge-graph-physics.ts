import type { KnowledgeEdge, KnowledgeNode, NodeType } from '@/lib/knowledge-types'

export type GraphNode = KnowledgeNode & {
  vx: number
  vy: number
  orbit: number
  ring: number
  mass: number
}

const RING_RADIUS: Partial<Record<NodeType, number>> = {
  journey: 0.1,
  feature: 0.26,
  screen: 0.3,
  api: 0.4,
  service: 0.44,
  team: 0.54,
  document: 0.58,
  deployment: 0.78,
}

function degree(id: string, edges: KnowledgeEdge[]): number {
  let d = 0
  for (const e of edges) {
    if (e.source_id === id || e.target_id === id) d++
  }
  return d
}

/** Place nodes on concentric rings — journeys/features in the hub, deployments on the outer rim. */
export function seedRadialLayout(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  width: number,
  height: number,
): GraphNode[] {
  const cx = width / 2
  const cy = height / 2
  const base = Math.min(width, height) * 0.46

  const deployments = nodes
    .filter((n) => n.node_type === 'deployment')
    .sort((a, b) => {
      const ta = String(a.metadata?.deployed_at ?? a.created_at)
      const tb = String(b.metadata?.deployed_at ?? b.created_at)
      return ta.localeCompare(tb)
    })

  const hubs = nodes
    .filter((n) => n.node_type === 'journey' || n.node_type === 'feature')
    .sort((a, b) => degree(b.id, edges) - degree(a.id, edges))
    .slice(0, 4)

  const hubIds = new Set(hubs.map((h) => h.id))

  const byRing = new Map<number, KnowledgeNode[]>()
  for (const node of nodes) {
    let ring = RING_RADIUS[node.node_type as NodeType] ?? 0.5
    if (hubIds.has(node.id)) ring = 0.06 + hubs.findIndex((h) => h.id === node.id) * 0.02
    const bucket = Math.round(ring * 100)
    const list = byRing.get(bucket) ?? []
    list.push(node)
    byRing.set(bucket, list)
  }

  const result: GraphNode[] = []

  for (const [bucket, group] of byRing.entries()) {
    const ring = bucket / 100
    group.forEach((node, i) => {
      const isDeploy = node.node_type === 'deployment'
      const deployIdx = isDeploy ? deployments.findIndex((d) => d.id === node.id) : -1
      const angle = isDeploy && deployments.length > 0
        ? (deployIdx / deployments.length) * Math.PI * 2 - Math.PI / 2
        : (i / group.length) * Math.PI * 2 + ring * 1.7

      const jitter = (Math.random() - 0.5) * 0.04
      const r = base * (ring + jitter)

      result.push({
        ...node,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        orbit: 0.55 + (i % 7) * 0.11 + ring * 0.3,
        ring,
        mass: hubIds.has(node.id) ? 2.2 : isDeploy ? 1.4 : 1,
      })
    })
  }

  return result
}

export function applyOrbitalForces(
  nodes: GraphNode[],
  edges: KnowledgeEdge[],
  width: number,
  height: number,
  dragId: string | null,
  frame: number,
) {
  const cx = width / 2
  const cy = height / 2
  const base = Math.min(width, height) * 0.46
  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.55

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (n.id === dragId) continue
    n.vx = 0
    n.vy = 0

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue
      const m = nodes[j]
      const dx = n.x - m.x
      const dy = n.y - m.y
      const dist = Math.max(Math.hypot(dx, dy), 1)
      const repulse = (k * k) / dist
      n.vx += (dx / dist) * repulse * 0.065
      n.vy += (dy / dist) * repulse * 0.065
    }
  }

  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source_id)
    const target = nodes.find((n) => n.id === edge.target_id)
    if (!source || !target) continue
    const dx = target.x - source.x
    const dy = target.y - source.y
    const dist = Math.max(Math.hypot(dx, dy), 1)
    const pull = (dist * dist) / k * 0.028
    if (source.id !== dragId) {
      source.vx += (dx / dist) * pull
      source.vy += (dy / dist) * pull
    }
    if (target.id !== dragId) {
      target.vx -= (dx / dist) * pull
      target.vy -= (dy / dist) * pull
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (n.id === dragId) continue

    const dx = n.x - cx
    const dy = n.y - cy
    const dist = Math.hypot(dx, dy) || 1
    const angle = Math.atan2(dy, dx)
    const targetR = base * n.ring

    // Orbit — tangential drift so nodes continuously exchange positions on the ring
    const orbit = n.orbit * (1 + Math.sin(frame * 0.008 + i) * 0.15)
    n.vx += -Math.sin(angle) * orbit * 0.42
    n.vy += Math.cos(angle) * orbit * 0.42

    // Spring back to ring radius
    const radial = targetR - dist
    n.vx += Math.cos(angle) * radial * 0.055
    n.vy += Math.sin(angle) * radial * 0.055

    // Soft center gravity for hub stability
    n.vx += (cx - n.x) * 0.0012
    n.vy += (cy - n.y) * 0.0012

    // Organic wobble
    n.vx += Math.sin(frame * 0.022 + i * 0.9) * 0.35
    n.vy += Math.cos(frame * 0.019 + i * 0.6) * 0.35

    const speed = Math.hypot(n.vx, n.vy)
    const max = 4.2 / n.mass
    if (speed > max) {
      n.vx = (n.vx / speed) * max
      n.vy = (n.vy / speed) * max
    }

    const pad = 36
    n.x = Math.max(pad, Math.min(width - pad, n.x + n.vx))
    n.y = Math.max(pad, Math.min(height - pad, n.y + n.vy))
  }
}

export function edgeCurvePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  bend = 0.18,
): string {
  const mx = (sx + tx) / 2
  const my = (sy + ty) / 2
  const dx = tx - sx
  const dy = ty - sy
  const cx = mx - dy * bend
  const cy = my + dx * bend
  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`
}

export function pointOnQuad(
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t
  return {
    x: u * u * sx + 2 * u * t * cx + t * t * tx,
    y: u * u * sy + 2 * u * t * cy + t * t * ty,
  }
}

export function curveControl(sx: number, sy: number, tx: number, ty: number, bend = 0.18) {
  const mx = (sx + tx) / 2
  const my = (sy + ty) / 2
  const dx = tx - sx
  const dy = ty - sy
  return { cx: mx - dy * bend, cy: my + dx * bend }
}
