import { record } from 'rrweb'
import {
  createCredentials,
  DEFAULT_BASE_URL,
  EventQueue,
  normalizeConfig,
  PaaqTransport,
  type ErrorPayload,
  type InitResult,
  type PaaqConfig,
  type PaaqEnvironment,
} from '@paaq/sdk-core'

const BASE_URL = DEFAULT_BASE_URL
// Was hardcoded '1.0.0' since the very first release and never updated
// across every version bump since — every X-SDK-Version header sent by
// every install of this SDK has been wrong the entire time, which made
// "is a customer actually running the new build" impossible to answer
// from server-side logs alone. Now kept in lockstep with package.json.
const SDK_VERSION = '1.3.1'

const transport = new PaaqTransport()
const queue = new EventQueue()

export type { PaaqConfig, InitResult }

let _platform = 'react'
let _environment: PaaqEnvironment =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? 'production' : 'development'
let _sessionId: string | null = null
let _currentUserId: string | null = null
// Set by identify() whenever it resolves a real user_id but no session
// exists yet to link it to (host app called identify() before init()
// resolved). NOT reset by init() — unlike _currentUserId, this survives
// across the reset so init() can finish the link once a session exists.
let _pendingIdentifyUserId: string | null = null
let _sessionStartedAt = 0
let _sessionEnded = false
let _hadFatalError = false
let _config: PaaqConfig = normalizeConfig()
let _flushTimer: ReturnType<typeof setInterval> | null = null
// Page-level listeners (click, errors, console, visible UI messages) must
// only be installed once. init() runs again for every new session on the
// same page; re-wrapping console / stacking MutationObservers would
// duplicate every captured error. DOM recording is per-session and is
// installed separately because it is torn down on session end.
let _listenersInstalled = false

type LastClick = {
  targetLabel: string
  targetSelector: string
  x: number
  y: number
  at: string
  page: string
}
let _lastClick: LastClick | null = null

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
  pixelRatio: number | null
  orientation: string | null
  touchSupport: boolean | null
  cpuCores: number | null
  memoryGb: number | null
}

function collectDeviceMetadata(): DeviceMetadata {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  const scr = typeof screen !== 'undefined' ? screen : null
  const win = typeof window !== 'undefined' ? window : null
  // deno-lint-ignore no-explicit-any
  const navAny = nav as any
  return {
    userAgent: nav?.userAgent ?? null,
    screenWidth: scr?.width ?? null,
    screenHeight: scr?.height ?? null,
    viewportWidth: win?.innerWidth ?? null,
    viewportHeight: win?.innerHeight ?? null,
    timezone: (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null } catch { return null }
    })(),
    locale: nav?.language ?? null,
    connectionType: navAny?.connection?.effectiveType ?? null,
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    entryUrl: win ? win.location.href : null,
    pixelRatio: win?.devicePixelRatio ?? null,
    orientation: (() => {
      if (!win) return null
      try {
        const type = (screen as any)?.orientation?.type as string | undefined
        if (type) return type.startsWith('portrait') ? 'portrait' : 'landscape'
        return win.innerWidth >= win.innerHeight ? 'landscape' : 'portrait'
      } catch { return null }
    })(),
    touchSupport: win ? 'ontouchstart' in win : null,
    cpuCores: nav?.hardwareConcurrency ?? null,
    memoryGb: navAny?.deviceMemory ?? null,
  }
}

