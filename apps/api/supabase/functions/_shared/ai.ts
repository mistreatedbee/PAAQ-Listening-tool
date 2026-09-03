/**
 * Shared AI access via OpenAI-compatible Chat Completions APIs.
 *
 * Primary: NVIDIA Integrate API (`NVIDIA_API_KEY`, model `moonshotai/kimi-k3`).
 * Fallback: OpenRouter (`OPENROUTER_API_KEY`) when NVIDIA is not configured.
 *
 * `askModel` / `openRouterChat` signatures are unchanged for call sites.
 */

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
export const DEFAULT_AI_MODEL = 'moonshotai/kimi-k3'

/** @deprecated Use DEFAULT_AI_MODEL — kept for existing imports */
export const OPENROUTER_MODEL = DEFAULT_AI_MODEL
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
/** OpenRouter-only fallbacks; unused when NVIDIA is the active provider. */
export const OPENROUTER_FALLBACK_MODELS = ['google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct']

export type AiProvider = 'nvidia' | 'openrouter'

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
      model: Deno.env.get('AI_MODEL') ?? 'anthropic/claude-fable-5.1',
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
    model: Deno.env.get('AI_MODEL') ?? 'google/gemini-2.5-flash',
    baseUrl: OPENROUTER_BASE_URL,
  }
}

function providerLabel(provider: AiProvider): string {
  return provider === 'nvidia' ? 'NVIDIA' : 'OpenRouter'
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
  /** Per-request fetch timeout; defaults to 90s (NVIDIA) / 100s (OpenRouter). */
  timeoutMs?: number
}

export const MIN_COMPLETION_TOKENS = 256

function completionTokenCap(provider: AiProvider): number {
  const envKey = provider === 'nvidia' ? 'AI_MAX_COMPLETION_TOKENS' : 'OPENROUTER_MAX_COMPLETION_TOKENS'
  const fromEnv = Deno.env.get(envKey) ?? Deno.env.get('AI_MAX_COMPLETION_TOKENS')
  const fallback = provider === 'nvidia' ? 4096 : 384
  const parsed = fromEnv ? Number(fromEnv) : fallback
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function effectiveMaxTokens(requested: number | undefined, provider: AiProvider): number {
  const cap = completionTokenCap(provider)
  const budget = requested ?? cap
  return Math.min(Math.max(budget, MIN_COMPLETION_TOKENS), cap)
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
      const transient = /rate limited|provider error|no choices|timeout|failed to parse ai response/i.test(lastError.message)
      if (!transient || attempt === models.length) throw lastError
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
    max_tokens: effectiveMaxTokens(options.maxTokens, options.provider),
    temperature: options.temperature,
    ...(options.tools ? { tools: options.tools, tool_choice: options.toolChoice ?? 'auto' } : {}),
  }

  // Kimi on NVIDIA: default to low reasoning for edge-fn latency (override via NVIDIA_REASONING_EFFORT).
  if (options.provider === 'nvidia' && options.model?.includes('kimi')) {
    body.reasoning_effort = Deno.env.get('NVIDIA_REASONING_EFFORT') ?? 'low'
  }

  const timeoutMs = options.timeoutMs ?? (options.provider === 'nvidia' ? 90_000 : 100_000)
  const fetchInit: RequestInit = {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  }

  const res = await fetch(`${options.baseUrl}/chat/completions`, fetchInit)

  if (!res.ok) throw await openRouterError(res, options.provider)

  const data = await res.json() as {
    choices?: Array<{
      message?: { role: 'assistant'; content?: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
      finish_reason?: string | null
    }>
    error?: { message?: string }
  }

  if (data.error) throw new Error(`${providerLabel(options.provider)} error: ${data.error.message ?? 'unknown error'}`)

  const choice = data.choices?.[0]
  if (!choice?.message) {
    throw new Error(`${providerLabel(options.provider)} returned no choices — the model may be unavailable`)
  }

  return {
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
    throw new Error('No AI API key configured. Set NVIDIA_API_KEY (or OPENROUTER_API_KEY) in Supabase secrets.')
  }

  const messages: ChatMessage[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const { message, finishReason } = await openRouterChat({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    provider: config.provider,
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
    throw new Error(`AI returned no text content (finish_reason: ${finishReason ?? 'unknown'})`)
  }

  return text ?? ''
}

/**
 * Tries the configured primary provider (NVIDIA Kimi when set), then falls back to
 * OpenRouter fast models when NVIDIA is slow or unavailable — keeps edge functions
 * inside the ~150s wall clock.
 */
export async function askModelResilient({
  system,
  prompt,
  model,
  maxTokens = 2048,
  temperature = 0.2,
  nvidiaTimeoutMs = 90_000,
}: AiRequest & { nvidiaTimeoutMs?: number }): Promise<string> {
  const primary = getAiConfig()
  if (!primary) {
    throw new Error('No AI API key configured. Set NVIDIA_API_KEY (or OPENROUTER_API_KEY) in Supabase secrets.')
  }

  const messages: ChatMessage[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const runOnce = async (config: AiConfig, chosenModel: string, timeoutMs?: number) => {
    const { message, finishReason } = await openRouterChat({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      provider: config.provider,
      messages,
      model: chosenModel,
      maxTokens,
      temperature,
      timeoutMs,
    })
    const text = message.content?.trim()
    if (!text && finishReason === 'length') {
      throw new Error('AI spent its whole token budget on reasoning before answering — retry or raise max_tokens')
    }
    if (!text && finishReason !== 'tool_calls') {
      throw new Error(`AI returned no text content (finish_reason: ${finishReason ?? 'unknown'})`)
    }
    return text ?? ''
  }

  const primaryModel = model ?? primary.model
  try {
    return await runOnce(
      primary,
      primaryModel,
      primary.provider === 'nvidia' ? nvidiaTimeoutMs : undefined,
    )
  } catch (primaryErr) {
    if (primary.provider !== 'nvidia') throw primaryErr
    const fallback = getOpenRouterFallbackConfig()
    if (!fallback) throw primaryErr

    const models = [primaryModel, ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== primaryModel)]
    let lastError = primaryErr instanceof Error ? primaryErr : new Error(String(primaryErr))

    for (const fallbackModel of models) {
      try {
        return await runOnce(fallback, fallbackModel)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const tryNext = /credits exhausted|no endpoints found|not a valid model|bad request/i.test(lastError.message)
        if (!tryNext) break
      }
    }
    throw lastError
  }
}
