import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const AUTO_DISCOVERED_TAG = 'auto-discovered'
const AUTO_SCREEN_PREFIX = '[auto-discovered] '

export type SyncKnowledgeRegistriesResult = {
  inserted: number
  updated: number
  totals: {
    features: number
    screens: number
    apis: number
    journeys: number
    services: number
    docs: number
  }
  sources: Record<string, number>
}

type TableInfo = { name: string; columns: string[] }

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function hasAutoTag(tags: string[] | null | undefined): boolean {
  return (tags ?? []).includes(AUTO_DISCOVERED_TAG)
}

function isAutoScreen(purpose: string | null | undefined): boolean {
  return (purpose ?? '').startsWith(AUTO_SCREEN_PREFIX)
}

function autoTags(source: string): string[] {
  return [AUTO_DISCOVERED_TAG, `source:${source}`]
}

function healthCriticality(score: number | null | undefined, errorCount: number | null | undefined): string {
  if ((errorCount ?? 0) > 10) return 'critical'
  if (score != null && score < 0.5) return 'high'
  if (score != null && score < 0.75) return 'medium'
  return 'medium'
}

function parseApiFromUrl(raw: string): { endpoint: string; method: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(trimmed, 'https://app.local')
    const path = url.pathname
    if (!path || path === '/') return null
    return { endpoint: path, method: 'GET' }
  } catch {
    if (trimmed.startsWith('/')) return { endpoint: trimmed.split('?')[0], method: 'GET' }
    return null
  }
}

function extractApisFromText(text: string): { endpoint: string; method: string }[] {
  const found: { endpoint: string; method: string }[] = []
  const re = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w\-./{}:]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    found.push({ method: m[1].toUpperCase(), endpoint: m[2] })
  }
  const pathRe = /\/api\/[\w\-./{}:]+/g
  let p: RegExpExecArray | null
  while ((p = pathRe.exec(text)) !== null) {
    found.push({ method: 'GET', endpoint: p[0] })
  }
  return found
}

function apiKey(endpoint: string, method: string): string {
  return `${method.toUpperCase()} ${endpoint}`
}

