import Anthropic from 'npm:@anthropic-ai/sdk'

export type AiProvider = 'gemini' | 'anthropic'

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
  const gemini = Deno.env.get('GEMINI_API_KEY')
  if (gemini) {
    return { provider: 'gemini', apiKey: gemini, model: 'gemini-2.5-flash' }
  }

  const anthropic = Deno.env.get('ANTHROPIC_API_KEY')
  if (anthropic) {
    return { provider: 'anthropic', apiKey: anthropic, model: 'claude-haiku-4-5-20251001' }
  }

  return null
}

export function getAiApiKey(): string | undefined {
  return getAiConfig()?.apiKey
}

export function getAiConfigs(): AiConfig[] {
  const configs: AiConfig[] = []

  const gemini = Deno.env.get('GEMINI_API_KEY')
  if (gemini) {
    configs.push({ provider: 'gemini', apiKey: gemini, model: 'gemini-2.5-flash' })
  }

  const anthropic = Deno.env.get('ANTHROPIC_API_KEY')
  if (anthropic) {
    configs.push({ provider: 'anthropic', apiKey: anthropic, model: 'claude-haiku-4-5-20251001' })
  }

  return configs
}

export async function askModel({
  system,
  prompt,
  model,
  maxTokens = 2048,
  temperature = 0.2,
}: AiRequest): Promise<string> {
  const configs = getAiConfigs()
  if (configs.length === 0) {
    throw new Error('No AI API key configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets.')
  }

  let lastError: unknown = null

  for (const config of configs) {
    try {
      if (config.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model ?? config.model}:generateContent?key=${config.apiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            generationConfig: { temperature, maxOutputTokens: maxTokens },
            contents: [{ parts: [{ text: prompt }] }],
          }),
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`Gemini request failed: ${response.status} ${text}`)
        }

        const data = await response.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }

        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')?.trim()
        if (!text) {
          throw new Error('Gemini returned no text content')
        }

        return text
      }

      const anthropic = new Anthropic({ apiKey: config.apiKey })
      const response = await anthropic.messages.create({
        model: model ?? config.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n').trim()
      if (!text) {
        throw new Error('Anthropic returned no text content')
      }

      return text
    } catch (error) {
      lastError = error
      if (config === configs[configs.length - 1]) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI request failed')
}
