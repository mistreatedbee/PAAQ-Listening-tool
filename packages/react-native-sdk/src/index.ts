import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, AppStateStatus, Dimensions, Platform, View, type GestureResponderEvent, type ViewProps } from 'react-native'
import React from 'react'
import {
  createCredentials,
  DEFAULT_BASE_URL,
  EventQueue,
  HEARTBEAT_INTERVAL_MS,
  normalizeConfig,
  PaaqTransport,
  PAAQ_ENDPOINTS,
  type PaaqEnvironment,
} from '@paaq/sdk-core'

const SDK_VERSION = '1.0.0'
const DEVICE_ID_KEY = '@paaq:device_id'
const BACKGROUND_GRACE_MS = 30_000
const SCREENSHOT_INTERVAL_MS = 5_000

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

const transport = new PaaqTransport()
const queue = new EventQueue()

let _environment: PaaqEnvironment = 'production'
let _deviceId = ''
let _sessionId: string | null = null
let _sessionStartedAt = 0
let _sessionEnded = false
let _lastSignalAt = 0
let _debug = false
let _flushTimer: ReturnType<typeof setInterval> | null = null
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null
let _appStateSubscription: { remove(): void } | null = null
let _backgroundGraceTimer: ReturnType<typeof setTimeout> | null = null

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

function platformTag(): string {
  return Platform.OS === 'ios' ? 'ios-rn' : `${Platform.OS}-rn`
}

function log(...args: unknown[]) {
  if (_debug) console.log('[PAAQ]', ...args)
}

function collectDeviceMetadata() {
  const { width, height } = Dimensions.get('window')
  return {
    osName: Platform.OS === 'ios' ? 'iOS' : 'Android',
    osVersion: String(Platform.Version),
    deviceType: 'mobile',
    screenWidth: Math.round(width),
    screenHeight: Math.round(height),
  }
}

export async function initialize(options: InitOptions): Promise<InitResult> {
  _environment = options.environment ?? 'production'
  _debug = options.debug ?? false
  _deviceId = await getOrCreateDeviceId()

  transport.setCredentials(
    createCredentials(options.sdkToken, options.projectId, platformTag(), SDK_VERSION, _environment),
  )

  log('Initializing with deviceId', _deviceId)

  const data = await transport.sdkInit({
    deviceId: _deviceId,
    deviceMetadata: collectDeviceMetadata(),
  })

  if (data.ok && data.sessionId) {
    _sessionId = data.sessionId
    _sessionStartedAt = Date.now()
    _sessionEnded = false
    if (data.config) queue.setConfig(normalizeConfig(data.config))
    scheduleFlush()
    scheduleHeartbeat()
    watchAppState()
    startScreenshotLoop()
    log('Initialized, sessionId', _sessionId)
  } else if (data.error) {
    log('Init failed:', data.error)
  }
  return data
}

export function track(eventName: string, properties: Record<string, unknown> = {}) {
  _lastSignalAt = Date.now()
  queue.enqueue({ event_name: eventName, session_id: _sessionId, properties })
  log('Queued event', eventName, `(queue: ${queue.length})`)
  if (queue.shouldFlush()) void flush()
}

export function identify(userId: string, traits: Record<string, unknown> = {}) {
  track('$identify', { userId, ...traits })
}

export function screen(name: string, properties: Record<string, unknown> = {}) {
  track('$screen', { name, ...properties })
}

export async function flush(): Promise<void> {
  const batch = queue.drain()
  if (batch.length === 0) return
  log('Flushing', batch.length, 'events')
  await transport.postEvents(batch)
}

async function heartbeat(): Promise<void> {
  await transport.heartbeat(_deviceId)
}

function scheduleFlush() {
  if (_flushTimer) clearInterval(_flushTimer)
  const cfg = normalizeConfig()
  queue.setConfig(cfg)
  _flushTimer = setInterval(() => void flush(), cfg.syncIntervalSeconds * 1000)
}

function scheduleHeartbeat() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  _heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS)
}

function watchAppState() {
  _appStateSubscription?.remove()
  _appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') {
      void flush()
      if (_backgroundGraceTimer) clearTimeout(_backgroundGraceTimer)
      _backgroundGraceTimer = setTimeout(() => void endSession('completed'), BACKGROUND_GRACE_MS)
    } else if (state === 'active' && _backgroundGraceTimer) {
      clearTimeout(_backgroundGraceTimer)
      _backgroundGraceTimer = null
    }
  })
}

export async function endSession(outcome: string): Promise<void> {
  if (!_sessionId || _sessionEnded) return
  _sessionEnded = true
  const durationSeconds = _sessionStartedAt ? Math.round((Date.now() - _sessionStartedAt) / 1000) : undefined
  await transport.endSession(_sessionId, durationSeconds, outcome)
}

export async function dispose(): Promise<void> {
  if (_flushTimer) clearInterval(_flushTimer)
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  if (_backgroundGraceTimer) clearTimeout(_backgroundGraceTimer)
  if (_screenshotTimer) clearInterval(_screenshotTimer)
  _appStateSubscription?.remove()
  _flushTimer = null
  _heartbeatTimer = null
  _backgroundGraceTimer = null
  _screenshotTimer = null
  _appStateSubscription = null
  await flush()
  await endSession('completed')
}