/** Upsert application knowledge registries from telemetry, AI analysis, and DB introspection. */
export async function syncKnowledgeRegistries(
  supabase: SupabaseClient,
  projectId: string,
): Promise<SyncKnowledgeRegistriesResult> {
  const { data: project } = await supabase
    .from('tenant_projects')
    .select('tenant_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project?.tenant_id) {
    throw new Error('Project not found')
  }

  const tenantId = project.tenant_id
  const sources: Record<string, number> = {}
  let inserted = 0
  let updated = 0
  const now = new Date().toISOString()

  const [
    { data: existingFeatures },
    { data: existingScreens },
    { data: existingApis },
    { data: existingJourneys },
    { data: existingServices },
    { data: existingDocs },
    { data: featureHealth },
    { data: userJourneys },
    { data: events },
    { data: pages },
    { data: perfMetrics },
    { data: dbConnectors },
    { data: investigations },
    { data: recommendations },
  ] = await Promise.all([
    supabase.from('feature_registry').select('id, name, tags').eq('project_id', projectId),
    supabase.from('screen_registry').select('id, name, purpose').eq('project_id', projectId),
    supabase.from('api_registry').select('id, endpoint, method, tags').eq('project_id', projectId),
    supabase.from('journey_registry').select('id, name, tags').eq('project_id', projectId),
    supabase.from('service_registry').select('id, name, tags').eq('project_id', projectId),
    supabase.from('knowledge_documents').select('id, title, tags').eq('project_id', projectId),
    supabase.from('feature_health').select('feature_name, health_score, error_count, trend, ai_summary').eq('project_id', projectId),
    supabase.from('user_journeys').select('id, journey_name, steps, drop_off_step, completed').eq('project_id', projectId).limit(50),
    supabase.from('events').select('screen_name, event_name, properties').eq('project_id', projectId).order('timestamp', { ascending: false }).limit(800),
    supabase.from('session_pages').select('page_path').eq('project_id', projectId).order('created_at', { ascending: false }).limit(400),
    supabase.from('performance_metrics').select('endpoint, metric_type, metadata').eq('project_id', projectId).not('endpoint', 'is', null).limit(200),
    supabase.from('database_connectors').select('engine, display_host, display_database, introspected_tables, status').eq('project_id', projectId),
    supabase.from('investigations').select('title, root_cause, technical_impact').eq('project_id', projectId).order('created_at', { ascending: false }).limit(30),
    supabase.from('recommendations').select('title, description, evidence').eq('project_id', projectId).order('created_at', { ascending: false }).limit(40),
  ])

  const featureByName = new Map((existingFeatures ?? []).map((f) => [norm(f.name), f]))
  const screenByName = new Map((existingScreens ?? []).map((s) => [norm(s.name), s as { id: string; name: string; purpose: string | null }]))
  const apiByKey = new Map((existingApis ?? []).map((a) => [apiKey(a.endpoint, a.method), a]))
  const journeyByName = new Map((existingJourneys ?? []).map((j) => [norm(j.name), j]))
  const serviceByName = new Map((existingServices ?? []).map((s) => [norm(s.name), s]))
  const docByTitle = new Map((existingDocs ?? []).map((d) => [norm(d.title), d]))

  // ── Features from AI feature health ───────────────────────────────────────
  for (const fh of featureHealth ?? []) {
    const name = String(fh.feature_name ?? '').trim()
    if (!name) continue
    const key = norm(name)
    const existing = featureByName.get(key)
    const row = {
      description: fh.ai_summary ?? `Health ${Math.round((fh.health_score ?? 0) * 100)}% (${fh.trend ?? 'stable'})`,
      criticality: healthCriticality(fh.health_score, fh.error_count),
      status: 'active',
      tags: autoTags('telemetry'),
      updated_at: now,
    }
    if (existing) {
      if (!hasAutoTag(existing.tags)) continue
      const { error } = await supabase.from('feature_registry').update(row).eq('id', existing.id)
      if (!error) updated++
    } else {
      const { data, error } = await supabase.from('feature_registry').insert({
        tenant_id: tenantId,
        project_id: projectId,
        name,
        business_purpose: 'Discovered from live usage and AI analysis',
        ...row,
      }).select('id, name, tags').single()
      if (!error && data) {
        featureByName.set(key, data)
        inserted++
      }
    }
  }
  sources.feature_health = featureHealth?.length ?? 0

  // ── Screens from events + session pages ─────────────────────────────────────
  const screenNames = new Set<string>()
  for (const e of events ?? []) {
    if (e.screen_name) screenNames.add(String(e.screen_name))
    const props = (e.properties ?? {}) as Record<string, unknown>
    if (typeof props.page === 'string') screenNames.add(props.page)
    if (typeof props.path === 'string') screenNames.add(props.path)
  }
  for (const p of pages ?? []) {
    if (p.page_path) screenNames.add(String(p.page_path))
  }

  for (const name of screenNames) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const key = norm(trimmed)
    const existing = screenByName.get(key)
    const row = {
      purpose: `${AUTO_SCREEN_PREFIX}Observed in live user sessions`,
      is_critical: false,
      updated_at: now,
    }
    if (existing) {
      if (!isAutoScreen(existing.purpose)) continue
      const { error } = await supabase.from('screen_registry').update(row).eq('id', existing.id)
      if (!error) updated++
    } else {
      const { data, error } = await supabase.from('screen_registry').insert({
        tenant_id: tenantId,
        project_id: projectId,
        name: trimmed.slice(0, 200),
        ...row,
      }).select('id, name, purpose').single()
      if (!error && data) {
        screenByName.set(key, data)
        inserted++
      }
    }
  }
  sources.telemetry_screens = screenNames.size

  // ── Journeys from AI user_journeys ──────────────────────────────────────────
  for (const uj of userJourneys ?? []) {
    const name = String(uj.journey_name ?? 'User journey').trim()
    if (!name) continue
    const key = norm(name)
    const existing = journeyByName.get(key)
    const steps = (uj.steps ?? []) as Record<string, unknown>[]
    const row = {
      description: uj.drop_off_step ? `Drop-off at: ${uj.drop_off_step}` : (uj.completed ? 'Completed flow' : null),
      steps,
      tags: autoTags('analyze'),
      updated_at: now,
    }
    if (existing) {
      if (!hasAutoTag(existing.tags)) continue
      const { error } = await supabase.from('journey_registry').update(row).eq('id', existing.id)
      if (!error) updated++
    } else {
      const { data, error } = await supabase.from('journey_registry').insert({
        tenant_id: tenantId,
        project_id: projectId,
        name,
        business_purpose: 'Discovered from session flow analysis',
        criticality: 'high',
        ...row,
      }).select('id, name, tags').single()
      if (!error && data) {
        journeyByName.set(key, data)
        inserted++
      }
    }
  }
  sources.user_journeys = userJourneys?.length ?? 0

  // ── APIs from performance metrics, events, investigations ───────────────────
  const apiCandidates = new Map<string, { endpoint: string; method: string; purpose: string }>()

  for (const pm of perfMetrics ?? []) {
    if (!pm.endpoint) continue
    const parsed = parseApiFromUrl(String(pm.endpoint))
    if (!parsed) continue
    const k = apiKey(parsed.endpoint, parsed.method)
    apiCandidates.set(k, {
      ...parsed,
      purpose: `Observed via performance telemetry (${pm.metric_type ?? 'metric'})`,
    })
  }

  for (const e of events ?? []) {
    const props = (e.properties ?? {}) as Record<string, unknown>
    for (const field of ['url', 'endpoint', 'path', 'api']) {
      const val = props[field]
      if (typeof val !== 'string') continue
      const parsed = parseApiFromUrl(val)
      if (!parsed) continue
      const k = apiKey(parsed.endpoint, parsed.method)
      apiCandidates.set(k, { ...parsed, purpose: `Observed in event: ${e.event_name}` })
    }
    if (typeof e.event_name === 'string' && e.event_name.toLowerCase().includes('api')) {
      const parsed = parseApiFromUrl(e.event_name)
      if (parsed) {
        const k = apiKey(parsed.endpoint, parsed.method)
        apiCandidates.set(k, { ...parsed, purpose: 'Inferred from event name' })
      }
    }
  }

  for (const inv of investigations ?? []) {
    const text = [inv.root_cause, inv.technical_impact, inv.title].filter(Boolean).join(' ')
    for (const api of extractApisFromText(text)) {
      const k = apiKey(api.endpoint, api.method)
      apiCandidates.set(k, { ...api, purpose: 'Referenced in investigation' })
    }
  }

  for (const rec of recommendations ?? []) {
    const evidence = rec.evidence as Record<string, unknown> | null
    const text = [rec.title, rec.description, JSON.stringify(evidence ?? {})].join(' ')
    for (const api of extractApisFromText(text)) {
      const k = apiKey(api.endpoint, api.method)
      apiCandidates.set(k, { ...api, purpose: 'Referenced in AI recommendation' })
    }
  }

  for (const [, api] of apiCandidates) {
    const k = apiKey(api.endpoint, api.method)
    const existing = apiByKey.get(k)
    const row = {
      purpose: api.purpose,
      criticality: 'medium',
      tags: autoTags('telemetry'),
      updated_at: now,
    }
    if (existing) {
      if (!hasAutoTag(existing.tags)) continue
      const { error } = await supabase.from('api_registry').update(row).eq('id', existing.id)
      if (!error) updated++
    } else {
      const { data, error } = await supabase.from('api_registry').insert({
        tenant_id: tenantId,
        project_id: projectId,
        endpoint: api.endpoint.slice(0, 500),
        method: api.method,
        requires_auth: true,
        ...row,
      }).select('id, endpoint, method, tags').single()
      if (!error && data) {
        apiByKey.set(k, data)
        inserted++
      }
    }
  }
  sources.apis_discovered = apiCandidates.size

  // ── Services + schema doc from database connector ───────────────────────────
  for (const db of dbConnectors ?? []) {
    if (db.status !== 'connected') continue
    const engine = String(db.engine ?? 'database')
    const dbName = db.display_database ?? 'primary'
    const host = db.display_host ?? 'connected'
    const serviceName = `${engine} — ${dbName}`
    const key = norm(serviceName)
    const tables = (db.introspected_tables ?? []) as TableInfo[]
    const tableNames = tables.map((t) => t.name).filter(Boolean)

    const existingSvc = serviceByName.get(key)
    const svcRow = {
      description: `Connected database at ${host}. ${tableNames.length} tables introspected.`,
      service_type: 'internal',
      database: dbName,
      criticality: 'critical',
      dependencies: tableNames.slice(0, 20),
      tags: autoTags('database'),
      updated_at: now,
    }
    if (existingSvc) {
      if (!hasAutoTag(existingSvc.tags)) continue
      const { error } = await supabase.from('service_registry').update(svcRow).eq('id', existingSvc.id)
      if (!error) updated++
    } else {
      const { data, error } = await supabase.from('service_registry').insert({
        tenant_id: tenantId,
        project_id: projectId,
        name: serviceName,
        status: 'healthy',
        ...svcRow,
      }).select('id, name, tags').single()
      if (!error && data) {
        serviceByName.set(key, data)
        inserted++
      }
    }

    const docTitle = `Database Schema — ${engine} (${dbName})`
    const docKey = norm(docTitle)
    const schemaMd = tables.length === 0
      ? 'No tables were introspected yet. Re-test the database connection to refresh schema.'
      : tables.map((t) => {
          const cols = (t.columns ?? []).join(', ')
          return `### ${t.name}\n${cols ? `Columns: ${cols}` : '_No columns listed_'}\n`
        }).join('\n')
    const docContent = `# ${docTitle}\n\nAuto-generated from read-only database introspection.\n\n${schemaMd}`

    const existingDoc = docByTitle.get(docKey)
    const docRow = {
      content: docContent,
      doc_type: 'architecture',
      content_format: 'markdown',
      source: `database_connector:${engine}`,
      tags: autoTags('database'),
      ai_summary: `${tableNames.length} tables across ${engine} at ${host}`,
      ai_processed: true,
      updated_at: now,
    }
    if (existingDoc) {
      if (!hasAutoTag(existingDoc.tags)) continue
      const { error } = await supabase.from('knowledge_documents').update(docRow).eq('id', existingDoc.id)
      if (!error) updated++
    } else {
      const { data, error } = await supabase.from('knowledge_documents').insert({
        tenant_id: tenantId,
        project_id: projectId,
        title: docTitle,
        ...docRow,
      }).select('id, title, tags').single()
      if (!error && data) {
        docByTitle.set(docKey, data)
        inserted++
      }
    }
  }
  sources.database_connectors = dbConnectors?.length ?? 0

  const [
    { count: featureCount },
    { count: screenCount },
    { count: apiCount },
    { count: journeyCount },
    { count: serviceCount },
    { count: docCount },
  ] = await Promise.all([
    supabase.from('feature_registry').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('screen_registry').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('api_registry').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('journey_registry').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('service_registry').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('knowledge_documents').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
  ])

  return {
    inserted,
    updated,
    totals: {
      features: featureCount ?? 0,
      screens: screenCount ?? 0,
      apis: apiCount ?? 0,
      journeys: journeyCount ?? 0,
      services: serviceCount ?? 0,
      docs: docCount ?? 0,
    },
    sources,
  }
}
