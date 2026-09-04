import { parseAiJson } from './ai.ts'

export type ParsedAnalysis = {
  insights: Record<string, unknown>[]
  feature_summaries: Record<string, unknown>[]
}

function stripFences(raw: string): string {
  return raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
}

function salvageTruncatedArray(raw: string): Record<string, unknown>[] {
  const start = raw.indexOf('[')
  if (start === -1) return []

  let slice = raw.slice(start).trimEnd()
  slice = slice.replace(/,\s*$/, '')

  let open = 0
  let inString = false
  let escaped = false
  for (const ch of slice) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (!inString) {
      if (ch === '[') open++
      if (ch === ']') open--
    }
  }
  if (inString) slice += '"'
  while (open > 0) { slice += ']'; open-- }

  try {
    const parsed = JSON.parse(slice)
    return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : []
  } catch {
    return []
  }
}

function insightsFromValue(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[]
  if (!value || typeof value !== 'object') return []
  const obj = value as Record<string, unknown>
  if (Array.isArray(obj.insights)) return obj.insights as Record<string, unknown>[]
  if (Array.isArray(obj.recommendations)) return obj.recommendations as Record<string, unknown>[]
  return []
}

/** Parses AI output whether it is a bare array, `{ insights: [] }`, or fenced JSON. */
export function parseInsightList(raw: string): Record<string, unknown>[] {
  const cleaned = stripFences(raw)
  if (!cleaned) return []

  try {
    const direct = JSON.parse(cleaned)
    const list = insightsFromValue(direct)
    if (list.length > 0) return list
  } catch { /* salvage */ }

  const obj = parseAiJson(cleaned)
  if (obj) {
    const fromObj = insightsFromValue(obj)
    if (fromObj.length > 0) return fromObj
  }

  return salvageTruncatedArray(cleaned)
}

export function parseAnalysisResponse(raw: string): ParsedAnalysis {
  const cleaned = stripFences(raw)
  if (!cleaned) return { insights: [], feature_summaries: [] }

  try {
    const direct = JSON.parse(cleaned)
    if (Array.isArray(direct)) {
      return { insights: direct as Record<string, unknown>[], feature_summaries: [] }
    }
    if (direct && typeof direct === 'object') {
      const obj = direct as Record<string, unknown>
      return {
        insights: Array.isArray(obj.insights) ? obj.insights as Record<string, unknown>[] : [],
        feature_summaries: Array.isArray(obj.feature_summaries)
          ? obj.feature_summaries as Record<string, unknown>[]
          : [],
      }
    }
  } catch { /* salvage */ }

  const obj = parseAiJson(cleaned)
  if (obj) {
    return {
      insights: Array.isArray(obj.insights) ? obj.insights as Record<string, unknown>[] : [],
      feature_summaries: Array.isArray(obj.feature_summaries)
        ? obj.feature_summaries as Record<string, unknown>[]
        : [],
    }
  }

  const salvaged = salvageTruncatedArray(cleaned)
  return { insights: salvaged, feature_summaries: [] }
}

export function normalizeInsightRow(
  ins: Record<string, unknown>,
  projectId: string,
): Record<string, unknown> | null {
  const title = String(ins.title ?? '').trim()
  if (!title) return null

  const rec = ins.recommended_action ?? ins.recommendation
  const confidence = typeof ins.confidence === 'number'
    ? Math.max(0, Math.min(1, ins.confidence))
    : 0.8

  return {
    project_id: projectId,
    category: String(ins.category ?? 'warning'),
    title: title.slice(0, 120),
    description: ins.description ?? '',
    confidence,
    recommendation: rec ?? null,
    recommended_action: rec ?? null,
    priority: ins.priority ?? 'medium',
    impact_score: typeof ins.impact_score === 'number' ? ins.impact_score : 0.5,
    affected_users: typeof ins.affected_users === 'number' ? ins.affected_users : 0,
    evidence: ins.evidence ?? {},
    status: 'active',
  }
}

