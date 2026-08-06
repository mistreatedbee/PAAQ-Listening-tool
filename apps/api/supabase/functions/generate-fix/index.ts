/**
 * PAAQ Intelligence — Generate Fix
 *
 * Accepts an error payload, sends it to Claude, and returns a structured fix:
 *   rootCause, fix, codeExample, confidence, affectedArea, prevention
 */
import Anthropic from 'npm:@anthropic-ai/sdk'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return respond({ error: 'ANTHROPIC_API_KEY not set' }, 500)

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

  const contextBlock = context && Object.keys(context).length > 0
    ? `\nContext metadata:\n${Object.entries(context).map(([k, v]) => `  ${k}: ${String(v)}`).join('\n')}`
    : ''

  const stackBlock = stackTrace ? `\nStack trace:\n${stackTrace.slice(0, 2000)}` : ''

  // Real captured session context, when available — grounds "what happened"
  // in the actual sequence of real events leading to the error, instead of
  // the model inferring a plausible-sounding story from the message alone.
  const timelineBlock = precedingEvents?.length
    ? `\nReal events captured in this session immediately before the error, in order:\n${precedingEvents.map((e) => `  ${e.time}  ${e.label}`).join('\n')}`
    : ''
  const userBlock = userIdentity?.email || userIdentity?.externalUserId
    ? `\nAffected user: ${userIdentity.email ?? userIdentity.externalUserId}`
    : ''

  const prompt = `You are the Incident Investigator AI agent for the PAAQ Intelligence. A production error has been captured. Analyse it and return a structured JSON fix — no markdown, no explanation, JSON only.

Error details:
  Type: ${errorType ?? 'unknown'}
  Severity: ${severity ?? 'unknown'}
  Screen / module: ${screen ?? 'unknown'}
  Message: ${message}${stackBlock}${contextBlock}${userBlock}${timelineBlock}

Return this exact JSON structure:
{
  "rootCause": "One specific sentence explaining exactly why this error occurred — reference the error type and screen",
  "whatHappened": "1-3 sentences narrating what the real user actually did leading up to this error, grounded in the real event timeline above if one was given (e.g. 'User navigated to checkout, entered card details, clicked Pay Now, then the API returned a 500.'). If no timeline was provided, say only what can be inferred from the error itself — do not invent user actions that weren't given to you.",
  "fix": "2-4 numbered steps the developer should take right now to fix this",
  "codeExample": "Optional: a short code snippet (max 8 lines) that demonstrates the fix, or null if not applicable",
  "language": "dart | typescript | javascript | null — the language for the code example",
  "confidence": 87,
  "affectedArea": "The specific module, screen, or service affected",
  "prevention": "One sentence on how to prevent this class of error recurring",
  "severity": "critical | high | medium | low"
}

Rules:
- rootCause must be specific to THIS error, never generic
- whatHappened must only state real events given above — never invent a user action that wasn't in the timeline
- fix must be actionable steps a developer can execute immediately
- confidence is 0-100 integer based on how much signal is in the error data
- If the stack trace or context is missing, lower confidence accordingly`

  const anthropic = new Anthropic({ apiKey })

  let raw: string | null = null
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0]?.type === 'text' ? msg.content[0].text.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : null
  } catch (err) {
    return respond({ error: `Claude error: ${err instanceof Error ? err.message : String(err)}` }, 500)
  }

  if (!raw) return respond({ error: 'No response from Claude' }, 500)

  let result: Record<string, unknown>
  try {
    result = JSON.parse(raw)
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return respond({ error: 'Failed to parse Claude response', raw }, 500)
    }
    try {
      result = JSON.parse(raw.slice(start, end + 1))
    } catch {
      return respond({ error: 'Failed to parse Claude response', raw }, 500)
    }
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
