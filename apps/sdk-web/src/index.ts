import { record } from 'rrweb'

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
  user_id?: string | null
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
let _currentUserId: string | null = null
// Set by identify() whenever it resolves a real user_id but no session
// exists yet to link it to (host app called identify() before init()
// resolved). NOT reset by init() — unlike _currentUserId, this survives
// across the reset so init() can finish the link once a session exists.
let _pendingIdentifyUserId: string | null = null
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
  options: { platform?: string; appVersion?: string } = {},
): Promise<InitResult> {
  _sdkToken = sdkToken
  _projectKey = projectKey
  _platform = options.platform ?? 'react'

  try {
    const res = await fetch(`${BASE_URL}/sdk-init`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        deviceId: getDeviceId(),
        appVersion: options.appVersion,
        deviceMetadata: collectDeviceMetadata(),
      }),
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
      installDoubleClickTracking()
      installCopyPasteTracking()
      installKeyboardTracking()
      installDownloadTracking()
      installUploadTracking()
      installHoverTracking()
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
  _queue.push({
    event_name: eventName,
    session_id: _sessionId,
    user_id: _currentUserId,
    properties,
    timestamp: new Date().toISOString(),
  })
  if (_queue.length >= _config.batchSize) void flush()
}

// Resolves/creates the user via the `/users` endpoint (keyed on the caller's
// own external_user_id) and links the resulting user_id onto the current
// session immediately — not just once the session closes — so Identity/
// Email/Type/Lifetime-sessions populate right away in the dashboard.
async function identify(userId: string, traits: Record<string, unknown> = {}): Promise<void> {
  track('$identify', { userId, ...traits })

  if (!_sdkToken) return
  try {
    const email = typeof traits.email === 'string' ? traits.email : undefined
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ external_user_id: userId, email }),
    })
    const data: { ok?: boolean; user_id?: string } = await res.json().catch(() => ({}))
    if (!data.ok || !data.user_id) return

    _currentUserId = data.user_id
    _pendingIdentifyUserId = data.user_id
    await linkSessionToUser()
  } catch {
    // fire-and-forget — a failed identify just leaves the session unlinked,
    // it never blocks tracking
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
    await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ action: 'identify', session_id: _sessionId, user_id: userId }),
    })
    _pendingIdentifyUserId = null
  } catch {
    // leave _pendingIdentifyUserId set — a later call (e.g. a subsequent
    // track()) doesn't retry this automatically, but the session isn't
    // permanently unlinkable either; a follow-up identify() call will retry it
  }
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
  _recordingStop?.()
  if (_recordingFlushTimer) clearInterval(_recordingFlushTimer)
  void flushRecording()
  void endSession(outcome)
}

async function endSession(outcome: string): Promise<void> {
  if (!_sessionId || !_sdkToken || _sessionEnded) return
  _sessionEnded = true
  const durationSeconds = _sessionStartedAt ? Math.round((Date.now() - _sessionStartedAt) / 1000) : undefined
  const payload = JSON.stringify({ action: 'end', session_id: _sessionId, duration: durationSeconds, outcome })
  // sendBeacon cannot send custom headers, so the sessions endpoint would reject
  // it with 401. fetch+keepalive is the spec-correct replacement: it sends all
  // headers and is guaranteed to complete even when the page is unloading.
  try {
    await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: payload,
      keepalive: true,
    })
  } catch {
    // fire-and-forget — session-sweep-cron closes stale sessions as a fallback
  }
}

// ── Double click tracking ───────────────────────────────────────────────
function installDoubleClickTracking(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('dblclick', (event) => {
    const target = event.target as Element | null
    track('$double_click', {
      targetSelector: cssPath(target),
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
const RECORDING_FLUSH_INTERVAL_MS = 10_000
const RECORDING_MAX_BUFFERED_EVENTS = 200

let _recordingBuffer: unknown[] = []
let _recordingSequence = 0
let _recordingFlushTimer: ReturnType<typeof setInterval> | null = null
let _recordingStop: (() => void) | null = null

// rrweb event types that carry a full DOM snapshot rather than an
// incremental delta — type 4 (Meta) always precedes type 2 (FullSnapshot)
// at recording start and at every checkoutEveryNms checkout. Without at
// least one of these actually reaching storage, the replay player has no
// base DOM to reconstruct onto and cannot render anything at all — losing
// one of these is far worse than losing an incremental-delta chunk.
const RECORDING_SNAPSHOT_EVENT_TYPES = new Set([2, 4])

function installDomRecording(): void {
  if (typeof document === 'undefined' || _recordingStop) return
  _recordingStop = record({
    emit(event) {
      _recordingBuffer.push(event)
      const e = event as { type?: number }
      if (e.type != null && RECORDING_SNAPSHOT_EVENT_TYPES.has(e.type)) {
        // Flush immediately, without keepalive: keepalive fetches are capped
        // at 64KB combined body size across all in-flight keepalive requests
        // (spec limit), and a full DOM snapshot routinely exceeds that on a
        // real page — a keepalive flush of this chunk fails outright, which
        // is exactly why every surviving chunk in production turned out to
        // be tiny mouse-move deltas and none carried a snapshot. A normal
        // (non-keepalive) fetch has no such size cap, at the cost of being
        // killable if the page unloads before it completes — an acceptable
        // trade since the alternative is a snapshot that's guaranteed to fail.
        void flushRecording({ keepalive: false })
      } else if (_recordingBuffer.length >= RECORDING_MAX_BUFFERED_EVENTS) {
        void flushRecording()
      }
    },
    maskAllInputs: true,
    blockClass: 'paaq-block',
    maskTextClass: 'paaq-mask',
    // Periodic full snapshot so the player can render mid-recording without
    // replaying every incremental mutation from session start — also the
    // real floor on how short a "watch this moment" clip can be, since the
    // dashboard clips playback to start at the latest snapshot before a
    // moment. 15s keeps clips consistently short at the cost of somewhat
    // more captured data per session than the previous 60s cadence.
    checkoutEveryNms: 15_000,
  }) ?? null

  if (_recordingFlushTimer) clearInterval(_recordingFlushTimer)
  _recordingFlushTimer = setInterval(() => void flushRecording(), RECORDING_FLUSH_INTERVAL_MS)
}

async function flushRecording(opts: { keepalive?: boolean } = {}): Promise<void> {
  if (_recordingBuffer.length === 0 || !_sdkToken || !_sessionId) return
  const batch = _recordingBuffer.splice(0)
  const sequence = _recordingSequence++
  const params = new URLSearchParams({
    session_id: _sessionId,
    kind: 'dom',
    sequence: String(sequence),
    captured_at: new Date().toISOString(),
  })
  const keepalive = opts.keepalive ?? true
  // One retry for a transient failure — a snapshot-bearing chunk in
  // particular is worth a second attempt rather than silently giving up,
  // since losing it breaks playback entirely rather than just leaving a gap.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/session-recording-upload?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${_sdkToken}`,
          'X-Project-ID': _projectKey,
        },
        body: JSON.stringify(batch),
        keepalive,
      })
      if (res.ok) return
    } catch {
      // fall through to retry
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

    // ── Plain click: every click, not just rage/dead-click patterns. This is
    // the actual "did the user interact with this page" signal — session_pages'
    // interaction_count only ever increments off of *some* tracked event
    // existing, and a normal single click on a button/link previously produced
    // nothing at all, so page-by-page "clicks" was always 0 for ordinary use.
    track('$click', { targetSelector: cssPath(target), x, y, page: window.location.pathname })

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

export const paaq = { init, track, identify, page, flush, trackError, endSession }
