import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { syncKnowledgeRegistries, type SyncKnowledgeRegistriesResult } from './knowledge-registry-engine.ts'

export type GraphNodeInput = {
  node_key: string
  node_type: string
  ref_id: string | null
  label: string
  description: string | null
  metadata: Record<string, unknown>
}

export type GraphEdgeInput = {
  source_key: string
  target_key: string
  relationship: string
  label: string | null
}

export type SyncKnowledgeGraphResult = {
  nodes: number
  edges: number
  sources: Record<string, number>
  registries?: SyncKnowledgeRegistriesResult
}

function nodeKey(type: string, id: string | null, label: string): string {
  return `${type}:${id ?? label}`
}

function addNode(
  map: Map<string, GraphNodeInput>,
  type: string,
  label: string,
  refId: string | null,
  description: string | null,
  metadata: Record<string, unknown> = {},
) {
  const trimmed = label.trim()
  if (!trimmed) return
  const key = nodeKey(type, refId, trimmed)
  if (!map.has(key)) {
    map.set(key, {
      node_key: key,
      node_type: type,
      ref_id: refId,
      label: trimmed.slice(0, 120),
      description,
      metadata,
    })
  }
}

function addEdge(
  edges: GraphEdgeInput[],
  nodeMap: Map<string, GraphNodeInput>,
  sourceKey: string,
  targetKey: string,
  relationship: string,
  label: string | null = null,
) {
  if (!nodeMap.has(sourceKey) || !nodeMap.has(targetKey) || sourceKey === targetKey) return
  const dup = edges.some((e) => e.source_key === sourceKey && e.target_key === targetKey && e.relationship === relationship)
  if (!dup) edges.push({ source_key: sourceKey, target_key: targetKey, relationship, label })
}

function findByName(nodeMap: Map<string, GraphNodeInput>, type: string, name: string): string | null {
  const trimmed = name.trim()
  for (const [key, node] of nodeMap) {
    if (node.node_type === type && node.label.toLowerCase() === trimmed.toLowerCase()) return key
  }
  // partial match for file paths / screen names
  for (const [key, node] of nodeMap) {
    if (node.node_type === type && (node.label.includes(trimmed) || trimmed.includes(node.label))) return key
  }
  return null
}