/** Deterministic insights when the model returns unparseable output but telemetry has signal. */
export function fallbackInsightsFromTelemetry(
  projectId: string,
  summary: {
    errors?: {
      total?: number
      open?: number
      types?: { name: string; count: number }[]
      screens?: { name: string; count: number }[]
      byType?: { name: string; count: number }[]
      byScreen?: { name: string; count: number }[]
    }
    sessions?: { total?: number; abandoned?: number }
    behaviorFriction?: { totalRageClicks?: number; totalDeadClicks?: number; totalFormAbandons?: number }
    anomalies?: { type?: string; pattern?: string }[]
  },
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  for (const a of summary.anomalies ?? []) {
    const pattern = String(a.pattern ?? a.type ?? 'Anomaly detected')
    rows.push(normalizeInsightRow({
      category: 'warning',
      title: String(a.type ?? 'Anomaly').replace(/_/g, ' ').slice(0, 60),
      description: pattern,
      confidence: 0.85,
      recommendation: 'Review the affected sessions and errors tied to this pattern.',
      priority: 'high',
      impact_score: 0.7,
      affected_users: summary.sessions?.total ?? 0,
      evidence: { source: 'anomaly_detection', pattern },
    }, projectId)!)
  }

  const errorTypes = summary.errors?.types ?? summary.errors?.byType ?? []
  const errorScreens = summary.errors?.screens ?? summary.errors?.byScreen ?? []

  const topError = errorTypes[0]
  if (topError && topError.count > 0) {
    rows.push(normalizeInsightRow({
      category: 'error',
      title: `${topError.name} errors (${topError.count})`,
      description: `${topError.count} recent ${topError.name} errors were captured. ${summary.errors?.open ?? 0} remain open.`,
      confidence: 0.9,
      recommendation: 'Open the Errors view and run Generate Fix on the highest-severity item.',
      priority: (summary.errors?.open ?? 0) > 0 ? 'high' : 'medium',
      impact_score: 0.75,
      affected_users: summary.sessions?.total ?? 0,
      evidence: { error_type: topError.name, count: topError.count },
    }, projectId)!)
  }

  const topScreen = errorScreens[0]
  if (topScreen && topScreen.count > 0 && rows.length < 5) {
    rows.push(normalizeInsightRow({
      category: 'error',
      title: `Errors on ${topScreen.name}`,
      description: `${topScreen.count} errors occurred on screen "${topScreen.name}".`,
      confidence: 0.88,
      recommendation: `Inspect session replays and stack traces for ${topScreen.name}.`,
      priority: 'medium',
      impact_score: 0.65,
      affected_users: topScreen.count,
      evidence: { screen: topScreen.name, count: topScreen.count },
    }, projectId)!)
  }

  const total = summary.sessions?.total ?? 0
  const abandoned = summary.sessions?.abandoned ?? 0
  if (total > 5 && abandoned / total > 0.35 && rows.length < 5) {
    rows.push(normalizeInsightRow({
      category: 'warning',
      title: 'High session abandonment',
      description: `${abandoned} of ${total} sessions (${Math.round((abandoned / total) * 100)}%) were abandoned.`,
      confidence: 0.82,
      recommendation: 'Review User Journey drop-offs and friction signals (rage/dead clicks).',
      priority: 'high',
      impact_score: 0.7,
      affected_users: abandoned,
      evidence: { abandoned, total },
    }, projectId)!)
  }

  const friction = summary.behaviorFriction
  if (friction && (friction.totalRageClicks ?? 0) + (friction.totalDeadClicks ?? 0) > 3 && rows.length < 5) {
    rows.push(normalizeInsightRow({
      category: 'warning',
      title: 'User friction detected',
      description: `Captured ${friction.totalRageClicks ?? 0} rage clicks and ${friction.totalDeadClicks ?? 0} dead clicks.`,
      confidence: 0.8,
      recommendation: 'Check which screens have the highest click frustration in session analytics.',
      priority: 'medium',
      impact_score: 0.6,
      affected_users: total,
      evidence: { rage_clicks: friction.totalRageClicks, dead_clicks: friction.totalDeadClicks },
    }, projectId)!)
  }

  return rows.filter(Boolean)
}