function isConfigured(): boolean {
  return Boolean(transport.getCredentials()?.sdkToken)
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
  options: { platform?: string; appVersion?: string } = {},
): Promise<InitResult> {
  _platform = options.platform ?? 'react'
  transport.setCredentials(createCredentials(sdkToken, projectKey, _platform, SDK_VERSION, _environment))

  try {
    const data = await transport.sdkInit({
      deviceId: getDeviceId(),
      appVersion: options.appVersion,
      deviceMetadata: collectDeviceMetadata(),
    })
    if (data.ok && data.sessionId) {
      _sessionId = data.sessionId
      _sessionStartedAt = Date.now()
      _sessionEnded = false
      _hadFatalError = false
      if (data.config) {
        _config = normalizeConfig(data.config)
        queue.setConfig(_config)
      }
      scheduleFlush()
      installPageListeners()
      installDomRecording()
      // A fresh session does NOT mean a new, unknown user — this init() runs
      // again every time a new session starts (page reload, a previous
      // session timing out/ending, a new tab), which on a real SPA happens
      // far more often than the user actually logging in again. Previously
      // this unconditionally reset _currentUserId to null here, silently
      // un-identifying the user the moment their very first session ended —
      // every session after that stayed "Anonymous" until the host app
      // happened to call identify() again, which most apps only do once,
      // right after login. If a user is already known from earlier in this
      // page's lifecycle, carry that identity onto the new session instead
      // of forgetting it; only an explicit identify() call with a different
      // id should ever actually change who the current user is.
      if (_currentUserId) {
        _pendingIdentifyUserId = _currentUserId
        void linkSessionToUser()
      } else if (_pendingIdentifyUserId) {
        // Handles the common race where the host app calls identify() (e.g.
        // reacting to its own auth state) before this init() round-trip has
        // resolved: identify()'s /users call can finish and resolve a real
        // user_id while _sessionId is still null, silently skipping the
        // link step. Link it now that a session actually exists.
        void linkSessionToUser()
      }
    }
    return data
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

let _lastSignalAt = 0

function track(eventName: string, properties: Record<string, unknown> = {}) {
  _lastSignalAt = Date.now()
  _perfEventCount++
  queue.enqueue({
    event_name: eventName,
    session_id: _sessionId,
    user_id: _currentUserId,
    properties,
  })
  if (queue.shouldFlush()) void flush()
}

// Resolves/creates the user via the `/users` endpoint (keyed on the caller's
// own external_user_id) and links the resulting user_id onto the current
// session immediately — not just once the session closes — so Identity/
// Email/Type/Lifetime-sessions populate right away in the dashboard.
async function identify(userId: string, traits: Record<string, unknown> = {}): Promise<void> {
  track('$identify', { userId, ...traits })

  if (!isConfigured()) return
  try {
    const email = typeof traits.email === 'string' ? traits.email : undefined
    const data = await transport.resolveUser(userId, email)
    if (!data.ok || !data.userId) {
      console.warn('[paaq] identify() failed to resolve a user', data.error)
      return
    }

    _currentUserId = data.userId
    _pendingIdentifyUserId = data.userId
    await linkSessionToUser()
  } catch (err) {
    console.warn('[paaq] identify() failed', err)
  }
}

// Shared by identify() (once /users resolves) and init() (once a session
// exists) — whichever of the two finishes second is the one that actually
// performs the link, closing the race between "app already knows who the
// user is" and "SDK still hasn't gotten a session back from sdk-init."
async function linkSessionToUser(): Promise<void> {
  if (!_sessionId || !_pendingIdentifyUserId) return
  const userId = _pendingIdentifyUserId
  try {
    const ok = await transport.linkSessionToUser(_sessionId, userId)
    if (!ok) {
      console.warn('[paaq] failed to link session to user — will retry on next identify/session')
      return
    }
    _pendingIdentifyUserId = null
  } catch (err) {
    console.warn('[paaq] failed to link session to user', err)
  }
}

function page(pageName?: string, properties: Record<string, unknown> = {}) {
  track('$page_view', {
    page: pageName ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
    ...properties,
  })
}

async function flush(): Promise<void> {
  if (!isConfigured()) return
  const batch = queue.drain()
  await transport.postEvents(batch)
}

async function sendError(payload: ErrorPayload): Promise<void> {
  if (!isConfigured()) return
  _perfErrorCount++
  await flush()
  void captureErrorRecordingWindow()
  const context: Record<string, unknown> = {
    ...(payload.context && typeof payload.context === 'object' ? payload.context : {}),
    ...(_lastClick ? { lastClick: _lastClick } : {}),
  }
  await transport.postError({
    ...payload,
    session_id: payload.session_id ?? _sessionId,
    context: Object.keys(context).length > 0 ? context : null,
  })
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

function installPageListeners(): void {
  if (_listenersInstalled) return
  _listenersInstalled = true
  installGlobalHandlers()
  installAutoPageTracking()
  installSessionEndHandlers()
  installClickTracking()
  installScrollTracking()
  installFormTracking()
  installDoubleClickTracking()
  installCopyPasteTracking()
  installKeyboardTracking()
  installDownloadTracking()
  installUploadTracking()
  installHoverTracking()
  installVisibleErrorCapture()
  installPerfMonitoring()
}

// ── Performance monitoring ──────────────────────────────────────────────
// Every metric pushed here is a real, browser-measured signal — no
// synthetic/placeholder heartbeat, matching how the rest of this SDK
// reports only genuine observations. There is no browser API for CPU
// usage, so it is deliberately left uncollected rather than invented.
const PERF_FLUSH_INTERVAL_MS = 30_000
const FPS_WINDOW_MS = 1_000

type PerfMetric = { metric_type: string; value: number; metadata?: Record<string, unknown> }

let _perfTimer: ReturnType<typeof setInterval> | null = null
let _responseTimes: number[] = []
let _fpsSamples: number[] = []
let _perfEventCount = 0
let _perfErrorCount = 0

function installPerfMonitoring(): void {
  if (typeof window === 'undefined') return

  // Real network timings for the host page's own fetch/XHR calls — PAAQ's
  // own telemetry requests (BASE_URL) are excluded so the SDK never ends up
  // measuring itself.
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          if (entry.name.startsWith(BASE_URL)) continue
          if (entry.initiatorType !== 'fetch' && entry.initiatorType !== 'xmlhttprequest') continue
          if (entry.duration > 0) _responseTimes.push(entry.duration)
        }
      })
      resourceObserver.observe({ entryTypes: ['resource'] })
    } catch {
      // entry type unsupported in this browser — skip silently
    }

    try {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceNavigationTiming[]) {
          if (entry.duration > 0) _responseTimes.push(entry.duration)
        }
      })
      navObserver.observe({ entryTypes: ['navigation'] })
    } catch {
      // ignore
    }
  }

  // Real rendered-frame rate, sampled via requestAnimationFrame. Browsers
  // pause rAF while a tab is hidden rather than firing it slowly, so a
  // window whose elapsed time is wildly inflated is a backgrounded tab
  // resuming, not real jank — skip recording that window instead of
  // reporting a fake fps crash.
  let frames = 0
  let windowStart = performance.now()
  const tick = (now: number) => {
    frames++
    const elapsed = now - windowStart
    if (elapsed >= FPS_WINDOW_MS) {
      if (elapsed < FPS_WINDOW_MS * 3) {
        _fpsSamples.push(Math.round((frames * 1000) / elapsed))
      }
      frames = 0
      windowStart = now
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  _perfTimer = setInterval(() => void flushPerf(), PERF_FLUSH_INTERVAL_MS)
}

async function flushPerf(): Promise<void> {
  if (!isConfigured()) return
  const metrics: PerfMetric[] = []

  if (_responseTimes.length > 0) {
    const avg = _responseTimes.reduce((a, b) => a + b, 0) / _responseTimes.length
    metrics.push({ metric_type: 'response_time', value: Math.round(avg), metadata: { sampleCount: _responseTimes.length } })
    _responseTimes = []
  }

  if (_fpsSamples.length > 0) {
    const avg = _fpsSamples.reduce((a, b) => a + b, 0) / _fpsSamples.length
    metrics.push({ metric_type: 'fps', value: Math.round(avg), metadata: { sampleCount: _fpsSamples.length } })
    _fpsSamples = []
  }

  const totalSignals = _perfEventCount + _perfErrorCount
  if (totalSignals > 0) {
    metrics.push({
      metric_type: 'error_rate',
      value: Math.round((_perfErrorCount / totalSignals) * 10000) / 100,
      metadata: { errors: _perfErrorCount, events: _perfEventCount },
    })
    _perfEventCount = 0
    _perfErrorCount = 0
  }

  // performance.memory is Chrome-only — report the real reading where the
  // browser exposes it, never a fabricated value where it doesn't.
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
  if (mem && mem.jsHeapSizeLimit > 0) {
    metrics.push({ metric_type: 'memory', value: Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 10000) / 100 })
  }

  if (metrics.length === 0) return
  await transport.postPerformance(metrics)
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
  installConsoleCapture()
}

