/**
 * Shared AI access via OpenRouter (OpenAI-compatible Chat Completions API).
 *
 * OpenRouter is now the only AI path: one key (`OPENROUTER_API_KEY`), one
 * model default (`anthropic/claude-fable-5.1`). Gemini support was removed in the
 * Claude→OpenRouter migration; `askModel` keeps its signature so every call
 * site stays unchanged.
 *
 * Error mapping (surfaced to callers as Error with a descriptive message):
 * - 401 → invalid/missing OPENROUTER_API_KEY
 * - 402 → insufficient credits
 * - 408/timeout → upstream model timeout
 * - 429 → rate limited
 * - 5xx → provider/model failure
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const OPENROUTER_MODEL = 'anthropic/claude-fable-5.1'
/**
 * Fallback models tried in order when the primary model stalls or fails
 * transiently. A fast secondary keeps user-facing flows (fix agent, onboarding,
 * investigate) responsive instead of failing after a 100s deadline.
 */
export const OPENROUTER_FALLBACK_MODELS = ['google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct']

export type AiProvider = 'openrouter'

export type AiRequest = {
  system?: string
  prompt: string
  model?: string
  maxTokens?: number
  temperature?: number
}

export type AiConfig = {
  provider: AiProvider
  apiKey: string
  model: string
}

export function getAiConfig(): AiConfig | null {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return null
  return { provider: 'openrouter', apiKey, model: OPENROUTER_MODEL }
}

export function getAiApiKey(): string | undefined {
  return getAiConfig()?.apiKey
}

/** Kept for call-site compatibility — OpenRouter is a single configured provider. */
export function getAiConfigs(): AiConfig[] {
  const config = getAiConfig()
  return config ? [config] : []
}

/** Maps an OpenRouter/OpenAI-style HTTP failure to a human-actionable message. */
export async function openRouterError(res: Response): Promise<Error> {
  let detail = ''
  try {
    const body = await res.json() as { error?: { message?: string } | string }
    detail = typeof body.error === 'string' ? body.error : body.error?.message ?? JSON.stringify(body)
  } catch {
    detail = await res.text().catch(() => '')
  }

  // Retry-After (seconds or HTTP-date) tells us how long the quota window is.
  const retryAfterHeader = res.headers.get('retry-after')
  const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) || 0 : 0

  switch (res.status) {
    case 400:
      return new Error(`OpenRouter bad request (${res.status}): ${detail || 'check model name and payload shape'}`)
    case 401:
      return new Error(`OpenRouter auth failed (${res.status}): invalid or missing OPENROUTER_API_KEY`)
    case 402:
      return new Error(`OpenRouter credits exhausted (${res.status}): add credits at openrouter.ai/credits`)
    case 408:
      return new Error(`OpenRouter timeout (${res.status}): upstream model took too long — retry or lower max_tokens`)
    case 429:
      // Distinguish a short burst limit (worth retrying) from an exhausted
      // hourly/daily free-tier window (retrying inside this request is futile).
      if (retryAfterSec > 60) {
        return new Error(`OpenRouter quota exhausted (429): resets in ~${Math.ceil(retryAfterSec / 60)} min — add credits at openrouter.ai/credits or wait`)
      }
      return new Error(`OpenRouter rate limited (429): slow down or check quota`)
    default:
      if (res.status >= 500) {
        return new Error(`OpenRouter provider error (${res.status}): ${detail || 'upstream model/provider failed — retry shortly'}`)
      }
      return new Error(`OpenRouter request failed (${res.status}): ${detail}`)
  }
}

/** OpenAI-style chat message used by the OpenRouter wire format. */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  // deno-lint-ignore no-explicit-any
  content?: any
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

type ChatOptions = {
  apiKey: string
  messages: ChatMessage[]
  model?: string
  maxTokens?: number
  temperature?: number
  tools?: unknown[]
  toolChoice?: 'auto' | 'none'
}

/**
 * claude-fable-5.1 is a reasoning-style model: it emits internal "thinking"
 * tokens that count against max_tokens before any visible answer text.
 * Budgets sized for plain chat models (a few hundred tokens) get consumed by
 * reasoning alone, ending the response truncated with empty content — so
 * callers must reserve generous headroom. This floor is applied to every
 * call that doesn't set an explicit budget.
 */
export const MIN_COMPLETION_TOKENS = 4096

function effectiveMaxTokens(requested?: number): number {
  return Math.max(requested ?? 0, MIN_COMPLETION_TOKENS)
}

