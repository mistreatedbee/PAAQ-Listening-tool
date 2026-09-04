import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type SyncProductMemoryResult = {
  inserted: number
  total: number
  by_type: Record<string, number>
}

type MemoryInsert = {
  project_id: string
  type: string
  title: string
  summary: string | null
  tags: string[]
  content: Record<string, unknown>
  created_at?: string
}

function sourceKey(content: Record<string, unknown> | null | undefined): string | null {
  if (!content?.source_table || !content?.source_id) return null
  return `${content.source_table}:${content.source_id}`
}

async function insertIfNew(
  supabase: SupabaseClient,
  seen: Set<string>,
  row: MemoryInsert,
): Promise<boolean> {
  const key = sourceKey(row.content)
  if (key && seen.has(key)) return false

  const { error } = await supabase.from('product_memory').insert(row)
  if (error) return false
  if (key) seen.add(key)
  return true
}

/** Backfill product_memory from investigations, recommendations, insights, and fix runs. */
export async function syncProductMemory(
  supabase: SupabaseClient,
  projectId: string,
): Promise<SyncProductMemoryResult> {
  const { data: existing } = await supabase
    .from('product_memory')
    .select('content')
    .eq('project_id', projectId)

  const seen = new Set<string>()
  for (const row of existing ?? []) {
    const key = sourceKey(row.content as Record<string, unknown>)
    if (key) seen.add(key)
  }

  let inserted = 0
  const byType: Record<string, number> = {}

  const [
    { data: investigations },
    { data: recommendations },
    { data: insights },
    { data: fixRuns },
    { data: deployments },
  ] = await Promise.all([
    supabase
      .from('investigations')
      .select('id, title, root_cause, business_impact, confidence, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('recommendations')
      .select('id, title, description, type, priority, root_cause, confidence, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('ai_insights')
      .select('id, title, description, category, priority, recommendation, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('fix_runs')
      .select('id, status, summary, confidence, recommendation_id, created_at, updated_at')
      .eq('project_id', projectId)
      .in('status', ['completed', 'failed'])
      .order('updated_at', { ascending: false })
      .limit(40),
    supabase
      .from('deployment_registry')
      .select('id, version, environment, ai_summary, ai_fix, deployed_at, status')
      .eq('project_id', projectId)
      .order('deployed_at', { ascending: false })
      .limit(30),
  ])

  for (const inv of investigations ?? []) {
    const ok = await insertIfNew(supabase, seen, {
      project_id: projectId,
      type: 'incident',
      title: String(inv.title).slice(0, 200),
      summary: inv.root_cause ?? inv.business_impact ?? null,
      tags: ['investigation', inv.status ?? 'completed'].filter(Boolean) as string[],
      content: {
        source_table: 'investigations',
        source_id: inv.id,
        confidence: inv.confidence,
        status: inv.status,
      },
      created_at: inv.created_at,
    })
    if (ok) { inserted++; byType.incident = (byType.incident ?? 0) + 1 }
  }

  for (const rec of recommendations ?? []) {
    const ok = await insertIfNew(supabase, seen, {
      project_id: projectId,
      type: 'fix',
      title: String(rec.title).slice(0, 200),
      summary: rec.description ?? rec.root_cause ?? null,
      tags: [rec.type, rec.priority].filter(Boolean) as string[],
      content: {
        source_table: 'recommendations',
        source_id: rec.id,
        confidence: rec.confidence,
      },
      created_at: rec.created_at,
    })
    if (ok) { inserted++; byType.fix = (byType.fix ?? 0) + 1 }
  }

  for (const ins of insights ?? []) {
    const ok = await insertIfNew(supabase, seen, {
      project_id: projectId,
      type: 'insight',
      title: String(ins.title).slice(0, 200),
      summary: ins.description ?? ins.recommendation ?? null,
      tags: [ins.category, ins.priority].filter(Boolean) as string[],
      content: {
        source_table: 'ai_insights',
        source_id: ins.id,
      },
      created_at: ins.created_at,
    })
    if (ok) { inserted++; byType.insight = (byType.insight ?? 0) + 1 }
  }

  for (const run of fixRuns ?? []) {
    const ok = await insertIfNew(supabase, seen, {
      project_id: projectId,
      type: run.status === 'completed' ? 'outcome' : 'fix',
      title: run.summary
        ? `AI fix ${run.status}: ${String(run.summary).slice(0, 120)}`
        : `AI fix run ${run.status}`,
      summary: run.summary ?? null,
      tags: ['agentic-fix', run.status],
      content: {
        source_table: 'fix_runs',
        source_id: run.id,
        recommendation_id: run.recommendation_id,
        confidence: run.confidence,
      },
      created_at: run.updated_at ?? run.created_at,
    })
    if (ok) {
      inserted++
      const t = run.status === 'completed' ? 'outcome' : 'fix'
      byType[t] = (byType[t] ?? 0) + 1
    }
  }

  for (const dep of deployments ?? []) {
    if (!dep.ai_summary && !dep.ai_fix) continue
    const ok = await insertIfNew(supabase, seen, {
      project_id: projectId,
      type: 'report',
      title: `Deploy ${dep.version ?? 'release'} (${dep.environment ?? 'prod'})`,
      summary: dep.ai_summary ?? `Deployment ${dep.status ?? 'recorded'}`,
      tags: ['deployment', dep.environment, dep.ai_fix ? 'ai-fix' : 'release'].filter(Boolean) as string[],
      content: {
        source_table: 'deployment_registry',
        source_id: dep.id,
        version: dep.version,
        status: dep.status,
      },
      created_at: dep.deployed_at,
    })
    if (ok) { inserted++; byType.report = (byType.report ?? 0) + 1 }
  }

  const { count } = await supabase
    .from('product_memory')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  return { inserted, total: count ?? 0, by_type: byType }
}

/** Write memory rows directly from freshly generated AI insights (analyze pipeline). */
export async function memoryFromInsights(
  supabase: SupabaseClient,
  projectId: string,
  insights: Array<{ id?: string; title: string; description?: string; category?: string; priority?: string }>,
): Promise<number> {
  let inserted = 0
  for (const ins of insights.slice(0, 12)) {
    const content: Record<string, unknown> = {
      source_table: 'ai_insights',
      source_id: ins.id ?? null,
      auto: true,
    }
    const { error } = await supabase.from('product_memory').insert({
      project_id: projectId,
      type: 'insight',
      title: String(ins.title).slice(0, 200),
      summary: ins.description ?? null,
      tags: [ins.category, ins.priority, 'ai-analysis'].filter(Boolean) as string[],
      content,
    })
    if (!error) inserted++
  }
  return inserted
}