// window.onerror/unhandledrejection only ever see thrown exceptions — an app
// that calls console.error('something broke', details) without throwing was
// previously invisible to PAAQ entirely. Wrap console.error/warn to report
// through the same real sendError() pipeline, while still calling the
// original console method so devtools output is completely unaffected.
// _inConsoleCapture guards against sendError (or anything it triggers)
// itself logging via console.error and recursing forever.
let _inConsoleCapture = false
function installConsoleCapture(): void {
  if (typeof console === 'undefined') return

  const wrap = (method: 'error' | 'warn', severity: ErrorPayload['severity']) => {
    const original = console[method].bind(console)
    console[method] = (...args: unknown[]) => {
      original(...args)
      if (_inConsoleCapture) return
      _inConsoleCapture = true
      try {
        const message = args.map((a) => {
          if (a instanceof Error) return a.message
          if (typeof a === 'string') return a
          try { return JSON.stringify(a) } catch { return String(a) }
        }).join(' ')
        const errArg = args.find((a): a is Error => a instanceof Error)
        void sendError({
          error_type: method === 'error' ? 'ConsoleError' : 'ConsoleWarning',
          message: message || `console.${method} called with no message`,
          stack_trace: errArg?.stack ?? null,
          screen: typeof window !== 'undefined' ? window.location.pathname : null,
          severity,
        })
      } finally {
        _inConsoleCapture = false
      }
    }
  }

  wrap('error', 'error')
  wrap('warn', 'warning')
}

