/**
 * Shared AI access via OpenAI-compatible Chat Completions APIs.
 *
 * Primary: NVIDIA Integrate API (`NVIDIA_API_KEY`, model `moonshotai/kimi-k3`).
 * Fallback: OpenRouter fast models when NVIDIA is slow, times out, or burns
 * its token budget on reasoning — keeps edge functions inside ~150s wall clock.
 */

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
export const DEFAULT_AI_MODEL = 'moonshotai/kimi-k3'

/** @deprecated Use DEFAULT_AI_MODEL — kept for existing imports */
export const OPENROUTER_MODEL = DEFAULT_AI_MODEL
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
/** Fast OpenRouter models used when NVIDIA Kimi is too slow for edge functions. */
export const OPENROUTER_FALLBACK_MODELS = ['google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct']

/** Per-task output token budgets — keep responses concise to avoid timeouts. */
export const AI_TOKEN_BUDGETS = {
  tiny: 128,
  short: 512,
  json: 1024,
  analysis: 1536,
  investigation: 2048,
  code: 4096,
} as const

export type AiProvider = 'nvidia' | 'openrouter'

export type AiRequest = {
  system?: string
  prompt: string
  model?: string
  maxTokens?: number
  temperature?: number
  /** NVIDIA-only: abort and fall back after this many ms (default 60s). */
  nvidiaTimeoutMs?: number
}

export type AiConfig = {
  provider: AiProvider
  apiKey: string
  model: string
  baseUrl: string
}

export function getAiConfig(): AiConfig | null {
  const nvidiaKey = Deno.env.get('NVIDIA_API_KEY')
  if (nvidiaKey) {
    return {
      provider: 'nvidia',
      apiKey: nvidiaKey,
      model: Deno.env.get('AI_MODEL') ?? DEFAULT_AI_MODEL,
      baseUrl: Deno.env.get('NVIDIA_API_BASE_URL') ?? NVIDIA_BASE_URL,
    }
  }

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
  if (openRouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openRouterKey,
      model: Deno.env.get('AI_MODEL') ?? 'google/gemini-2.5-flash',
      baseUrl: OPENROUTER_BASE_URL,
    }
  }

  return null
}

export function getAiApiKey(): string | undefined {
  return getAiConfig()?.apiKey
}

export function getOpenRouterFallbackConfig(): AiConfig | null {
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!openRouterKey) return null
  return {
    provider: 'openrouter',
    apiKey: openRouterKey,
    model: 'google/gemini-2.5-flash',
    baseUrl: OPENROUTER_BASE_URL,
  }
}

function nvidiaTimeoutMs(override?: number): number {
  if (override != null) return override
  const fromEnv = Number(Deno.env.get('AI_NVIDIA_TIMEOUT_MS'))
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 60_000
}

function providerLabel(provider: AiProvider): string {
  return provider === 'nvidia' ? 'NVIDIA' : 'OpenRouter'
}

function isFallbackWorthyError(message: string): boolean {
  return /timeout|timed out|token budget|no text content|no choices|provider error|rate limited|signal timed out|failed to parse/i.test(message)
}

/** Parse JSON from model output; repairs common truncation. */
export function parseAiJson<T extends Record<string, unknown> = Record<string, unknown>>(raw: string): T | null {
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T
      } catch { /* salvage */ }
    }
    return salvageTruncatedJson<T>(cleaned)
  }
}

function salvageTruncatedJson<T extends Record<string, unknown>>(raw: string): T | null {
  const start = raw.indexOf('{')
  if (start === -1) return null

  let slice = raw.slice(start).trimEnd()
  slice = slice.replace(/,\s*"[^"]*$/, '')
  slice = slice.replace(/,\s*$/, '')

  let openBraces = 0
  let inString = false
  let escaped = false
  for (const ch of slice) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (!inString) {
      if (ch === '{') openBraces++
      if (ch === '}') openBraces--
    }
  }
  if (inString) slice += '"'
  while (openBraces > 0) { slice += '}'; openBraces-- }

  try {
    return JSON.parse(slice) as T
  } catch {
    return null
  }
}

