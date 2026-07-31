/**
 * Bounded retry/backoff for transient network failures only. Never retries
 * auth/RLS/validation errors — a real rejection must fail immediately, not
 * be masked into a false "it worked eventually".
 */

export type RetryOptions = { retries?: number; baseMs?: number; maxMs?: number }

const TRANSIENT_PATTERN =
  /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timeout|timed out|502|503|504|gateway|upstream/i

export function isTransient(err: unknown): boolean {
  const msg = err instanceof Error
    ? err.message
    : typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message)
      : String(err)
  return TRANSIENT_PATTERN.test(msg)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retries a throwing async function on transient errors only. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseMs = 200, maxMs = 2000 } = opts
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === retries || !isTransient(err)) throw err
      const delay = Math.min(maxMs, baseMs * 2 ** attempt) * (0.5 + Math.random() * 0.5)
      await sleep(delay)
    }
  }
  throw lastErr
}

type SupabaseResult<T> = { data: T | null; error: { message: string; code?: string } | null }

/**
 * Retries Supabase JS calls, which report failure via `{ error }` rather
 * than throwing. Only retries when `error` looks transient; a real
 * auth/RLS/validation error is returned as-is on the first attempt.
 */
export async function withRetryResult<T>(
  fn: () => Promise<SupabaseResult<T>>,
  opts: RetryOptions = {},
): Promise<SupabaseResult<T>> {
  const { retries = 3, baseMs = 200, maxMs = 2000 } = opts
  let lastResult: SupabaseResult<T> | undefined
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fn()
    if (!res.error || !isTransient(res.error)) return res
    lastResult = res
    if (attempt === retries) return res
    const delay = Math.min(maxMs, baseMs * 2 ** attempt) * (0.5 + Math.random() * 0.5)
    await sleep(delay)
  }
  return lastResult!
}