/** Build knowledge graph nodes + edges from registries and live telemetry. */
export async function buildKnowledgeGraph(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ nodes: GraphNodeInput[]; edges: GraphEdgeInput[]; sources: Record<string, number> }> {
  const sources: Record<string, number> = {}
  const nodeMap = new Map<string, GraphNodeInput>()
  const edges: GraphEdgeInput[] = []

  const [
    { data: features },
    { data: screens },
    { data: apis },
    { data: journeys },
    { data: services },
    { data: deployments },
    { data: teams },
    { data: docs },
    { data: featureHealth },
    { data: userJourneys },
    { data: events },
    { data: pages },
    { data: errors },
  ] = await Promise.all([
    supabase.from('feature_registry').select('*').eq('project_id', projectId),
    supabase.from('screen_registry').select('*').eq('project_id', projectId),
    supabase.from('api_registry').select('*').eq('project_id', projectId),
    supabase.from('journey_registry').select('*').eq('project_id', projectId),
    supabase.from('service_registry').select('*').eq('project_id', projectId),
    supabase.from('deployment_registry').select('*').eq('project_id', projectId).order('deployed_at', { ascending: false }).limit(20),
    supabase.from('team_registry').select('*').eq('project_id', projectId),
    supabase.from('knowledge_documents').select('id, title, doc_type, ai_summary').eq('project_id', projectId),
    supabase.from('feature_health').select('feature_name, health_score, trend, error_count').eq('project_id', projectId),
    supabase.from('user_journeys').select('id, journey_name, steps, drop_off_step').eq('project_id', projectId).limit(30),
    supabase.from('events').select('screen_name, event_name').eq('project_id', projectId).order('timestamp', { ascending: false }).limit(500),
    supabase.from('session_pages').select('page_path').eq('project_id', projectId).order('created_at', { ascending: false }).limit(300),
    supabase.from('errors').select('screen, error_type').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100),
  ])

  for (const f of features ?? []) {
    addNode(nodeMap, 'feature', f.name, f.id, f.description ?? f.business_purpose, { criticality: f.criticality, source: 'registry' })
    for (const dep of (f.dependencies ?? []) as string[]) {
      const depKey = findByName(nodeMap, 'feature', dep) ?? nodeKey('feature', null, dep)
      if (!nodeMap.has(depKey)) addNode(nodeMap, 'feature', dep, null, null, { source: 'inferred' })
      addEdge(edges, nodeMap, nodeKey('feature', f.id, f.name), depKey, 'depends-on')
    }
    if (f.owning_team) {
      const teamKey = nodeKey('team', null, f.owning_team)
      addNode(nodeMap, 'team', f.owning_team, null, null, { source: 'registry' })
      addEdge(edges, nodeMap, teamKey, nodeKey('feature', f.id, f.name), 'owns')
    }
  }
  sources.features = features?.length ?? 0

  for (const s of screens ?? []) {
    addNode(nodeMap, 'screen', s.name, s.id, s.purpose, { source: 'registry' })
    if (s.feature_id) {
      const feat = (features ?? []).find((f) => f.id === s.feature_id)
      if (feat) addEdge(edges, nodeMap, nodeKey('screen', s.id, s.name), nodeKey('feature', feat.id, feat.name), 'part-of')
    }
    for (const dep of (s.dependencies ?? []) as string[]) {
      const tgt = findByName(nodeMap, 'api', dep) ?? findByName(nodeMap, 'service', dep)
      if (tgt) addEdge(edges, nodeMap, nodeKey('screen', s.id, s.name), tgt, 'uses')
    }
  }
  sources.screens = screens?.length ?? 0

  for (const a of apis ?? []) {
    const label = `${a.method} ${a.endpoint}`
    addNode(nodeMap, 'api', label, a.id, a.purpose, { criticality: a.criticality, source: 'registry' })
    if (a.owning_service) {
      const svcKey = nodeKey('service', null, a.owning_service)
      addNode(nodeMap, 'service', a.owning_service, null, null, { source: 'inferred' })
      addEdge(edges, nodeMap, nodeKey('api', a.id, label), svcKey, 'calls')
    }
    for (const dep of (a.dependencies ?? []) as string[]) {
      const depKey = findByName(nodeMap, 'service', dep) ?? nodeKey('service', null, dep)
      addNode(nodeMap, 'service', dep, null, null, { source: 'inferred' })
      addEdge(edges, nodeMap, nodeKey('api', a.id, label), depKey, 'depends-on')
    }
  }
  sources.apis = apis?.length ?? 0

  for (const j of journeys ?? []) {
    addNode(nodeMap, 'journey', j.name, j.id, j.description ?? j.business_purpose, { criticality: j.criticality, source: 'registry' })
    const steps = (j.steps ?? []) as { screen?: string; action?: string }[]
    for (const step of steps) {
      if (!step.screen) continue
      const screenKey = nodeKey('screen', null, step.screen)
      addNode(nodeMap, 'screen', step.screen, null, step.action ?? null, { source: 'journey' })
      addEdge(edges, nodeMap, nodeKey('journey', j.id, j.name), screenKey, 'includes', step.action ?? 'step')
    }
  }
  sources.journeys = journeys?.length ?? 0

  for (const s of services ?? []) {
    addNode(nodeMap, 'service', s.name, s.id, s.description, { service_type: s.service_type, source: 'registry' })
    for (const dep of (s.dependencies ?? []) as string[]) {
      const depKey = findByName(nodeMap, 'service', dep) ?? nodeKey('service', null, dep)
      addNode(nodeMap, 'service', dep, null, null, { source: 'inferred' })
      addEdge(edges, nodeMap, nodeKey('service', s.id, s.name), depKey, 'depends-on')
    }
  }
  sources.services = services?.length ?? 0

  for (const d of deployments ?? []) {
    const label = `${d.version} (${d.environment})`
    addNode(nodeMap, 'deployment', label, d.id, d.release_notes, { status: d.status, source: 'registry' })
    for (const feat of (d.changed_features ?? []) as string[]) {
      const featName = feat.split('/').pop()?.replace(/\.[^.]+$/, '') ?? feat
      const featKey = findByName(nodeMap, 'feature', featName) ?? nodeKey('feature', null, featName)
      addNode(nodeMap, 'feature', featName, null, `Changed in ${d.version}`, { source: 'deployment' })
      addEdge(edges, nodeMap, nodeKey('deployment', d.id, label), featKey, 'deployed-in')
    }
    for (const svc of (d.changed_services ?? []) as string[]) {
      const svcKey = findByName(nodeMap, 'service', svc) ?? nodeKey('service', null, svc)
      addNode(nodeMap, 'service', svc, null, null, { source: 'deployment' })
      addEdge(edges, nodeMap, nodeKey('deployment', d.id, label), svcKey, 'deployed-in')
    }
  }
  sources.deployments = deployments?.length ?? 0

  for (const t of teams ?? []) {
    addNode(nodeMap, 'team', t.name, t.id, t.description, { source: 'registry' })
    for (const feat of (t.owned_features ?? []) as string[]) {
      const featKey = findByName(nodeMap, 'feature', feat) ?? nodeKey('feature', null, feat)
      addNode(nodeMap, 'feature', feat, null, null, { source: 'team' })
      addEdge(edges, nodeMap, nodeKey('team', t.id, t.name), featKey, 'owns')
    }
  }
  sources.teams = teams?.length ?? 0

  for (const doc of docs ?? []) {
    addNode(nodeMap, 'document', doc.title, doc.id, doc.ai_summary, { doc_type: doc.doc_type, source: 'registry' })
  }
  sources.documents = docs?.length ?? 0

  // Live telemetry — feature health from analyze
  for (const fh of featureHealth ?? []) {
    addNode(nodeMap, 'feature', fh.feature_name, null, `Health ${Math.round((fh.health_score ?? 0) * 100)}%`, {
      health_score: fh.health_score,
      trend: fh.trend,
      error_count: fh.error_count,
      source: 'telemetry',
    })
  }
  sources.telemetry_features = featureHealth?.length ?? 0

  // Live screens from events + session pages
  const screenNames = new Set<string>()
  for (const e of events ?? []) {
    if (e.screen_name) screenNames.add(String(e.screen_name))
  }
  for (const p of pages ?? []) {
    if (p.page_path) screenNames.add(String(p.page_path))
  }
  for (const name of screenNames) {
    addNode(nodeMap, 'screen', name, null, 'Observed in live sessions', { source: 'telemetry' })
  }
  sources.telemetry_screens = screenNames.size

  // User journeys from analyze
  for (const uj of userJourneys ?? []) {
    const name = uj.journey_name ?? 'User journey'
    addNode(nodeMap, 'journey', name, uj.id, null, { source: 'telemetry' })
    const steps = (uj.steps ?? []) as { screen?: string }[]
    for (const step of steps) {
      if (!step.screen) continue
      const screenKey = nodeKey('screen', null, step.screen)
      addNode(nodeMap, 'screen', step.screen, null, null, { source: 'telemetry' })
      addEdge(edges, nodeMap, nodeKey('journey', uj.id, name), screenKey, 'includes')
    }
    if (uj.drop_off_step) {
      const dropKey = findByName(nodeMap, 'screen', uj.drop_off_step)
      if (dropKey) addEdge(edges, nodeMap, nodeKey('journey', uj.id, name), dropKey, 'part-of', 'drop-off')
    }
  }
  sources.telemetry_journeys = userJourneys?.length ?? 0

  // Error hotspots → link screens to features
  const errorScreens = new Map<string, number>()
  for (const err of errors ?? []) {
    if (!err.screen) continue
    errorScreens.set(String(err.screen), (errorScreens.get(String(err.screen)) ?? 0) + 1)
  }
  for (const [screen, count] of errorScreens) {
    const screenKey = nodeKey('screen', null, screen)
    addNode(nodeMap, 'screen', screen, null, `${count} errors captured`, { error_count: count, source: 'telemetry' })
    const featKey = findByName(nodeMap, 'feature', screen)
    if (featKey) addEdge(edges, nodeMap, screenKey, featKey, 'part-of', 'errors')
  }

  return { nodes: [...nodeMap.values()], edges, sources }
}

