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
let _sessionStartedAt = 0
let _sessionEnded = false
let _hadFatalError = false
let _queue: EventPayload[] = []
let _config: PaaqConfig = { batchSize: 50, syncIntervalSeconds: 30 }
let _flushTimer: ReturnType<typeof setInterval> | null = null

type DeviceMetadata = {
  userAgent: string | null
  screenWidth: number | null
  screenHeight: number | null
  viewportWidth: number | null
  viewportHeight: number | null
  timezone: string | null
  locale: string | null
  connectionType: string | null
  referrer: string | null
  entryUrl: string | null
}

function collectDeviceMetadata(): DeviceMetadata {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  const scr = typeof screen !== 'undefined' ? screen : null
  return {
    userAgent: nav?.userAgent ?? null,
    screenWidth: scr?.width ?? null,
    screenHeight: scr?.height ?? null,
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : null,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : null,
    timezone: (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null } catch { return null }
    })(),
    locale: nav?.language ?? null,
    // deno-lint-ignore no-explicit-any
    connectionType: (nav as any)?.connection?.effectiveType ?? null,
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    entryUrl: typeof window !== 'undefined' ? window.location.href : null,
  }
}

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
      body: JSON.stringify({ deviceId: getDeviceId(), deviceMetadata: collectDeviceMetadata() }),
    })
    const data: InitResult = await res.json()
    if (data.ok && data.sessionId) {
      _sessionId = data.sessionId
      _sessionStartedAt = Date.now()
      _sessionEnded = false
      _hadFatalError = false
      if (data.config) _config = data.config
      scheduleFlush()
      installGlobalHandlers()
      installAutoPageTracking()
      installSessionEndHandlers()
      installClickTracking()
      installScrollTracking()
      installFormTracking()
    }
    return data
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

let _lastSignalAt = 0

function track(eventName: string, properties: Record<string, unknown> = {}) {
  _lastSignalAt = Date.now()
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
    _hadFatalError = true
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

// History API has no native "navigated" event — pushState/replaceState are
// monkey-patched so page() fires automatically on every client-side route
// change, matching how Sentry/analytics SDKs instrument SPA routers without
// depending on any specific router library.
function installAutoPageTracking(): void {
  if (typeof window === 'undefined') return
  const emit = () => page()
  const originalPush = history.pushState
  history.pushState = function (...args: Parameters<History['pushState']>) {
    originalPush.apply(this, args)
    emit()
  }
  const originalReplace = history.replaceState
  history.replaceState = function (...args: Parameters<History['replaceState']>) {
    originalReplace.apply(this, args)
    emit()
  }
  window.addEventListener('popstate', emit)
}

// The web SDK can only positively detect a normal browser-level exit — it
// cannot know whether the user "finished a task." 'completed' here means
// "the session ended via a normal exit signal," downgraded to 'crashed' if
// a fatal JS error was seen first. 'abandoned'/'timed_out'/'force_closed'
// are left to session-sweep-cron, which can see whether the session ever
// had real interactions. 'logged_out' requires the host app to call
// endSession() explicitly — the SDK cannot infer a logout on its own.
function installSessionEndHandlers(): void {
  if (typeof window === 'undefined') return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') endOnce(_hadFatalError ? 'crashed' : 'completed')
  })
  window.addEventListener('pagehide', () => endOnce(_hadFatalError ? 'crashed' : 'completed'))
  // beforeunload is unreliable as a primary signal (especially mobile Safari) —
  // used only as a last-chance flush, not the outcome decision.
  window.addEventListener('beforeunload', () => { void flush() })
}

function endOnce(outcome: string): void {
  void flush()
  void endSession(outcome)
}

async function endSession(outcome: string): Promise<void> {
  if (!_sessionId || !_sdkToken || _sessionEnded) return
  _sessionEnded = true
  const durationSeconds = _sessionStartedAt ? Math.round((Date.now() - _sessionStartedAt) / 1000) : undefined
  const payload = JSON.stringify({ action: 'end', session_id: _sessionId, duration: durationSeconds, outcome })
  const sent = typeof navigator !== 'undefined' && navigator.sendBeacon
    ? navigator.sendBeacon(`${BASE_URL}/sessions`, new Blob([payload], { type: 'application/json' }))
    : false
  if (!sent) {
    try {
      await fetch(`${BASE_URL}/sessions`, { method: 'POST', headers: buildHeaders(), body: payload, keepalive: true })
    } catch {
      // fire-and-forget
    }
  }
}

const RAGE_CLICK_WINDOW_MS = 800
const RAGE_CLICK_MIN_COUNT = 3
const RAGE_CLICK_RADIUS_PX = 40
const DEAD_CLICK_DELAY_MS = 2500

let _recentClicks: { time: number; x: number; y: number; target: EventTarget | null }[] = []
let _rageCooldownUntil = 0

function cssPath(el: Element | null): string {
  if (!el) return 'unknown'
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const cls = el.classList.length ? `.${Array.from(el.classList).slice(0, 2).join('.')}` : ''
  return `${tag}${id}${cls}`
}

function isInteractiveElement(el: Element | null): boolean {
  if (!el) return false
  if (el.closest('a, button, input, select, textarea, label, [role="button"], [onclick], summary')) return true
  try {
    return getComputedStyle(el).cursor === 'pointer'
  } catch {
    return false
  }
}