/** Maps an OpenAI-compatible HTTP failure to a human-actionable message. */
export async function openRouterError(res: Response, provider: AiProvider = 'openrouter'): Promise<Error> {
  const label = providerLabel(provider)
  let detail = ''
  try {
    const body = await res.json() as { error?: { message?: string } | string }
    detail = typeof body.error === 'string' ? body.error : body.error?.message ?? JSON.stringify(body)
  } catch {
    detail = await res.text().catch(() => '')
  }

  const retryAfterHeader = res.headers.get('retry-after')
  const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) || 0 : 0

  switch (res.status) {
    case 400:
      return new Error(`${label} bad request (${res.status}): ${detail || 'check model name and payload shape'}`)
    case 401:
      return new Error(`${label} auth failed (${res.status}): invalid or missing API key`)
    case 402:
      return new Error(`${label} credits exhausted (${res.status}): add credits or check quota`)
    case 408:
      return new Error(`${label} timeout (${res.status}): upstream model took too long — retry or lower max_tokens`)
    case 429:
      if (retryAfterSec > 60) {
        return new Error(`${label} quota exhausted (429): resets in ~${Math.ceil(retryAfterSec / 60)} min`)
      }
      return new Error(`${label} rate limited (429): slow down or check quota`)
    default:
      if (res.status >= 500) {
        return new Error(`${label} provider error (${res.status}): ${detail || 'upstream model failed — retry shortly'}`)
      }
      return new Error(`${label} request failed (${res.status}): ${detail}`)
  }
}

/** OpenAI-style chat message used by the completions wire format. */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  // deno-lint-ignore no-explicit-any
  content?: any
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

type AssistantMessage = {
  role: 'assistant'
  content?: string | null
  reasoning_content?: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
}

type ChatOptions = {
  apiKey: string
  baseUrl: string
  provider: AiProvider
  messages: ChatMessage[]
  model?: string
  maxTokens?: number
  temperature?: number
  tools?: unknown[]
  toolChoice?: 'auto' | 'none'
  timeoutMs?: number
}

export const MIN_COMPLETION_TOKENS = 256

