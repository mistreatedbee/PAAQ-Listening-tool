import {
  createCredentials,
  EventQueue,
  HEARTBEAT_INTERVAL_MS,
  normalizeConfig,
  PaaqTransport,
  type ErrorPayload,
  type InitOptions,
  type InitResult,
  type PaaqConfig,
} from '@paaq/sdk-core'

const SDK_VERSION = '1.0.2'
const HEARTBEAT_INTERVAL_SECONDS = HEARTBEAT_INTERVAL_MS / 1000

type MinimalRequest = { method?: string; path?: string; url?: string }
type MinimalResponse = { statusCode: number; on(event: 'finish', cb: () => void): void }
type NextFn = () => void

const transport = new PaaqTransport()
const queue = new EventQueue()

let _deviceId = ''
let _sessionId: string | null = null
let _config: PaaqConfig = normalizeConfig()
let _flushTimer: ReturnType<typeof setInterval> | null = null
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null
let _lastHeartbeatAt = 0

function getDeviceId(): string {
  const host = typeof process !== 'undefined' ? process.env?.HOSTNAME ?? '' : ''
  const pid = typeof process !== 'undefined' ? process.pid : 0
  return `${host || 'host'}-${pid}`
}

async function initialize(options: InitOptions): Promise<InitResult> {
  const platform = options.platform ?? 'nodejs'
  const environment = options.environment ?? (process.env?.NODE_ENV === 'production' ? 'production' : 'development')

  transport.setCredentials(createCredentials(options.sdkToken, options.projectId, platform, SDK_VERSION, environment))
  _deviceId = getDeviceId()

  const data = await transport.sdkInit({ deviceId: _deviceId })
  if (data.ok && data.sessionId) {
    _sessionId = data.sessionId
    if (data.config) {
      _config = normalizeConfig(data.config)
      queue.setConfig(_config)
    }
    scheduleFlush()
    scheduleHeartbeat()
    pingIfActive()
    installProcessHandlers()
  }
  return data
}

function track(eventName: string, properties: Record<string, unknown> = {}) {
  pingIfActive()
  queue.enqueue({
    event_name: eventName,
    session_id: _sessionId,
    properties,
  })
  if (queue.shouldFlush()) void flush()
}

function identify(userId: string, traits: Record<string, unknown> = {}) {
  track('$identify', { userId, ...traits })
}

async function flush(): Promise<void> {
  const batch = queue.drain()
  await transport.postEvents(batch)
}

async function heartbeat(): Promise<void> {
  await transport.heartbeat(_deviceId)
}

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
  _heartbeatTimer = setInterval(() => {
    _lastHeartbeatAt = Date.now()
    void heartbeat()
  }, HEARTBEAT_INTERVAL_MS)
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

function trackError(
  error: unknown,
  options: { severity?: ErrorPayload['severity']; context?: Record<string, unknown> } = {},
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  void transport.postError({
    error_type: err.name || 'Error',
    message: err.message,
    stack_trace: err.stack ?? null,
    severity: options.severity ?? 'error',
    context: options.context ?? null,
    session_id: _sessionId,
  })
}

function installProcessHandlers(): void {
  process.on('uncaughtException', (err) => {
    void transport.postError({
      error_type: err.name,
      message: err.message,
      stack_trace: err.stack ?? null,
      severity: 'fatal',
      session_id: _sessionId,
    })
  })
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason))
    void transport.postError({
      error_type: err.name || 'UnhandledRejection',
      message: err.message,
      stack_trace: err.stack ?? null,
      severity: 'error',
      session_id: _sessionId,
    })
  })
}

function shutdown() {
  if (_flushTimer) clearInterval(_flushTimer)
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  _flushTimer = null
  _heartbeatTimer = null
  void flush()
}

export type { InitOptions, InitResult, PaaqConfig }
export const PAAQ = { initialize, track, identify, middleware, flush, shutdown, trackError }
