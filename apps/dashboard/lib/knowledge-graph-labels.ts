import type { EdgeRelationship, NodeType } from '@/lib/knowledge-types'

/** Turn raw telemetry paths into readable names for executives. */
export function humanizeGraphLabel(type: NodeType | string, raw: string): string {
  const label = (raw ?? '').trim()
  const lower = label.toLowerCase()
  if (!label || lower === 'unknown') {
    if (type === 'feature') return 'General app activity'
    if (type === 'screen') return 'Unmapped page'
    if (type === 'journey') return 'User flow'
    return 'Unlabeled'
  }

  if (type === 'api' && /^(GET|POST|PUT|PATCH|DELETE)\s/i.test(label)) {
    const [method, ...rest] = label.split(/\s+/)
    const path = rest.join(' ')
    const short = path.length > 28 ? `${path.slice(0, 26)}…` : path
    return `${method} ${short}`
  }

  if (label.includes('→')) {
    const parts = label.split('→').map((p) => humanizePathSegment(p.trim()))
    return parts.join(' → ')
  }

  if (label.startsWith('/') || label.includes('/')) {
    return humanizePathSegment(label)
  }

  return label.length > 36 ? `${label.slice(0, 34)}…` : label
}

function humanizePathSegment(path: string): string {
  const seg = path.split('/').filter(Boolean).pop() ?? path
  if (!seg) return 'Home'
  return seg
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export const RELATIONSHIP_LABELS: Record<EdgeRelationship, string> = {
  'depends-on': 'Depends on',
  'owns': 'Owned by',
  'uses': 'Uses',
  'calls': 'Calls',
  'includes': 'Flow step',
  'deployed-in': 'Shipped in release',
  'part-of': 'Part of',
}

export type GraphViewMode = 'executive' | 'product' | 'technical'

export const GRAPH_VIEW_MODES: { id: GraphViewMode; label: string; desc: string }[] = [
  { id: 'executive', label: 'Executive', desc: 'Features, flows & releases — best for stakeholders' },
  { id: 'product', label: 'Product', desc: 'Add screens users actually visit' },
  { id: 'technical', label: 'Technical', desc: 'Full map including APIs & services' },
]

export const VIEW_NODE_TYPES: Record<GraphViewMode, NodeType[]> = {
  executive: ['feature', 'journey', 'deployment', 'service'],
  product: ['feature', 'screen', 'journey', 'deployment'],
  technical: ['feature', 'screen', 'api', 'service', 'journey', 'team', 'deployment', 'document'],
}
