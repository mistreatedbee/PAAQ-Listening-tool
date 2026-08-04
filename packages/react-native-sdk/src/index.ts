import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, AppStateStatus, Dimensions, Platform, View, type GestureResponderEvent, type ViewProps } from 'react-native'
import React from 'react'

const BASE_URL = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'
const SDK_VERSION = '1.0.0'
const DEVICE_ID_KEY = '@paaq:device_id'
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000
// Grace period after backgrounding before a session is considered ended —
// distinguishes a brief app-switch from the user actually being done.
const BACKGROUND_GRACE_MS = 30_000
// How often to capture a real screenshot for visual session replay.
const SCREENSHOT_INTERVAL_MS = 5_000

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
let _sessionStartedAt = 0
let _sessionEnded = false
let _lastSignalAt = 0
let _queue: EventPayload[] = []
let _batchSize = 50
let _flushIntervalMs = 30_000
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

// No new native dependency (react-native-device-info isn't a listed
// dependency of this package) — Platform + Dimensions are built into RN and
// cover OS name/version and screen size without requiring host apps to add
// anything.
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
      body: JSON.stringify({ deviceId: _deviceId, deviceMetadata: collectDeviceMetadata() }),
    })
    const data = (await res.json()) as InitResult & {
      config?: { batchSize: number; syncIntervalSeconds: number }
    }
    if (data.ok && data.sessionId) {
      _sessionId = data.sessionId
      _sessionStartedAt = Date.now()
      _sessionEnded = false
      if (data.config) {
        _batchSize = data.config.batchSize
        _flushIntervalMs = data.config.syncIntervalSeconds * 1000
      }
      scheduleFlush()
      scheduleHeartbeat()
      watchAppState()
      startScreenshotLoop()
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
  _lastSignalAt = Date.now()
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

// RN can't reliably intercept a hard app-kill (same limitation as native
// iOS/Android) — that case is left to session-sweep-cron server-side, which
// classifies a session that goes silent as 'timed_out'/'abandoned'. This SDK
// only positively detects "backgrounded past a grace period", reported as
// 'completed'.
function watchAppState() {
  _appStateSubscription?.remove()
  _appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') {
      // Flush before going to background — iOS suspends the JS engine shortly after
      void flush()
      if (_backgroundGraceTimer) clearTimeout(_backgroundGraceTimer)
      _backgroundGraceTimer = setTimeout(() => void endSession('completed'), BACKGROUND_GRACE_MS)
    } else if (state === 'active') {
      if (_backgroundGraceTimer) {
        clearTimeout(_backgroundGraceTimer)
        _backgroundGraceTimer = null
      }
    }
  })
}

export async function endSession(outcome: string): Promise<void> {
  if (!_sessionId || !_sdkToken || _sessionEnded) return
  _sessionEnded = true
  const durationSeconds = _sessionStartedAt ? Math.round((Date.now() - _sessionStartedAt) / 1000) : undefined
  try {
    await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ action: 'end', session_id: _sessionId, duration: durationSeconds, outcome }),
    })
  } catch {
    // fire-and-forget
  }
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

// Opt-in automatic screen tracking for @react-navigation/native apps — call
// from a NavigationContainer's onStateChange:
//
//   <NavigationContainer
//     ref={navigationRef}
//     onStateChange={() => trackNavigationScreen(navigationRef.current?.getCurrentRoute()?.name)}
//   >
//
// Not silently auto-installed since there's no universal RN router to hook.
export function trackNavigationScreen(routeName: string | undefined): void {
  if (routeName) screen(routeName)
}

// ── Behavior analytics ──────────────────────────────────────────────────
// Scroll and form tracking are opt-in (no app-wide hook exists in RN for
// either). Tap tracking is also opt-in here, unlike web/Android/iOS/Flutter
// — RN has no clean automatic global-touch hook in pure JS without a native
// module, so wrap your root view in <PaaqTouchTracker> instead.

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

  // No cheap way to hit-test "was this a real interactive component" from a
  // raw touch event, so dead-tap detection is purely temporal (no signal
  // followed the tap) — a looser heuristic than the web SDK's.
  const tapAt = now
  setTimeout(() => {
    if (_lastSignalAt < tapAt) track('$dead_click', { x, y })
  }, DEAD_TAP_DELAY_MS)
}

// ── Visual session replay (screenshots) ─────────────────────────────────
// Needs a real screenshot library — RN has no built-in "capture the current
// screen" API. react-native-view-shot is an OPTIONAL peer dependency:
// required dynamically only when a capture actually runs, so apps that
// don't install it just silently get no screenshots (everything else in
// this SDK still works). Reuses the same <PaaqTouchTracker> root wrapper as
// the capture boundary rather than asking apps to add a second wrapper.
let _viewShotRef: View | null = null
let _screenshotTimer: ReturnType<typeof setInterval> | null = null
let _screenshotSequence = 0

function startScreenshotLoop(): void {
  if (_screenshotTimer) clearInterval(_screenshotTimer)
  _screenshotTimer = setInterval(() => void captureAndUploadScreenshot(), SCREENSHOT_INTERVAL_MS)
}

async function captureAndUploadScreenshot(): Promise<void> {
  if (_fieldStartedAt.size > 0) return // paused while any form field is focused
  if (!_sessionId || !_sdkToken || !_viewShotRef) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { captureRef } = require('react-native-view-shot')
    const dataUri: string = await captureRef(_viewShotRef, { format: 'jpg', quality: 0.5, result: 'data-uri' })
    const blob = await (await fetch(dataUri)).blob()
    const sequence = _screenshotSequence++
    const params = new URLSearchParams({
      session_id: _sessionId,
      kind: 'screenshots',
      sequence: String(sequence),
      captured_at: new Date().toISOString(),
    })
    await fetch(`${BASE_URL}/session-recording-upload?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${_sdkToken}`, 'X-Project-ID': _projectKey },
      body: blob,
    })
  } catch {
    // react-native-view-shot not installed, or capture failed — skip silently
  }
}

/**
 * Wrap your app's root view to enable tap tracking (rage/dead-tap
 * detection) and, if react-native-view-shot is installed, screenshot-based
 * visual session replay — RN has no app-wide touch or screen-capture hook
 * in pure JS, so this is the opt-in mechanism for both:
 *
 *   <PaaqTouchTracker><App /></PaaqTouchTracker>
 *
 * Uses the responder-capture phase so it observes every touch without
 * intercepting it — child components still receive touches normally.
 */
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
        return false // never actually capture — just observe
      },
    },
    children,
  )
}

export const PAAQ = {
  initialize, track, identify, screen, flush, dispose, endSession, trackNavigationScreen,
  trackScrollDepth, resetScrollTracking, trackFieldFocus, trackFieldBackspace, trackFieldBlur, trackFormAbandon,
}