function completionTokenCap(provider: AiProvider): number {
  const envKey = provider === 'nvidia' ? 'AI_MAX_COMPLETION_TOKENS' : 'OPENROUTER_MAX_COMPLETION_TOKENS'
  const fromEnv = Deno.env.get(envKey) ?? Deno.env.get('AI_MAX_COMPLETION_TOKENS')
  const fallback = provider === 'nvidia' ? 4096 : 1536
  const parsed = fromEnv ? Number(fromEnv) : fallback
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function effectiveMaxTokens(requested: number | undefined, provider: AiProvider, model?: string): number {
  const cap = completionTokenCap(provider)
  const budget = requested ?? cap
  let effective = Math.min(Math.max(budget, MIN_COMPLETION_TOKENS), cap)
  // Kimi reasoning models need headroom for internal reasoning + answer.
  if (provider === 'nvidia' && model?.includes('kimi') && effective < 2048) {
    effective = Math.min(2048, cap)
  }
  return effective
}

function extractAssistantText(message: AssistantMessage, finishReason: string | null): string | null {
  const content = typeof message.content === 'string' ? message.content.trim() : ''
  if (content) return content
  if (finishReason === 'tool_calls' && message.tool_calls?.length) return ''
  return null
}

/**
 * Non-streaming chat completion. Retries transient failures and, on OpenRouter
 * only, promotes through the fallback model chain on credit/model errors.
 */
export async function openRouterChat(options: Partial<ChatOptions> & Pick<ChatOptions, 'messages'>): Promise<{
  message: { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  finishReason: string | null
}> {
  const config = getAiConfig()
  if (!config) {
    throw new Error('No AI API key configured. Set NVIDIA_API_KEY (or OPENROUTER_API_KEY) in Supabase secrets.')
  }

  const resolved: ChatOptions = {
    apiKey: options.apiKey ?? config.apiKey,
    baseUrl: options.baseUrl ?? config.baseUrl,
    provider: options.provider ?? config.provider,
    messages: options.messages,
    model: options.model ?? config.model,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    tools: options.tools,
    toolChoice: options.toolChoice,
    timeoutMs: options.timeoutMs,
  }

  let lastError: Error | null = null
  const models = resolved.model && options.model
    ? [resolved.model]
    : resolved.provider === 'nvidia'
      ? [config.model]
      : [config.model, ...OPENROUTER_FALLBACK_MODELS]

  for (let attempt = 1; attempt <= models.length; attempt++) {
    if (attempt > 1) {
      const backoffMs = /quota exhausted/i.test(lastError?.message ?? '')
        ? 0
        : Math.min(2000 * 3 ** (attempt - 2), 15000)
      if (backoffMs) await new Promise((r) => setTimeout(r, backoffMs))
    }
    try {
      return await chatCompletionsOnce({ ...resolved, model: models[attempt - 1] })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const tryNextModel = resolved.provider === 'openrouter'
        && /credits exhausted|no endpoints found|not a valid model|bad request/i.test(lastError.message)
      if (tryNextModel && attempt < models.length) continue
      const transient = isFallbackWorthyError(lastError.message)
      if (!transient || attempt === models.length) break
    }
  }

  // NVIDIA → OpenRouter provider fallback (tool-calling paths use this too).
  if (resolved.provider === 'nvidia') {
    const fallback = getOpenRouterFallbackConfig()
    if (fallback) {
      for (const fallbackModel of OPENROUTER_FALLBACK_MODELS) {
        try {
          return await chatCompletionsOnce({
            ...resolved,
            apiKey: fallback.apiKey,
            baseUrl: fallback.baseUrl,
            provider: fallback.provider,
            model: fallbackModel,
            timeoutMs: 90_000,
          })
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
        }
      }
    }
  }

  throw lastError ?? new Error('AI chat request failed')
}

async function chatCompletionsOnce(options: ChatOptions): Promise<{
  message: { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  finishReason: string | null
}> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
  }
  if (options.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://paaq.ai'
    headers['X-Title'] = 'PAAQ Intelligence'
  }

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    max_tokens: effectiveMaxTokens(options.maxTokens, options.provider, options.model),
    temperature: options.temperature,
    ...(options.tools ? { tools: options.tools, tool_choice: options.toolChoice ?? 'auto' } : {}),
  }

  if (options.provider === 'nvidia' && options.model?.includes('kimi')) {
    body.reasoning_effort = Deno.env.get('NVIDIA_REASONING_EFFORT') ?? 'low'
  }

  const timeoutMs = options.timeoutMs ?? (options.provider === 'nvidia' ? nvidiaTimeoutMs() : 90_000)
  const res = await fetch(`${options.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  })

  if (!res.ok) throw await openRouterError(res, options.provider)

  const data = await res.json() as {
    choices?: Array<{
      message?: AssistantMessage
      finish_reason?: string | null
    }>
    error?: { message?: string }
  }

  if (data.error) throw new Error(`${providerLabel(options.provider)} error: ${data.error.message ?? 'unknown error'}`)

  const choice = data.choices?.[0]
  if (!choice?.message) {
    throw new Error(`${providerLabel(options.provider)} returned no choices — the model may be unavailable`)
  }

  const finishReason = choice.finish_reason ?? null
  const text = extractAssistantText(choice.message, finishReason)
  if (!text && finishReason === 'length') {
    throw new Error('AI spent its whole token budget on reasoning before answering — retry or raise max_tokens')
  }
  if (text === null && finishReason !== 'tool_calls') {
    throw new Error(`AI returned no text content (finish_reason: ${finishReason ?? 'unknown'})`)
  }

  return {
    message: { ...choice.message, content: text },
    finishReason,
  }
}

async function chatOnceWithConfig(
  config: AiConfig,
  messages: ChatMessage[],
  opts: { model: string; maxTokens?: number; temperature?: number; timeoutMs?: number; tools?: unknown[]; toolChoice?: 'auto' | 'none' },
): Promise<string> {
  const { message, finishReason } = await openRouterChat({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    provider: config.provider,
    messages,
    model: opts.model,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    timeoutMs: opts.timeoutMs,
    tools: opts.tools,
    toolChoice: opts.toolChoice,
  })
  if (finishReason === 'tool_calls') return message.content ?? ''
  const text = message.content?.trim()
  if (!text) throw new Error(`AI returned no text content (finish_reason: ${finishReason ?? 'unknown'})`)
  return text
}

/**
 * Primary AI entry point for text completions. Tries NVIDIA Kimi when configured,
 * then falls back to fast OpenRouter models on timeout or reasoning-token failures.
 */
export async function askModel({
  system,
  prompt,
  model,
  maxTokens = AI_TOKEN_BUDGETS.analysis,
  temperature = 0.2,
  nvidiaTimeoutMs: nvidiaTimeoutOverride,
}: AiRequest): Promise<string> {
  const primary = getAiConfig()
  if (!primary) {
    throw new Error('No AI API key configured. Set NVIDIA_API_KEY (or OPENROUTER_API_KEY) in Supabase secrets.')
  }

  const messages: ChatMessage[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const primaryModel = model ?? primary.model
  const nvidiaTimeout = nvidiaTimeoutMs(nvidiaTimeoutOverride)

  try {
    return await chatOnceWithConfig(primary, messages, {
      model: primaryModel,
      maxTokens,
      temperature,
      timeoutMs: primary.provider === 'nvidia' ? nvidiaTimeout : undefined,
    })
  } catch (primaryErr) {
    if (primary.provider !== 'nvidia') throw primaryErr
    const fallback = getOpenRouterFallbackConfig()
    if (!fallback) throw primaryErr

    let lastError = primaryErr instanceof Error ? primaryErr : new Error(String(primaryErr))
    for (const fallbackModel of OPENROUTER_FALLBACK_MODELS) {
      try {
        return await chatOnceWithConfig(fallback, messages, {
          model: fallbackModel,
          maxTokens,
          temperature,
        })
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
    throw lastError
  }
}

/** @deprecated Alias for askModel — all call sites now get resilient fallback. */
export const askModelResilient = askModel
