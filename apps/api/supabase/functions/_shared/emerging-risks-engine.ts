import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type EmergingRisk = {
  risk_key: string
  title: string
  description: string
  impact_summary: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export type SyncEmergingRisksResult = {
  detected: number
  upserted: number
  resolved: number
}

function aggregateBy(arr: Record<string, unknown>[], key: string) {
  const counts: Record<string, number> = {}
  for (const item of arr) {
    const val = String(item[key] ?? 'unknown')
    counts[val] = (counts[val] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }))
}

/** Derive emerging risks from live telemetry — no AI call required. */
export async function detectEmergingRisks(
  supabase: SupabaseClient,
  projectId: string,
): Promise<EmergingRisk[]> {
  const now = Date.now()
  const hourAgo = new Date(now - 3_600_000).toISOString()
  const twoHoursAgo = new Date(now - 7_200_000).toISOString()

  const [
    { data: errors },
    { data: sessions },
    { data: features },
    { data: anomalies },
    { data: insights },
    { data: perf },
  ] = await Promise.all([
    supabase.from('errors')
      .select('error_type, message, severity, status, screen, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('sessions')
      .select('status, outcome, rage_click_count, dead_click_count, form_abandon_count')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(200),
    supabase.from('feature_health')
      .select('feature_name, health_score, trend, error_count')
      .eq('project_id', projectId)
      .order('health_score', { ascending: true })
      .limit(10),
    supabase.from('anomaly_events')
      .select('type, severity, detected_pattern, confidence')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('ai_insights')
      .select('title, description, category, priority, recommendation, recommended_action, confidence')
      .eq('project_id', projectId)
      .in('priority', ['critical', 'high'])
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('performance_metrics')
      .select('metric_type, value, created_at')
      .eq('project_id', projectId)
      .eq('metric_type', 'response_time')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const risks: EmergingRisk[] = []
  const openErrors = (errors ?? []).filter((e) => e.status === 'open')
  const recentErrors = (errors ?? []).filter((e) => e.created_at >= hourAgo)
  const olderErrors = (errors ?? []).filter((e) => e.created_at < hourAgo && e.created_at >= twoHoursAgo)

  if (recentErrors.length > olderErrors.length * 1.5 && recentErrors.length > 2) {
    const pct = Math.round((recentErrors.length / Math.max(olderErrors.length, 1)) * 100)
    risks.push({
      risk_key: 'error_spike',
      title: 'Error rate spike detected',
      description: `${recentErrors.length} errors in the last hour vs ${olderErrors.length} in the prior hour (${pct}% increase).`,
      impact_summary: 'Users are hitting failures faster than baseline — likely to spread to more sessions if unresolved.',
      severity: recentErrors.length > 10 ? 'critical' : 'high',
    })
  }

  const totalSessions = sessions?.length ?? 0
  const abandoned = sessions?.filter((s) => s.status === 'abandoned').length ?? 0
  if (totalSessions > 5 && abandoned / totalSessions > 0.35) {
    const pct = Math.round((abandoned / totalSessions) * 100)
    risks.push({
      risk_key: 'session_abandonment',
      title: 'High session abandonment',
      description: `${abandoned} of ${totalSessions} recent sessions (${pct}%) were abandoned before completion.`,
      impact_summary: 'Drop-off is elevated — conversion and retention are at risk if the friction source is not fixed.',
      severity: pct > 60 ? 'critical' : 'high',
    })
  }

  const rageClicks = (sessions ?? []).reduce((a, s) => a + (s.rage_click_count ?? 0), 0)
  const deadClicks = (sessions ?? []).reduce((a, s) => a + (s.dead_click_count ?? 0), 0)
  if (rageClicks + deadClicks >= 5) {
    risks.push({
      risk_key: 'ux_friction',
      title: 'User frustration signals rising',
      description: `Captured ${rageClicks} rage clicks and ${deadClicks} dead clicks across recent sessions.`,
      impact_summary: 'Users are struggling with the UI — frustration often precedes churn and support tickets.',
      severity: rageClicks > 10 ? 'high' : 'medium',
    })
  }

  const topType = aggregateBy(openErrors, 'error_type')[0]
  if (topType && topType.count >= 2) {
    risks.push({
      risk_key: `error_type:${topType.name}`,
      title: `${topType.name} errors recurring`,
      description: `${topType.count} open ${topType.name} errors — same failure class affecting multiple users.`,
      impact_summary: 'A repeated error type indicates a systemic bug, not an isolated incident.',
      severity: topType.count >= 5 ? 'critical' : 'high',
    })
  }

  const topScreen = aggregateBy(openErrors.filter((e) => e.screen), 'screen')[0]
  if (topScreen && topScreen.count >= 2 && !risks.some((r) => r.risk_key === `screen:${topScreen.name}`)) {
    risks.push({
      risk_key: `screen:${topScreen.name}`,
      title: `Errors clustering on ${topScreen.name}`,
      description: `${topScreen.count} open errors on screen "${topScreen.name}".`,
      impact_summary: 'This screen is a hotspot — UX and reliability issues here block key user flows.',
      severity: topScreen.count >= 4 ? 'high' : 'medium',
    })
  }

  for (const f of features ?? []) {
    if (f.trend === 'declining' && (f.health_score ?? 1) < 0.6) {
      const key = `feature:${f.feature_name}`
      if (!risks.some((r) => r.risk_key === key)) {
        risks.push({
          risk_key: key,
          title: `${f.feature_name} health declining`,
          description: `Feature health at ${Math.round((f.health_score ?? 0) * 100)}% with ${f.error_count ?? 0} errors — trend is worsening.`,
          impact_summary: 'Usage may drop further as errors compound unless the root cause is addressed.',
          severity: (f.health_score ?? 1) < 0.4 ? 'critical' : 'high',
        })
      }
    }
  }

  const perfVals = (perf ?? []).map((p) => Number(p.value)).filter((v) => Number.isFinite(v))
  if (perfVals.length >= 5) {
    const avg = perfVals.reduce((a, b) => a + b, 0) / perfVals.length
    if (avg > 500) {
      risks.push({
        risk_key: 'performance_latency',
        title: 'API latency degrading',
        description: `Average response time ${Math.round(avg)}ms — above the 500ms user-noticeable threshold.`,
        impact_summary: 'Slow APIs cascade into timeouts, abandoned sessions, and error spikes.',
        severity: avg > 1000 ? 'critical' : 'high',
      })
    }
  }

  for (const a of anomalies ?? []) {
    const key = `anomaly:${a.type}`
    if (risks.some((r) => r.risk_key === key)) continue
    risks.push({
      risk_key: key,
      title: String(a.type ?? 'anomaly').replace(/_/g, ' '),
      description: String(a.detected_pattern ?? 'Anomalous pattern detected in live telemetry.'),
      impact_summary: 'Pattern detected automatically — investigate before it escalates to a full outage.',
      severity: a.severity === 'critical' ? 'critical' : 'high',
    })
  }

  for (const ins of insights ?? []) {
    const key = `insight:${String(ins.title ?? '').slice(0, 60)}`
    if (risks.some((r) => r.risk_key === key)) continue
    const action = ins.recommended_action ?? ins.recommendation
    risks.push({
      risk_key: key,
      title: String(ins.title ?? 'AI insight'),
      description: String(ins.description ?? ''),
      impact_summary: String(action ?? 'Review this AI finding and act before user impact grows.'),
      severity: ins.priority === 'critical' || ins.category === 'error' ? 'critical' : 'high',
    })
  }

  return risks.slice(0, 12)
}

/** Upsert auto-detected risks into incidents; resolve stale auto risks. */
export async function syncEmergingRisks(
  supabase: SupabaseClient,
  projectId: string,
): Promise<SyncEmergingRisksResult> {
  const risks = await detectEmergingRisks(supabase, projectId)
  const activeKeys = new Set(risks.map((r) => r.risk_key))

  let upserted = 0
  for (const risk of risks) {
    const { data: existing } = await supabase
      .from('incidents')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('risk_key', risk.risk_key)
      .maybeSingle()

    const row = {
      project_id: projectId,
      title: risk.title,
      description: risk.description,
      ai_summary: risk.impact_summary,
      impact_summary: risk.impact_summary,
      severity: risk.severity,
      status: existing?.status === 'resolved' ? 'monitoring' : (existing?.status ?? 'monitoring'),
      source: 'auto',
      risk_key: risk.risk_key,
    }

    if (existing?.id) {
      const { error } = await supabase.from('incidents').update(row).eq('id', existing.id)
      if (!error) upserted++
    } else {
      const { error } = await supabase.from('incidents').insert(row)
      if (!error) upserted++
    }
  }

  const { data: stale } = await supabase
    .from('incidents')
    .select('id, risk_key')
    .eq('project_id', projectId)
    .eq('source', 'auto')
    .neq('status', 'resolved')

  let resolved = 0
  for (const inc of stale ?? []) {
    if (inc.risk_key && !activeKeys.has(inc.risk_key)) {
      const { error } = await supabase
        .from('incidents')
        .update({ status: 'resolved', ai_summary: 'Signal cleared — risk no longer detected in telemetry.' })
        .eq('id', inc.id)
      if (!error) resolved++
    }
  }

  return { detected: risks.length, upserted, resolved }
}
