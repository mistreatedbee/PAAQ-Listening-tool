import Anthropic from 'npm:@anthropic-ai/sdk'

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

export type SessionSummaryResult =
  | { ok: true; narrative: string; confidence: number }
  | { ok: false; reason: string }

/**
 * Builds a natural-language narrative for one real session from its actual
 * captured pages/events/errors and asks Claude Haiku to summarize it — same
 * call shape as _shared/insights-engine.ts's runInsightsForProject, scoped to
 * a single session_id instead of a whole project's recent activity.
 */
export async function runSummaryForSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<SessionSummaryResult> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, project_id, started_at, ended_at, duration, outcome, platform, device_type, os_name, browser_name')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return { ok: false, reason: 'Session not found' }

  const [{ data: pages }, { data: events }, { data: errors }] = await Promise.all([
    supabase.from('session_pages').select('sequence, page_path, duration_ms, interaction_count, error_count')
      .eq('session_id', sessionId).order('sequence', { ascending: true }),
    supabase.from('events').select('event_name, event_category, screen_name, timestamp')
      .eq('session_id', sessionId).order('timestamp', { ascending: true }).limit(300),
    supabase.from('errors').select('error_type, message, severity, created_at')
      .eq('session_id', sessionId).order('created_at', { ascending: true }),
  ])

  const eventCount = events?.length ?? 0
  if (eventCount === 0 && (!pages || pages.length === 0)) {
    return { ok: false, reason: 'Not enough session data yet to generate a summary.' }
  }

  const summary = {
    session: {
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationSeconds: session.duration,
      outcome: session.outcome,
      platform: session.platform,
      device: session.device_type,
      os: session.os_name,
      browser: session.browser_name,
    },
    pages: (pages ?? []).map((p: Record<string, unknown>) => ({
      sequence: p.sequence,
      path: p.page_path,
      durationMs: p.duration_ms,
      interactions: p.interaction_count,
      errors: p.error_count,
    })),
    eventCount,
    errors: (errors ?? []).map((e: Record<string, unknown>) => ({
      type: e.error_type,
      message: e.message,
      severity: e.severity,
      at: e.created_at,
    })),
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return { ok: false, reason: 'ANTHROPIC_API_KEY secret not set in Supabase' }

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `You are an AI analyst for PAAQ, a product-analytics platform. Summarize this real user session in plain language for an engineer or product manager. Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.

Session data:
${JSON.stringify(summary, null, 2)}

Return JSON:
{
  "narrative": "2-4 sentences describing what the user actually did, referencing real page names, counts, and errors from the data. State the outcome plainly.",
  "confidence": 0.85
}

Rules:
- Reference actual page names, counts, and error messages from the data — never generic filler.
- confidence is 0.0-1.0 based on how much data you have (few events/pages = lower confidence).
- If there are errors, mention whether they appear connected to the session's outcome.`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') return { ok: false, reason: 'No text response from AI' }

  const text = content.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  let parsed: { narrative?: string; confidence?: number }
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'Failed to parse AI response' }
  }

  if (!parsed.narrative) return { ok: false, reason: 'AI response missing narrative' }
  const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5

  const { error } = await supabase.from('session_ai_summaries').upsert(
    {
      project_id: session.project_id,
      session_id: sessionId,
      narrative: parsed.narrative,
      confidence,
      input_event_count: eventCount,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' },
  )

  if (error) return { ok: false, reason: error.message }
  return { ok: true, narrative: parsed.narrative, confidence }
}
