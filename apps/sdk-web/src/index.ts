const BASE_URL = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'
const SDK_VERSION = '1.0.0'

type ErrorPayload = {
  error_type: string
  message: string
  stack_trace?: string | null
  screen?: string | null
  severity?: 'fatal' | 'error' | 'warning' | 'info'
  context?: Record<string, unknown> | null
  session_id?: string | null
}

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

export type InitResult = {
  ok: boolean
  sessionId?: string
  deviceId?: string
  config?: PaaqConfig
  error?: string
}

let _sdkToken = ''
let _projectKey = ''
let _platform = 'react'
let _sessionId: string | null = null
let _queue: EventPayload[] = []
let _config: PaaqConfig = { batchSize: 50, syncIntervalSeconds: 30 }
let _flushTimer: ReturnType<typeof setInterval> | null = null

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${_sdkToken}`,
    'X-Project-ID': _projectKey,
    'X-SDK-Version': SDK_VERSION,
    'X-Platform': _platform,
    'X-Environment':
      typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
        ? 'production'
        : 'development',
  }
}

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('paaq_device_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('paaq_device_id', id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

async function init(
  sdkToken: string,
  projectKey: string,
  options: { platform?: string } = {},
): Promise<InitResult> {
  _sdkToken = sdkToken
  _projectKey = projectKey
  _platform = options.platform ?? 'react'

  try {
    const res = await fetch(`${BASE_URL}/sdk-init`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ deviceId: getDeviceId() }),
    })
    const data: InitResult = await res.json()
    if (data.ok && data.sessionId) {
      _sessionId = data.sessionId
      if (data.config) _config = data.config
      scheduleFlush()
      installGlobalHandlers()
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

function page(pageName?: string, properties: Record<string, unknown> = {}) {
  track('$page_view', {
    page: pageName ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
    ...properties,
  })
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

async function sendError(payload: ErrorPayload): Promise<void> {
  if (!_sdkToken) return
  try {
    await fetch(`${BASE_URL}/errors`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ ...payload, session_id: payload.session_id ?? _sessionId }),
    })
  } catch {
    // fire-and-forget
  }
}

function trackError(
  error: unknown,
  options: { severity?: ErrorPayload['severity']; screen?: string; context?: Record<string, unknown> } = {},
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  void sendError({
    error_type: err.name || 'Error',
    message: err.message,
    stack_trace: err.stack ?? null,
    screen: options.screen ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    severity: options.severity ?? 'error',
    context: options.context ?? null,
  })
}

function installGlobalHandlers(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    void sendError({
      error_type: event.error?.name ?? 'UncaughtError',
      message: event.message || String(event.error),
      stack_trace: event.error?.stack ?? null,
      screen: window.location.pathname,
      severity: 'error',
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const err = reason instanceof Error ? reason : new Error(String(reason))
    void sendError({
      error_type: err.name || 'UnhandledRejection',
      message: err.message,
      stack_trace: err.stack ?? null,
      screen: window.location.pathname,
      severity: 'error',
    })
  })
}

function scheduleFlush() {
  if (_flushTimer) clearInterval(_flushTimer)
  _flushTimer = setInterval(() => void flush(), _config.syncIntervalSeconds * 1000)
}

export const paaq = { init, track, identify, page, flush, trackError }
