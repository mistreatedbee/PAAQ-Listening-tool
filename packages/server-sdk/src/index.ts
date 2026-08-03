const BASE_URL = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'
const SDK_VERSION = '1.0.1'
const HEARTBEAT_INTERVAL_SECONDS = 5 * 60

type EventPayload = {
  event_name: string
  session_id: string | null
  properties: Record<string, unknown>
  timestamp: string
}

export type PaaqConfig = {
  batchSize: number
  syncIntervalSeconds: number
}

export type InitOptions = {
  sdkToken: string
  projectId: string
  /** Defaults to 'nodejs'. Set to 'python', 'deno', etc. if embedding this SDK's protocol elsewhere. */
  platform?: string
  environment?: 'production' | 'staging' | 'development'
}

export type InitResult = {
  ok: boolean
  sessionId?: string
  deviceId?: string
  config?: PaaqConfig
  error?: string
}

type ErrorPayload = {
  error_type: string
  message: string
  stack_trace?: string | null
  severity?: 'fatal' | 'error' | 'warning' | 'info'
  context?: Record<string, unknown> | null
}

// Minimal structural types so this has no hard dependency on @types/express —
// works with Express, Fastify-with-http-adapter, or plain http.
type MinimalRequest = { method?: string; path?: string; url?: string }
type MinimalResponse = { statusCode: number; on(event: 'finish', cb: () => void): void }
type NextFn = () => void

let _sdkToken = ''
let _projectKey = ''
let _platform = 'nodejs'
let _environment = 'production'
let _deviceId = ''
let _sessionId: string | null = null
let _queue: EventPayload[] = []
let _config: PaaqConfig = { batchSize: 50, syncIntervalSeconds: 30 }
let _flushTimer: ReturnType<typeof setInterval> | null = null
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null
let _lastHeartbeatAt = 0

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${_sdkToken}`,
    'X-Project-ID': _projectKey,
    'X-SDK-Version': SDK_VERSION,
    'X-Platform': _platform,
    'X-Environment': _environment,
  }
}

function getDeviceId(): string {
  // A backend process doesn't have localStorage; identify it by host + pid
  // so multiple instances of the same service show up as distinct devices.
  const host = typeof process !== 'undefined' ? process.env?.HOSTNAME ?? '' : ''
  const pid = typeof process !== 'undefined' ? process.pid : 0
  return `${host || 'host'}-${pid}`
}

async function initialize(options: InitOptions): Promise<InitResult> {
  _sdkToken = options.sdkToken
  _projectKey = options.projectId
  _platform = options.platform ?? 'nodejs'
  _environment = options.environment ?? (process.env?.NODE_ENV === 'production' ? 'production' : 'development')
  _deviceId = getDeviceId()

  try {
    const res = await fetch(`${BASE_URL}/sdk-init`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ deviceId: _deviceId }),
    })
    const data = (await res.json()) as InitResult
    if (data.ok && data.sessionId) {
      _sessionId = data.sessionId
      if (data.config) _config = data.config
      scheduleFlush()
      scheduleHeartbeat()
      pingIfActive()
      installProcessHandlers()
    }
    return data
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

function track(eventName: string, properties: Record<string, unknown> = {}) {
  pingIfActive()
  _queue.push({
    event_name: eventName,
    session_id: _sessionId,
    properties,
    timestamp: new Date().toISOString(),
  })
  if (_queue.length >= _config.batchSize) void flush()
}

function identify(userId: string, traits: Record<string, unknown> = {}) {
  track('$identify', { userId, ...traits })
}

async function flush(): Promise<void> {
  if (_queue.length === 0 || !_sdkToken) return
  const batch = _queue.splice(0)
  try {
    await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(batch),
    })
  } catch {
    // fire-and-forget — silently discard on network failure
  }
}

async function heartbeat(): Promise<void> {
  if (!_sdkToken) return
  try {
    await fetch(`${BASE_URL}/sdk-heartbeat`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ deviceId: _deviceId }),
    })
  } catch {
    // fire-and-forget — a missed heartbeat just leaves last_seen stale
    // until the next one succeeds; nothing to recover here.
  }
}

// On serverless (Vercel, Lambda, etc.) the process freezes between
// invocations, so a setInterval scheduled 5 minutes out often never gets to
// fire even once before the runtime suspends it. Piggybacking a throttled
// ping on real activity (a request, a tracked event) means last_seen keeps
// advancing as long as the backend is actually being used, regardless of
// whether the process stays warm long enough for its own timers.
function pingIfActive() {
  const now = Date.now()
  if (now - _lastHeartbeatAt < HEARTBEAT_INTERVAL_SECONDS * 1000) return
  _lastHeartbeatAt = now
  void heartbeat()
}

function scheduleFlush() {
  if (_flushTimer) clearInterval(_flushTimer)
  _flushTimer = setInterval(() => void flush(), _config.syncIntervalSeconds * 1000)
  _flushTimer.unref?.()
}

function scheduleHeartbeat() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  // Fallback only, for long-lived processes that go quiet (no requests, no
  // track() calls) — pingIfActive() from real activity is the primary
  // signal, since this timer may never fire on a serverless runtime that
  // freezes the process between invocations.
  _heartbeatTimer = setInterval(() => {
    _lastHeartbeatAt = Date.now()
    void heartbeat()
  }, HEARTBEAT_INTERVAL_SECONDS * 1000)
  _heartbeatTimer.unref?.()
}

function middleware() {
  return (req: MinimalRequest, res: MinimalResponse, next: NextFn) => {
    const path = req.path ?? req.url ?? ''
    res.on('finish', () => {
      track('$api_request', { method: req.method, path, statusCode: res.statusCode })
    })
    next()
  }
}

async function sendError(payload: ErrorPayload): Promise<void> {
  if (!_sdkToken) return
  try {
    await fetch(`${BASE_URL}/errors`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ ...payload, session_id: _sessionId }),
    })
  } catch {
    // fire-and-forget
  }
}

function trackError(
  error: unknown,
  options: { severity?: ErrorPayload['severity']; context?: Record<string, unknown> } = {},
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  void sendError({
    error_type: err.name || 'Error',
    message: err.message,
    stack_trace: err.stack ?? null,
    severity: options.severity ?? 'error',
    context: options.context ?? null,
  })
}

function installProcessHandlers(): void {
  process.on('uncaughtException', (err) => {
    void sendError({ error_type: err.name, message: err.message, stack_trace: err.stack ?? null, severity: 'fatal' })
  })
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason))
    void sendError({ error_type: err.name || 'UnhandledRejection', message: err.message, stack_trace: err.stack ?? null, severity: 'error' })
  })
}

/** Stops the background timers — call on graceful shutdown so the process can exit. */
function shutdown() {
  if (_flushTimer) clearInterval(_flushTimer)
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  _flushTimer = null
  _heartbeatTimer = null
  void flush()
}

export const PAAQ = { initialize, track, identify, middleware, flush, shutdown, trackError }