// ── Visible UI error messages ───────────────────────────────────────────
// Thrown exceptions and console.error never see the copy a user actually
// reads — toasts, inline validation, alert banners, role="alert" regions.
// Watch the DOM for those nodes appearing and report the real text through
// the same sendError() pipeline so they show up on the interaction timeline.
const UI_ERROR_SELECTOR = [
  '[role="alert"]',
  '[role="alertdialog"]',
  '[aria-live="assertive"]',
  '[aria-invalid="true"]',
  '[data-sonner-toast][data-type="error"]',
  '.Toastify__toast--error',
  '.toast-error',
  '.alert-danger',
  '.alert-error',
  '.error-message',
  '.field-error',
  '.form-error',
  '.text-destructive',
  '.text-danger',
  '.MuiAlert-standardError',
  '.ant-alert-error',
].join(',')

const UI_ERROR_CLASS_RE = /\b(error-message|field-error|form-error|toast-error|alert-error|alert-danger|text-destructive|text-danger|is-error)\b/i

const _recentUiErrors = new Map<string, number>()

function textOf(el: Element | null | undefined): string | null {
  if (!el) return null
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text.length < 3 || text.length > 400) return null
  return text
}

function isShown(el: Element): boolean {
  if (el.getAttribute('aria-hidden') === 'true') return false
  try {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  } catch {
    return false
  }
}

function looksLikeUiError(el: Element): boolean {
  const role = el.getAttribute('role')
  if (role === 'alert' || role === 'alertdialog') return true
  if (el.getAttribute('aria-live') === 'assertive') return true
  if (el.getAttribute('aria-invalid') === 'true') return true
  const cls = typeof el.className === 'string' ? el.className : ''
  return UI_ERROR_CLASS_RE.test(cls)
}

