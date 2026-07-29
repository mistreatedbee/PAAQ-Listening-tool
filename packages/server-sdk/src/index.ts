const BASE_URL = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'
const SDK_VERSION = '1.0.0'
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
    }
    return data
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

function track(eventName: string, properties: Record<string, unknown> = {}) {
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

function scheduleFlush() {
  if (_flushTimer) clearInterval(_flushTimer)
  _flushTimer = setInterval(() => void flush(), _config.syncIntervalSeconds * 1000)
  _flushTimer.unref?.()
}

function scheduleHeartbeat() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  // Keeps sdk_installations.last_seen fresh for as long as this process is
  // actually alive — no manual restart or real request needed for the
  // dashboard's Connection Status panel to see the backend as connected.
  _heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_SECONDS * 1000)
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

/** Stops the background timers — call on graceful shutdown so the process can exit. */
function shutdown() {
  if (_flushTimer) clearInterval(_flushTimer)
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  _flushTimer = null
  _heartbeatTimer = null
  void flush()
}

export const PAAQ = { initialize, track, identify, middleware, flush, shutdown }