// Click/tap handling — mobile browsers fire a synthetic 'click' after a tap,
// so this single listener covers both desktop mouse clicks and phone taps.
function installClickTracking(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null
    const now = Date.now()
    const x = event.clientX
    const y = event.clientY

    // ── Rage click: 3+ clicks in quick succession, close together ──
    _recentClicks = _recentClicks.filter((c) => now - c.time < RAGE_CLICK_WINDOW_MS)
    _recentClicks.push({ time: now, x, y, target })
    const cluster = _recentClicks.filter(
      (c) => Math.hypot(c.x - x, c.y - y) <= RAGE_CLICK_RADIUS_PX,
    )
    if (cluster.length >= RAGE_CLICK_MIN_COUNT && now > _rageCooldownUntil) {
      _rageCooldownUntil = now + RAGE_CLICK_WINDOW_MS
      _recentClicks = []
      track('$rage_click', { targetSelector: cssPath(target), x, y, tapCount: cluster.length })
    }

    // ── Dead click: no other tracked signal followed within the delay ──
    if (!isInteractiveElement(target)) {
      const clickedAt = now
      const startUrl = window.location.href
      setTimeout(() => {
        if (_lastSignalAt >= clickedAt || window.location.href !== startUrl) return
        track('$dead_click', { targetSelector: cssPath(target), x, y })
      }, DEAD_CLICK_DELAY_MS)
    }
  }, { passive: true })
}

const SCROLL_MILESTONES = [25, 50, 75, 100]
let _maxScrollPct = 0
let _reportedScrollMilestones = new Set<number>()
let _scrollThrottle: ReturnType<typeof setTimeout> | null = null

function currentScrollPct(): number {
  const doc = document.documentElement
  const scrollable = doc.scrollHeight - doc.clientHeight
  if (scrollable <= 0) return 100
  return Math.round((Math.min(window.scrollY, scrollable) / scrollable) * 100)
}

function installScrollTracking(): void {
  if (typeof window === 'undefined') return
  const onScroll = () => {
    const pct = currentScrollPct()
    if (pct <= _maxScrollPct) return
    _maxScrollPct = pct
    for (const milestone of SCROLL_MILESTONES) {
      if (pct >= milestone && !_reportedScrollMilestones.has(milestone)) {
        _reportedScrollMilestones.add(milestone)
        track('$scroll_depth', { pct: milestone })
      }
    }
  }
  window.addEventListener('scroll', () => {
    if (_scrollThrottle) return
    _scrollThrottle = setTimeout(() => {
      _scrollThrottle = null
      onScroll()
    }, 250)
  }, { passive: true })

  // Reset per-page-view so scroll depth is measured per page, not cumulatively.
  window.addEventListener('popstate', () => {
    _maxScrollPct = 0
    _reportedScrollMilestones = new Set()
  })
}

type FieldState = { startedAt: number; backspaces: number }
const _fieldState = new WeakMap<Element, FieldState>()
const _touchedForms = new WeakMap<HTMLFormElement, boolean>() // true once submitted

function isFormField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return !!el && el instanceof Element && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

function fieldHasError(el: Element): boolean {
  if (el.getAttribute('aria-invalid') === 'true') return true
  if (el.classList.contains('error') || el.classList.contains('is-invalid') || el.classList.contains('invalid')) return true
  if ('validity' in el && (el as HTMLInputElement).validity && !(el as HTMLInputElement).validity.valid) {
    return (el as HTMLInputElement).value.length > 0 // only "has error" once the user's actually typed something
  }
  return false
}

function installFormTracking(): void {
  if (typeof document === 'undefined') return

  document.addEventListener('focusin', (event) => {
    const el = event.target
    if (!isFormField(el)) return
    _fieldState.set(el, { startedAt: Date.now(), backspaces: 0 })
    const form = el.closest('form')
    if (form && !_touchedForms.has(form)) _touchedForms.set(form, false)
  })

  document.addEventListener('keydown', (event) => {
    const el = event.target
    if (event.key !== 'Backspace' || !isFormField(el)) return
    const state = _fieldState.get(el)
    if (state) state.backspaces += 1
  })

  document.addEventListener('focusout', (event) => {
    const el = event.target
    if (!isFormField(el)) return
    const state = _fieldState.get(el)
    if (!state) return
    _fieldState.delete(el)
    track('$form_field', {
      page: window.location.pathname,
      formName: el.closest('form')?.getAttribute('name') ?? el.closest('form')?.id ?? null,
      fieldName: el.name || el.id || cssPath(el),
      timeSpentMs: Date.now() - state.startedAt,
      backspaceCount: state.backspaces,
      hadError: fieldHasError(el),
      completed: el.value.trim().length > 0,
    })
  })

  document.addEventListener('submit', (event) => {
    const form = event.target
    if (form instanceof HTMLFormElement) _touchedForms.set(form, true)
  })

  const reportAbandonedForms = () => {
    document.querySelectorAll('form').forEach((form) => {
      if (_touchedForms.has(form) && _touchedForms.get(form) === false) {
        track('$form_abandon', { formName: form.getAttribute('name') ?? form.id ?? null, page: window.location.pathname })
        _touchedForms.set(form, true) // don't report twice
      }
    })
  }
  window.addEventListener('pagehide', reportAbandonedForms)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') reportAbandonedForms()
  })
}

function scheduleFlush() {
  if (_flushTimer) clearInterval(_flushTimer)
  _flushTimer = setInterval(() => void flush(), _config.syncIntervalSeconds * 1000)
}

export const paaq = { init, track, identify, page, flush, trackError, endSession }