/**
 * Single non-streaming chat completion against OpenRouter.
 * Returns the assistant message plus finish reason.
 * Retries transient failures (429 bursts, upstream 5xx, dropped responses)
 * with exponential backoff, honoring Retry-After when provided. Auth,
 * credit and malformed-request failures fail fast — retrying them would
 * just reproduce the error.
 */
export async function openRouterChat(options: ChatOptions): Promise<{
  message: { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  finishReason: string | null
}> {
  const MAX_ATTEMPTS = 4
  let lastError: Error | null = null
  // Model chain: the primary first, then fallbacks. A transient stall on the
  // free-tier primary (upstream queueing, burst limits) promotes the next
  // model in the chain instead of failing the whole call — the caller keeps
  // working with a slightly different model rather than getting an error.
  // Explicit per-call models (rare) are respected and get no fallback.
  const models = [options.model ?? OPENROUTER_MODEL, ...(options.model ? [] : OPENROUTER_FALLBACK_MODELS)]
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      // Exponential backoff: 2s, 6s, 14s. Long quota windows (detected via
      // the message) abort immediately instead of burning the deadline.
      const backoffMs = /quota exhausted/i.test(lastError?.message ?? '')
        ? 0
        : Math.min(2000 * 3 ** (attempt - 2), 15000)
      if (!backoffMs) throw lastError
      await new Promise((r) => setTimeout(r, backoffMs))
    }
    try {
      return await openRouterChatOnce({ ...options, model: models[Math.min(attempt - 1, models.length - 1)] })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const transient = /rate limited|provider error|no choices|timeout|failed to parse ai response/i.test(lastError.message)
      if (!transient || attempt === MAX_ATTEMPTS) throw lastError
    }
  }
  throw lastError ?? new Error('OpenRouter request failed')
}

async function openRouterChatOnce(options: ChatOptions): Promise<{
  message: { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  finishReason: string | null
}> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      // Optional attribution headers recommended by OpenRouter.
      'HTTP-Referer': 'https://paaq.ai',
      'X-Title': 'PAAQ Intelligence',
    },
    // Free-tier models can sit in an upstream queue far past the edge
    // function's own idle timeout. Failing at ~100s with a retryable error
    // lets the caller (or the resumable run loop) try again cleanly instead
    // of the platform killing the function mid-flight with an opaque 504.
    signal: AbortSignal.timeout(100_000),
    body: JSON.stringify({
      model: options.model ?? OPENROUTER_MODEL,
      messages: options.messages,
      max_tokens: effectiveMaxTokens(options.maxTokens),
      temperature: options.temperature,
      ...(options.tools ? { tools: options.tools, tool_choice: options.toolChoice ?? 'auto' } : {}),
    }),
  })

  if (!res.ok) throw await openRouterError(res)

  const data = await res.json() as {
    choices?: Array<{
      message?: { role: 'assistant'; content?: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
      finish_reason?: string | null
    }>
    error?: { message?: string }
  }

  if (data.error) throw new Error(`OpenRouter error: ${data.error.message ?? 'unknown error'}`)

  const choice = data.choices?.[0]
  if (!choice?.message) throw new Error('OpenRouter returned no choices — the model may be unavailable; retry or check status.openrouter.ai')

  return {
    // Some models emit reasoning-only responses with empty content; normalize to null so callers can branch cleanly.
    message: { ...choice.message, content: choice.message.content ?? null },
    finishReason: choice.finish_reason ?? null,
  }
}

export async function askModel({
  system,
  prompt,
  model,
  maxTokens = 2048,
  temperature = 0.2,
}: AiRequest): Promise<string> {
  const config = getAiConfig()
  if (!config) {
    throw new Error('No AI API key configured. Set OPENROUTER_API_KEY in Supabase secrets.')
  }

  const messages: ChatMessage[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const { message, finishReason } = await openRouterChat({
    apiKey: config.apiKey,
    messages,
    model: model ?? config.model,
    maxTokens,
    temperature,
  })

  const text = message.content?.trim()
  if (!text && finishReason === 'length') {
    throw new Error('AI spent its whole token budget on reasoning before answering — retry or raise max_tokens')
  }
  if (!text && finishReason !== 'tool_calls') {
    throw new Error(`OpenRouter returned no text content (finish_reason: ${finishReason ?? 'unknown'})`)
  }

  return text ?? ''
}