function messageFromUiError(el: Element): string | null {
  const describedBy = el.getAttribute('aria-errormessage') || el.getAttribute('aria-describedby')
  if (describedBy) {
    const fromId = describedBy.split(/\s+/).map((id) => textOf(document.getElementById(id))).find(Boolean)
    if (fromId) return fromId
  }
  if ('validationMessage' in el) {
    const native = (el as HTMLInputElement).validationMessage
    if (native) return native
  }
  return textOf(el)
}

function reportUiError(errorType: string, message: string, extra?: Record<string, unknown>): void {
  const now = Date.now()
  const last = _recentUiErrors.get(message)
  if (last && now - last < 8000) return
  _recentUiErrors.set(message, now)
  if (_recentUiErrors.size > 40) {
    for (const [key, at] of _recentUiErrors) {
      if (now - at > 8000) _recentUiErrors.delete(key)
    }
  }
  void sendError({
    error_type: errorType,
    message,
    stack_trace: null,
    screen: typeof window !== 'undefined' ? window.location.pathname : null,
    severity: 'error',
    context: extra ?? null,
  })
}

function captureUiErrorNode(el: Element): void {
  if (!looksLikeUiError(el) && !el.matches?.(UI_ERROR_SELECTOR)) return
  if (!isShown(el)) return
  const message = messageFromUiError(el)
  if (!message) return
  reportUiError('UiError', message, { selector: cssPath(el) })
}

function installVisibleErrorCapture(): void {
  if (typeof document === 'undefined') return

  const scan = (root: ParentNode) => {
    if (root instanceof Element) captureUiErrorNode(root)
    if ('querySelectorAll' in root) {
      root.querySelectorAll(UI_ERROR_SELECTOR).forEach((node) => captureUiErrorNode(node))
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node)
        })
      } else if (m.type === 'attributes' && m.target instanceof Element) {
        captureUiErrorNode(m.target)
      } else if (m.type === 'characterData') {
        const parent = m.target.parentElement
        if (parent) captureUiErrorNode(parent)
      }
    }
  })
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'role', 'aria-live', 'aria-invalid', 'aria-hidden'],
  })

  // Native browser validation bubble — the exact string the user sees when
  // they submit an invalid field. $form_field already records this as an
  // event; also land it on the errors table so the timeline's error rows
  // include it.
  document.addEventListener('invalid', (event) => {
    const el = event.target
    if (!(el instanceof Element)) return
    const message = messageFromUiError(el)
    if (message) reportUiError('ValidationError', message, { selector: cssPath(el) })
  }, true)

  const originalAlert = window.alert.bind(window)
  window.alert = (message?: unknown) => {
    const text = message == null ? '' : String(message)
    if (text) reportUiError('Alert', text)
    return originalAlert(message as string)
  }
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
  // visibilitychange firing 'hidden' does NOT mean the user left — it fires
  // on every ordinary tab switch, alt-tab, or window-minimize, which happens
  // constantly during completely normal use. Treating it as a real exit
  // signal was ending a session (marked 'completed', even though nothing
  // was actually finished) every time the tab lost focus, then starting a
  // brand new, unlinked, empty session the moment it came back — one real
  // 20-minute visit was fracturing into a dozen ~20-second "sessions,"
  // which is also why identity/page counts looked broken: most of those
  // fragments never lived long enough for identify() or a page view to
  // land. Only flush pending data here, in case the tab really is about to
  // be killed — pagehide (below) is the real, reliable "user actually
  // navigated away or closed the tab" signal, and is the only thing that
  // should end the session client-side. Anything left genuinely idle
  // forever is session-sweep-cron's job, server-side, on a real timeout.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { void flush(); void flushPerf() }
  })
  window.addEventListener('pagehide', () => endOnce(_hadFatalError ? 'crashed' : 'completed'))
  // beforeunload is unreliable as a primary signal (especially mobile Safari) —
  // used only as a last-chance flush, not the outcome decision.
  window.addEventListener('beforeunload', () => { void flush(); void flushPerf() })
}

function teardownDomRecording(): void {
  _recordingStop?.()
  _recordingStop = null
  if (_recordingFlushTimer) {
    clearInterval(_recordingFlushTimer)
    _recordingFlushTimer = null
  }
  if (_postErrorFlushTimer) {
    clearTimeout(_postErrorFlushTimer)
    _postErrorFlushTimer = null
  }
  _recordingBuffer = []
}

