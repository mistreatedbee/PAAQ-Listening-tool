/**
 * PAAQ Intelligence — Generate Fix
 *
 * Accepts an error payload, sends it to the configured AI model, and returns a structured fix:
 *   rootCause, fix, codeExample, confidence, affectedArea, prevention
 */
import { getAiConfig, askModel, parseAiJson, AI_TOKEN_BUDGETS, DEFAULT_AI_MODEL } from '../_shared/ai.ts'

const FIX_MODELS = [DEFAULT_AI_MODEL]

function parseFixJson(raw: string): Record<string, unknown> | null {
  const parsed = parseAiJson(raw)
  if (!parsed || !hasRequiredFixFields(parsed)) return null
  return normalizeFixResult(parsed)
}

function hasRequiredFixFields(obj: Record<string, unknown>): boolean {
  const fix = obj.fix
  const fixOk = typeof fix === 'string'
    ? fix.length > 0
    : Array.isArray(fix) && fix.length > 0
  return typeof obj.rootCause === 'string' && fixOk && String(obj.rootCause).length > 0
}

function normalizeFixResult(obj: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(obj.fix)) {
    obj.fix = (obj.fix as unknown[]).map((step, i) => `${i + 1}. ${String(step)}`).join(' ')
  }
  return obj
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const aiConfig = getAiConfig()
  if (!aiConfig) return respond({ error: 'No AI API key configured. Set NVIDIA_API_KEY (or OPENROUTER_API_KEY) in Supabase secrets.' }, 500)

  let body: {
    errorId?: string
    message?: string
    errorType?: string
    severity?: string
    screen?: string
    stackTrace?: string
    context?: Record<string, unknown>
    precedingEvents?: { time: string; label: string }[]
    userIdentity?: { email?: string | null; externalUserId?: string | null } | null
  }

  try {
    body = await req.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, 400)
  }

  const { message, errorType, severity, screen, stackTrace, context, precedingEvents, userIdentity } = body

  if (!message) return respond({ error: 'message is required' }, 400)

  function cap(value: string, n: number): string {
    return value.length > n ? value.slice(0, n) : value
  }

  const contextBlock = context && Object.keys(context).length > 0
    ? `\nContext metadata:\n${Object.entries(context).map(([k, v]) => `  ${k}: ${String(v).slice(0, 500)}`).join('\n')}`
    : ''

  const stackBlock = stackTrace ? `\nStack trace:\n${stackTrace.slice(0, 2000)}` : ''

  // Real captured session context, when available — grounds "what happened"
  // in the actual sequence of real events leading to the error, instead of
  // the model inferring a plausible-sounding story from the message alone.
  const timelineBlock = precedingEvents?.length
    ? `\nReal events captured in this session immediately before the error, in order:\n${precedingEvents.map((e) => `  ${e.time}  ${cap(e.label, 300)}`).join('\n')}`
    : ''
  const userBlock = userIdentity?.email || userIdentity?.externalUserId
    ? `\nAffected user: ${cap(userIdentity.email ?? userIdentity.externalUserId ?? '', 500)}`
    : ''

  const prompt = `You are an incident investigator. Analyse this production error and return JSON only — no markdown.

Error: type=${errorType ?? 'unknown'}, severity=${severity ?? 'unknown'}, screen=${screen ?? 'unknown'}
Message: ${cap(message, 2000)}${stackBlock}${contextBlock}${userBlock}${timelineBlock}

Return JSON (codeExample must be null unless a one-liner is obvious):
{"rootCause":"one sentence","whatHappened":"1-2 sentences","fix":"2-4 numbered steps","codeExample":null,"language":"typescript|javascript|dart|null","confidence":0-100,"affectedArea":"module/screen","prevention":"one sentence","severity":"critical|high|medium|low"}

Keep every string field under 40 words. Output valid complete JSON only.`

  let raw: string | null = null
  let result: Record<string, unknown> | null = null
  let lastError = 'No response from AI'

  for (const model of FIX_MODELS) {
    try {
      raw = await askModel({ prompt, maxTokens: AI_TOKEN_BUDGETS.json, model, temperature: 0.2, nvidiaTimeoutMs: 55_000 })
      result = parseFixJson(raw)
      if (result) break
      lastError = 'Failed to parse AI response'
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  if (!result) {
    if (/AI error|OpenRouter|credits exhausted/i.test(lastError)) {
      return respond({ error: `AI error: ${lastError.replace(/^AI error:\s*/i, '')}` }, 500)
    }
    return respond({ error: lastError, raw }, 500)
  }

  return respond({ ok: true, fix: result })
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-api-key, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