/** Rebuild knowledge_nodes and knowledge_edges for a project. */
export async function syncKnowledgeGraph(
  supabase: SupabaseClient,
  projectId: string,
): Promise<SyncKnowledgeGraphResult> {
  let registries: SyncKnowledgeRegistriesResult | undefined
  try {
    registries = await syncKnowledgeRegistries(supabase, projectId)
  } catch {
    /* non-fatal — graph can still build from telemetry */
  }

  const { data: project } = await supabase
    .from('tenant_projects')
    .select('tenant_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project?.tenant_id) {
    throw new Error('Project not found')
  }

  const tenantId = project.tenant_id
  const { nodes, edges, sources } = await buildKnowledgeGraph(supabase, projectId)

  await supabase.from('knowledge_edges').delete().eq('project_id', projectId)
  await supabase.from('knowledge_nodes').delete().eq('project_id', projectId)

  if (nodes.length === 0) {
    return { nodes: 0, edges: 0, sources, registries }
  }

  // Layout: cluster by type on a circle
  const typeOrder = ['team', 'feature', 'screen', 'journey', 'api', 'service', 'deployment', 'document']
  const byType = new Map<string, GraphNodeInput[]>()
  for (const n of nodes) {
    const list = byType.get(n.node_type) ?? []
    list.push(n)
    byType.set(n.node_type, list)
  }

  const cx = 450
  const cy = 300
  const idByKey = new Map<string, string>()
  const rows: Record<string, unknown>[] = []
  let ring = 0

  for (const type of typeOrder) {
    const group = byType.get(type) ?? []
    if (group.length === 0) continue
    const radius = 120 + ring * 70
    group.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2
      const id = crypto.randomUUID()
      idByKey.set(node.node_key, id)
      rows.push({
        id,
        tenant_id: tenantId,
        project_id: projectId,
        node_type: node.node_type,
        ref_id: node.ref_id,
        label: node.label,
        description: node.description,
        metadata: { ...node.metadata, node_key: node.node_key },
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      })
    })
    ring++
  }

  const { error: nodeError } = await supabase.from('knowledge_nodes').insert(rows)
  if (nodeError) throw new Error(`Failed to insert nodes: ${nodeError.message}`)

  const edgeRows = edges
    .map((e) => {
      const sourceId = idByKey.get(e.source_key)
      const targetId = idByKey.get(e.target_key)
      if (!sourceId || !targetId) return null
      return {
        tenant_id: tenantId,
        project_id: projectId,
        source_id: sourceId,
        target_id: targetId,
        relationship: e.relationship,
        label: e.label,
      }
    })
    .filter(Boolean)

  if (edgeRows.length > 0) {
    const { error: edgeError } = await supabase.from('knowledge_edges').insert(edgeRows)
    if (edgeError) throw new Error(`Failed to insert edges: ${edgeError.message}`)
  }

  return { nodes: rows.length, edges: edgeRows.length, sources, registries }
}