/** Flush DOM recording around an error: capture pre-error state immediately, then post-error window. */
function captureErrorRecordingWindow(): void {
  if (!_recordingStop) return
  void flushRecording({ keepalive: false })
  if (_postErrorFlushTimer) clearTimeout(_postErrorFlushTimer)
  _postErrorFlushTimer = setTimeout(() => {
    void flushRecording({ keepalive: false })
    _postErrorFlushTimer = null
  }, POST_ERROR_CAPTURE_MS)
}

function endOnce(outcome: string): void {
  void endSession(outcome)
}

async function endSession(outcome: string): Promise<void> {
  if (!_sessionId || !isConfigured() || _sessionEnded) return
  _sessionEnded = true
  await flush()
  void flushPerf()
  await flushRecording({ keepalive: true })
  teardownDomRecording()
  const durationSeconds = _sessionStartedAt ? Math.round((Date.now() - _sessionStartedAt) / 1000) : undefined
  await transport.endSession(_sessionId, durationSeconds, outcome, { keepalive: true })
}

// ── Double click tracking ───────────────────────────────────────────────
function installDoubleClickTracking(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('dblclick', (event) => {
    const target = event.target as Element | null
    track('$double_click', {
      targetSelector: cssPath(target),
      targetLabel: clickableLabel(target),
      x: event.clientX,
      y: event.clientY,
      page: window.location.pathname,
    })
  }, { passive: true })
}

// ── Copy / paste tracking ───────────────────────────────────────────────
function installCopyPasteTracking(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('copy', (event) => {
    const selection = window.getSelection()?.toString() ?? ''
    track('$copy', {
      page: window.location.pathname,
      charCount: selection.length,
      targetSelector: cssPath(event.target as Element | null),
    })
  }, { passive: true })
  document.addEventListener('paste', (event) => {
    const text = (event as ClipboardEvent).clipboardData?.getData('text') ?? ''
    track('$paste', {
      page: window.location.pathname,
      charCount: text.length,
      targetSelector: cssPath(event.target as Element | null),
    })
  }, { passive: true })
}

// ── Keyboard shortcut tracking ──────────────────────────────────────────
// Only capture modifier + key combos (Ctrl/Cmd + something) — never raw
// keystrokes so user input is never recorded.
const TRACKED_SHORTCUTS = new Set(['a', 'c', 'v', 'x', 'z', 'y', 'f', 's', 'p'])
function installKeyboardTracking(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && TRACKED_SHORTCUTS.has(key)) {
      track('$keyboard_shortcut', {
        key,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
        page: window.location.pathname,
      })
    }
  }, { passive: true })
}

// ── Download link tracking ──────────────────────────────────────────────
function installDownloadTracking(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest('a[download], a[href$=".pdf"], a[href$=".csv"], a[href$=".zip"], a[href$=".xlsx"], a[href$=".docx"]')
    if (!target) return
    const href = (target as HTMLAnchorElement).href ?? ''
    const ext = href.split('.').pop()?.split('?')[0] ?? ''
    track('$download', {
      url: href,
      ext,
      page: window.location.pathname,
    })
  }, { passive: true })
}

// ── File upload tracking ────────────────────────────────────────────────
function installUploadTracking(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('change', (event) => {
    const el = event.target as HTMLInputElement | null
    if (el?.type !== 'file' || !el.files) return
    const files = Array.from(el.files)
    track('$upload', {
      fileCount: files.length,
      totalBytes: files.reduce((sum, f) => sum + f.size, 0),
      types: [...new Set(files.map((f) => f.type || 'unknown'))],
      page: window.location.pathname,
      fieldName: el.name || el.id || null,
    })
  }, { passive: true })
}

