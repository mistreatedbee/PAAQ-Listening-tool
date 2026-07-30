import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, AppStateStatus, Platform } from 'react-native'

const BASE_URL = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'
const SDK_VERSION = '1.0.0'
const DEVICE_ID_KEY = '@paaq:device_id'
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000

type EventPayload = {
  event_name: string
  session_id: string | null
  properties: Record<string, unknown>
  timestamp: string
}

export type InitOptions = {
  sdkToken: string
  projectId: string
  environment?: 'production' | 'staging' | 'development'
  debug?: boolean
}

export type InitResult = {
  ok: boolean
  sessionId?: string
  deviceId?: string
  error?: string
}

let _sdkToken = ''
let _projectKey = ''
let _environment = 'production'
let _deviceId = ''
let _sessionId: string | null = null
let _queue: EventPayload[] = []
let _batchSize = 50
let _flushIntervalMs = 30_000
let _debug = false
let _flushTimer: ReturnType<typeof setInterval> | null = null
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null
let _appStateSubscription: { remove(): void } | null = null

function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY)
    if (stored) return stored
    const id = uuidV4()
    await AsyncStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return uuidV4()
  }
}

function buildHeaders() {
  const platform = Platform.OS === 'ios' ? 'ios-rn' : `${Platform.OS}-rn`
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${_sdkToken}`,
    'X-Project-ID': _projectKey,
    'X-SDK-Version': SDK_VERSION,
    'X-Platform': platform,
    'X-Environment': _environment,
  }
}

function log(...args: unknown[]) {
  if (_debug) console.log('[PAAQ]', ...args)
}

export async function initialize(options: InitOptions): Promise<InitResult> {
  _sdkToken = options.sdkToken
  _projectKey = options.projectId
  _environment = options.environment ?? 'production'
  _debug = options.debug ?? false
  _deviceId = await getOrCreateDeviceId()

  log('Initializing with deviceId', _deviceId)

  try {
    const res = await fetch(`${BASE_URL}/sdk-init`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ deviceId: _deviceId }),
    })
    const data = (await res.json()) as InitResult & {
      config?: { batchSize: number; syncIntervalSeconds: number }
    }
    if (data.ok && data.sessionId) {
      _sessionId = data.sessionId
      if (data.config) {
        _batchSize = data.config.batchSize
        _flushIntervalMs = data.config.syncIntervalSeconds * 1000
      }
      scheduleFlush()
      scheduleHeartbeat()
      watchAppState()
      log('Initialized, sessionId', _sessionId)
    }
    return data
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Network error'
    log('Init failed:', error)
    return { ok: false, error }
  }
}

export function track(eventName: string, properties: Record<string, unknown> = {}) {
  _queue.push({
    event_name: eventName,
    session_id: _sessionId,
    properties,
    timestamp: new Date().toISOString(),
  })
  log('Queued event', eventName, `(queue: ${_queue.length})`)
  if (_queue.length >= _batchSize) void flush()
}

export function identify(userId: string, traits: Record<string, unknown> = {}) {
  track('$identify', { userId, ...traits })
}

export function screen(name: string, properties: Record<string, unknown> = {}) {
  track('$screen', { name, ...properties })
}

export async function flush(): Promise<void> {
  if (_queue.length === 0 || !_sdkToken) return
  const batch = _queue.splice(0)
  log('Flushing', batch.length, 'events')
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
    // fire-and-forget
  }
}

function scheduleFlush() {
  if (_flushTimer) clearInterval(_flushTimer)
  _flushTimer = setInterval(() => void flush(), _flushIntervalMs)
}

function scheduleHeartbeat() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  _heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS)
}

function watchAppState() {
  _appStateSubscription?.remove()
  _appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    // Flush before going to background — iOS suspends the JS engine shortly after
    if (state === 'background' || state === 'inactive') {
      void flush()
    }
  })
}

export async function dispose(): Promise<void> {
  if (_flushTimer) clearInterval(_flushTimer)
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  _appStateSubscription?.remove()
  _flushTimer = null
  _heartbeatTimer = null
  _appStateSubscription = null
  await flush()
}

export const PAAQ = { initialize, track, identify, screen, flush, dispose }