export function trackNavigationScreen(routeName: string | undefined): void {
  if (routeName) screen(routeName)
}

let _maxScrollPct = 0
let _reportedScrollMilestones = new Set<number>()

export function trackScrollDepth(pct: number): void {
  if (pct <= _maxScrollPct) return
  _maxScrollPct = pct
  for (const milestone of [25, 50, 75, 100]) {
    if (pct >= milestone && !_reportedScrollMilestones.has(milestone)) {
      _reportedScrollMilestones.add(milestone)
      track('$scroll_depth', { pct: milestone })
    }
  }
}

export function resetScrollTracking(): void {
  _maxScrollPct = 0
  _reportedScrollMilestones = new Set()
}

const _fieldStartedAt = new Map<string, number>()
const _fieldBackspaceCounts = new Map<string, number>()

export function trackFieldFocus(fieldName: string): void {
  _fieldStartedAt.set(fieldName, Date.now())
  _fieldBackspaceCounts.set(fieldName, 0)
}

export function trackFieldBackspace(fieldName: string): void {
  _fieldBackspaceCounts.set(fieldName, (_fieldBackspaceCounts.get(fieldName) ?? 0) + 1)
}

export function trackFieldBlur(
  fieldName: string,
  options: { formName?: string; hadError?: boolean; completed?: boolean } = {},
): void {
  const startedAt = _fieldStartedAt.get(fieldName)
  const backspaces = _fieldBackspaceCounts.get(fieldName) ?? 0
  _fieldStartedAt.delete(fieldName)
  _fieldBackspaceCounts.delete(fieldName)
  track('$form_field', {
    fieldName,
    formName: options.formName ?? '',
    timeSpentMs: startedAt ? Date.now() - startedAt : 0,
    backspaceCount: backspaces,
    hadError: options.hadError ?? false,
    completed: options.completed ?? false,
  })
}

export function trackFormAbandon(formName: string): void {
  track('$form_abandon', { formName })
}

const RAGE_TAP_WINDOW_MS = 800
const RAGE_TAP_MIN_COUNT = 3
const RAGE_TAP_RADIUS = 40
const DEAD_TAP_DELAY_MS = 2500

let _recentTaps: { time: number; x: number; y: number }[] = []
let _rageCooldownUntil = 0

function handleGlobalTouch(x: number, y: number): void {
  const now = Date.now()
  _recentTaps = _recentTaps.filter((t) => now - t.time < RAGE_TAP_WINDOW_MS)
  _recentTaps.push({ time: now, x, y })
  const cluster = _recentTaps.filter((t) => Math.hypot(t.x - x, t.y - y) <= RAGE_TAP_RADIUS)
  if (cluster.length >= RAGE_TAP_MIN_COUNT && now > _rageCooldownUntil) {
    _rageCooldownUntil = now + RAGE_TAP_WINDOW_MS
    _recentTaps = []
    track('$rage_click', { x, y, tapCount: cluster.length })
  }
  const tapAt = now
  setTimeout(() => {
    if (_lastSignalAt < tapAt) track('$dead_click', { x, y })
  }, DEAD_TAP_DELAY_MS)
}

let _viewShotRef: View | null = null
let _screenshotTimer: ReturnType<typeof setInterval> | null = null
let _screenshotSequence = 0

function startScreenshotLoop(): void {
  if (_screenshotTimer) clearInterval(_screenshotTimer)
  _screenshotTimer = setInterval(() => void captureAndUploadScreenshot(), SCREENSHOT_INTERVAL_MS)
}

async function captureAndUploadScreenshot(): Promise<void> {
  if (_fieldStartedAt.size > 0 || !_sessionId || !_viewShotRef) return
  try {
    const { captureRef } = require('react-native-view-shot')
    const dataUri: string = await captureRef(_viewShotRef, { format: 'jpg', quality: 0.5, result: 'data-uri' })
    const blob = await (await fetch(dataUri)).blob()
    const params = new URLSearchParams({
      session_id: _sessionId,
      kind: 'screenshots',
      sequence: String(_screenshotSequence++),
      captured_at: new Date().toISOString(),
    })
    const creds = transport.getCredentials()
    if (!creds) return
    await fetch(`${DEFAULT_BASE_URL}${PAAQ_ENDPOINTS.sessionRecordingUpload}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        Authorization: `Bearer ${creds.sdkToken}`,
        'X-Project-ID': creds.projectId,
      },
      body: blob,
    })
  } catch {
    // optional peer dependency
  }
}

export function PaaqTouchTracker(props: { children?: React.ReactNode } & ViewProps) {
  const { children, ...rest } = props
  const ref = React.useRef<View>(null)

  React.useEffect(() => {
    _viewShotRef = ref.current
    return () => { _viewShotRef = null }
  }, [])

  return React.createElement(
    View,
    {
      ...rest,
      ref,
      style: [{ flex: 1 }, rest.style],
      onStartShouldSetResponderCapture: (event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent
        handleGlobalTouch(pageX, pageY)
        return false
      },
    },
    children,
  )
}

export const PAAQ = {
  initialize, track, identify, screen, flush, dispose, endSession, trackNavigationScreen,
  trackScrollDepth, resetScrollTracking, trackFieldFocus, trackFieldBackspace, trackFieldBlur, trackFormAbandon,
}