// ── Hover tracking ──────────────────────────────────────────────────────
// Only tracks meaningful hover dwell (>= 1s on interactive/significant elements)
// to avoid flooding the event stream with every mouseover.
const HOVER_DWELL_MS = 1_000
function installHoverTracking(): void {
  if (typeof document === 'undefined') return
  let hoverTimer: ReturnType<typeof setTimeout> | null = null
  let lastTarget: Element | null = null

  document.addEventListener('mouseover', (event) => {
    const target = event.target as Element | null
    if (target === lastTarget) return
    lastTarget = target
    if (hoverTimer) clearTimeout(hoverTimer)
    if (!target || !isInteractiveElement(target)) return
    hoverTimer = setTimeout(() => {
      track('$hover', {
        targetSelector: cssPath(target),
        page: window.location.pathname,
        dwellMs: HOVER_DWELL_MS,
      })
    }, HOVER_DWELL_MS)
  }, { passive: true })

  document.addEventListener('mouseout', () => {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
    lastTarget = null
  }, { passive: true })
}

// ── Visual session replay (web) ─────────────────────────────────────────
// Real DOM-reconstruction recording via rrweb — structural events (DOM
// snapshots + mutations), not pixels/screenshots. maskAllInputs blocks the
// *value* of every input/textarea/select by default (renders as bullets on
// playback) so password/PII fields are never exposed without a developer
// having to do anything; block elements with class "paaq-block" to hide
// content entirely, or class "paaq-mask" to mask arbitrary text nodes.
const RECORDING_FLUSH_INTERVAL_MS = 8_000
const RECORDING_MAX_BUFFERED_EVENTS = 400
const POST_ERROR_CAPTURE_MS = 5_000

let _recordingBuffer: unknown[] = []
let _recordingSequence = 0
let _recordingFlushTimer: ReturnType<typeof setInterval> | null = null
let _recordingStop: (() => void) | null = null
let _postErrorFlushTimer: ReturnType<typeof setTimeout> | null = null

// Only flush on FullSnapshot (2), never on Meta (4) alone — Meta always
// precedes FullSnapshot in the same checkout; flushing early splits them
// across chunks and breaks reconstruction (visible glitches/skips).
const RRWEB_FULL_SNAPSHOT = 2

function installDomRecording(): void {
  if (typeof document === 'undefined') return
  teardownDomRecording()
  _recordingSequence = 0
  _recordingStop = record({
    emit(event) {
      _recordingBuffer.push(event)
      const e = event as { type?: number }
      if (e.type === RRWEB_FULL_SNAPSHOT) {
        void flushRecording({ keepalive: false })
      } else if (_recordingBuffer.length >= RECORDING_MAX_BUFFERED_EVENTS) {
        void flushRecording()
      }
    },
    maskAllInputs: true,
    blockClass: 'paaq-block',
    maskTextClass: 'paaq-mask',
    inlineStylesheet: true,
    collectFonts: true,
    recordCanvas: true,
    // Infrequent checkouts = smoother full-session playback; error clips still
    // work via periodic flushes + the immediate flush on each error.
    checkoutEveryNms: 3 * 60 * 1000,
    sampling: {
      mousemove: 16,
      scroll: 80,
      mouseInteraction: true,
      input: 'last',
    },
  }) ?? null

  if (_recordingFlushTimer) clearInterval(_recordingFlushTimer)
  _recordingFlushTimer = setInterval(() => void flushRecording(), RECORDING_FLUSH_INTERVAL_MS)
}

let _flushRecordingChain: Promise<void> = Promise.resolve()

async function flushRecording(opts: { keepalive?: boolean } = {}): Promise<void> {
  _flushRecordingChain = _flushRecordingChain.then(() => flushRecordingOnce(opts))
  return _flushRecordingChain
}

async function flushRecordingOnce(opts: { keepalive?: boolean } = {}): Promise<void> {
  if (_recordingBuffer.length === 0 || !isConfigured() || !_sessionId) return
  const batch = _recordingBuffer.splice(0)
  const sequence = _recordingSequence++
  const keepalive = opts.keepalive ?? true
  for (let attempt = 0; attempt < 2; attempt++) {
    const ok = await transport.uploadSessionRecording(_sessionId, batch, {
      sequence,
      capturedAt: new Date().toISOString(),
      keepalive,
    })
    if (ok) return
  }
  _recordingBuffer.unshift(...batch)
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

/** The label a person would read on the control they pressed — button copy,
 * aria-label, input value — not a CSS selector. Falls back to cssPath only
 * when the node has no readable name. */
function clickableLabel(el: Element | null): string {
  const interactive = el?.closest('a, button, input, select, textarea, label, [role="button"], summary') ?? el
  if (!interactive) return 'unknown'
  const aria = interactive.getAttribute('aria-label')?.trim()
  if (aria) return aria
  const title = interactive.getAttribute('title')?.trim()
  if (title) return title
  if (interactive instanceof HTMLInputElement || interactive instanceof HTMLButtonElement) {
    const value = interactive.value?.trim()
    if (value && (interactive instanceof HTMLButtonElement || /^(submit|button)$/i.test(interactive.type))) return value
    const name = interactive.getAttribute('name')?.trim()
    if (interactive instanceof HTMLInputElement && name) return name
  }
  const text = (interactive.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text && text.length <= 80) return text
  return cssPath(interactive)
}

function rememberClick(target: Element | null, x: number, y: number): LastClick {
  const click: LastClick = {
    targetLabel: clickableLabel(target),
    targetSelector: cssPath(target),
    x,
    y,
    at: new Date().toISOString(),
    page: window.location.pathname,
  }
  _lastClick = click
  return click
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

    // ── Plain click: every click, not just rage/dead-click patterns. This is
    // the actual "did the user interact with this page" signal — session_pages'
    // interaction_count only ever increments off of *some* tracked event
    // existing, and a normal single click on a button/link previously produced
    // nothing at all, so page-by-page "clicks" was always 0 for ordinary use.
    const click = rememberClick(target, x, y)
    track('$click', {
      targetSelector: click.targetSelector,
      targetLabel: click.targetLabel,
      x,
      y,
      page: click.page,
    })

    // ── Rage click: 3+ clicks in quick succession, close together ──
    _recentClicks = _recentClicks.filter((c) => now - c.time < RAGE_CLICK_WINDOW_MS)
    _recentClicks.push({ time: now, x, y, target })
    const cluster = _recentClicks.filter(
      (c) => Math.hypot(c.x - x, c.y - y) <= RAGE_CLICK_RADIUS_PX,
    )
    if (cluster.length >= RAGE_CLICK_MIN_COUNT && now > _rageCooldownUntil) {
      _rageCooldownUntil = now + RAGE_CLICK_WINDOW_MS
      _recentClicks = []
      track('$rage_click', { targetSelector: cssPath(target), targetLabel: clickableLabel(target), x, y, tapCount: cluster.length })
    }

    // ── Dead click: no other tracked signal followed within the delay ──
    if (!isInteractiveElement(target)) {
      const clickedAt = now
      const startUrl = window.location.href
      setTimeout(() => {
        if (_lastSignalAt >= clickedAt || window.location.href !== startUrl) return
        track('$dead_click', { targetSelector: cssPath(target), targetLabel: clickableLabel(target), x, y })
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
        track('$scroll_depth', { pct: milestone, page: window.location.pathname })
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

// Real, standard browser API — the same text the browser itself would show
// in its native validation bubble (e.g. "Please fill out this field."). Only
// meaningful once the field is actually invalid; empty string otherwise.
function fieldValidationMessage(el: Element): string | null {
  if ('validationMessage' in el) {
    const msg = (el as HTMLInputElement).validationMessage
    return msg ? msg : null
  }
  return null
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
      validationMessage: fieldValidationMessage(el),
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

// Real installed version, for host apps that want to report/verify which
// build is actually live (e.g. in a "sdk_connected" diagnostic event)
// instead of hand-copying a version string that immediately goes stale.
export const SDK_VERSION_STRING = SDK_VERSION

export const paaq = { init, track, identify, page, flush, trackError, endSession }
