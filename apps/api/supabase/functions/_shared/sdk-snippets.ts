// Canonical SDK integration snippet templates — framework -> ready-to-write
// file content, credentials baked in. This is the source of truth; the MCP
// server (packages/mcp-server/index.js, a separate Node package with no
// import path into Deno edge functions) keeps a manually-synced copy of the
// same templates, the same way it already does for FRONTEND_PLATFORMS.
//
// Used by onboard-agent's generate_sdk_snippet tool and (indirectly, via the
// dashboard's Advanced/manual tab) apps/dashboard/app/connect/page.tsx.

export type Framework = 'nextjs' | 'react' | 'vue' | 'vanilla' | 'nodejs' | 'python'

const SDK_VERSION = '1.3.0'
const PAAQ_BASE = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  nextjs: 'Next.js',
  react: 'React',
  vue: 'Vue 3',
  vanilla: 'Vanilla JS / HTML',
  nodejs: 'Node.js',
  python: 'Python',
}

// Self-contained, dependency-free slot-in so /connect (AI onboarding) web
// snippets deliver the same headline feature the packaged `@paaq/web-sdk`
// does out of the box: real DOM-reconstruction session replay. Lazily loads
// rrweb from the CDN so the snippet stays a single block dropped next to the
// paaq shim. Mirrors the official SDK contract — JSON posted to the
// session-recording-upload edge, gzip not required (small batches). Privacy
// defaults match the SDK: maskAllInputs + paaq-block/paaq-mask. Disable by
// setting window.__PAAQ_RECORDING_ENABLED = false before init().
const RECORDING_IMPL = `
function __paqRcStart(pa) {
  if (typeof document === 'undefined') return
  if (pa.__rc) { try { pa.__rc() } catch(e) {} pa.__rc = null }
  if (pa.__tl) { clearInterval(pa.__tl); pa.__tl = null }
  pa.__seq = 0
  pa.__buf = []
  if (!window.__paqRcRrweb) {
    var s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/rrweb@2/dist/rrweb-all.min.js'
    s.onload = function () { __paqRcStart(pa) }
    s.onerror = function () { console.warn('[PAAQ] rrweb failed to load; recording disabled') }
    document.head.appendChild(s)
    return
  }
  var R = window.__paqRcRrweb
  pa.__rc = R.record({
    emit: function (ev) {
      pa.__buf = pa.__buf || [] ; pa.__buf.push(ev)
      if (ev.type === 2) __paqRcFlush(pa, false)
      else if (pa.__buf.length >= 400) __paqRcFlush(pa, true)
    },
    maskAllInputs: true,
    blockClass: 'paaq-block',
    maskTextClass: 'paaq-mask',
    inlineStylesheet: true,
    collectFonts: true,
    recordCanvas: true,
    checkoutEveryNms: 180000,
    sampling: { mousemove: 16, scroll: 80, mouseInteraction: true, input: 'last' },
  })
  pa.__tl = setInterval(function(){ __paqRcFlush(pa, true) }, 8000)
}
function __paqRcOnError(pa) {
  __paqRcFlush(pa, false)
  if (pa.__errT) clearTimeout(pa.__errT)
  pa.__errT = setTimeout(function(){ __paqRcFlush(pa, false) }, 5000)
}
function __paqRcFlush(pa, keepalive) {
  if (!pa.sessionId || !(pa.__buf||[]).length) return
  var b = pa.__buf.splice(0)
  var qs = new URLSearchParams({session_id:pa.sessionId,kind:'dom',sequence:String(pa.__seq||0),captured_at:new Date().toISOString()})
  pa.__seq = (pa.__seq||0)+1
  var h
  try { h = (pa._headers || pa._h)() } catch(e) { return }
  fetch(pa.base + ('/session-recording-upload?' + qs.toString()), { method:'POST', headers:h, body:JSON.stringify(b), keepalive:(keepalive ?? true) })
    .then(function(r){ if (!r.ok) pa.__buf = b.concat(pa.__buf||[]) })
    .catch(function(){ pa.__buf = b.concat(pa.__buf||[]) })
}
`
// One line to slot into each web template's init() after sessionId is set.
// Gated on (default-on), matching the packaged SDK's always-on replay.
const __WIRE_RECORDING_INTO_INIT = '    if (window.__PAAQ_RECORDING_ENABLED !== false) __paqRcStart(this)\n'

function snippetNextjs(sdkToken: string, projectKey: string): string {
  return `// lib/paaq.ts — create this file in your Next.js project
function getDeviceMeta() {
  if (typeof window === 'undefined') return {}
  const nav = navigator as any
  return {
    userAgent:      navigator.userAgent,
    screenWidth:    screen.width,         screenHeight:   screen.height,
    viewportWidth:  window.innerWidth,    viewportHeight: window.innerHeight,
    timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale:         navigator.language,
    connectionType: nav?.connection?.effectiveType ?? null,
    referrer:       document.referrer || null,
    entryUrl:       window.location.href,
    pixelRatio:     window.devicePixelRatio,
    orientation:    window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
    touchSupport:   'ontouchstart' in window,
    cpuCores:       navigator.hardwareConcurrency ?? null,
    memoryGb:       nav?.deviceMemory ?? null,
  }
}

export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  null as string | null,
  appVersion: null as string | null, // optional: set to your app's version string

  _headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${this.sdkToken}\`, 'X-Project-ID': this.projectKey }
  },

  async init() {
    if (typeof window === 'undefined') return
    const res = await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: { ...this._headers(), 'X-SDK-Version': '${SDK_VERSION}', 'X-Platform': 'nextjs', 'X-Environment': process.env.NODE_ENV ?? 'production' },
      body: JSON.stringify({ appVersion: this.appVersion || undefined, deviceMetadata: getDeviceMeta() }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (data?.ok) {
      this.sessionId = data.sessionId
${__WIRE_RECORDING_INTO_INIT}      console.log('[PAAQ] Connected', this.sessionId)
    }
  },

  async track(event: string, props: Record<string, unknown> = {}) {
    if (!this.sessionId || typeof window === 'undefined') return
    await fetch(\`\${this.base}/events\`, {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify([{ event_name: event, session_id: this.sessionId,
        screen_name: window.location.pathname, properties: props, timestamp: new Date().toISOString() }]),
    }).catch(() => null)
  },
}

${RECORDING_IMPL}
// src/main.ts: import { paaq } from './paaq'; paaq.init()`
}

function snippetReact(sdkToken: string, projectKey: string): string {
  return `// src/paaq.js — create this file in your React project
function getDeviceMeta() {
  return {
    userAgent:      navigator.userAgent,
    screenWidth:    screen.width,         screenHeight:   screen.height,
    viewportWidth:  window.innerWidth,    viewportHeight: window.innerHeight,
    timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale:         navigator.language,
    connectionType: navigator.connection?.effectiveType ?? null,
    referrer:       document.referrer || null,
    entryUrl:       window.location.href,
    pixelRatio:     window.devicePixelRatio,
    orientation:    window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
    touchSupport:   'ontouchstart' in window,
    cpuCores:       navigator.hardwareConcurrency ?? null,
    memoryGb:       navigator.deviceMemory ?? null,
  }
}

export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  null,
  appVersion: null, // optional: set to your app's version string

  _headers() {
    return { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${this.sdkToken}\`, 'X-Project-ID': this.projectKey }
  },

  async init() {
    const res = await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: { ...this._headers(), 'X-SDK-Version': '${SDK_VERSION}', 'X-Platform': 'react', 'X-Environment': import.meta.env?.MODE ?? 'production' },
      body: JSON.stringify({ appVersion: this.appVersion || undefined, deviceMetadata: getDeviceMeta() }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (data?.ok) {
      this.sessionId = data.sessionId  // always use the server-assigned ID
${__WIRE_RECORDING_INTO_INIT}      console.log('[PAAQ] Connected', this.sessionId)
    }
  },

  async track(event, props = {}) {
    if (!this.sessionId) return
    await fetch(\`\${this.base}/events\`, {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify([{ event_name: event, session_id: this.sessionId,
        screen_name: window.location.pathname, properties: props, timestamp: new Date().toISOString() }]),
    }).catch(() => null)
  },
}

${RECORDING_IMPL}
// src/main.jsx: import { paaq } from './paaq'; paaq.init()`
}

function snippetVue(sdkToken: string, projectKey: string): string {
  return `// src/paaq.js — create this file in your Vue project
function getDeviceMeta() {
  return {
    userAgent:      navigator.userAgent,
    screenWidth:    screen.width,         screenHeight:   screen.height,
    viewportWidth:  window.innerWidth,    viewportHeight: window.innerHeight,
    timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale:         navigator.language,
    connectionType: navigator.connection?.effectiveType ?? null,
    referrer:       document.referrer || null,
    entryUrl:       window.location.href,
    pixelRatio:     window.devicePixelRatio,
    orientation:    window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
    touchSupport:   'ontouchstart' in window,
    cpuCores:       navigator.hardwareConcurrency ?? null,
    memoryGb:       navigator.deviceMemory ?? null,
  }
}

export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  null,
  appVersion: null, // optional: set to your app's version string

  _headers() {
    return { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${this.sdkToken}\`, 'X-Project-ID': this.projectKey }
  },

  async init() {
    const res = await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: { ...this._headers(), 'X-SDK-Version': '${SDK_VERSION}', 'X-Platform': 'vue', 'X-Environment': import.meta.env?.MODE ?? 'production' },
      body: JSON.stringify({ appVersion: this.appVersion || undefined, deviceMetadata: getDeviceMeta() }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (data?.ok) {
      this.sessionId = data.sessionId
${__WIRE_RECORDING_INTO_INIT}      console.log('[PAAQ] Connected', this.sessionId)
    }
  },

  async track(event, props = {}) {
    if (!this.sessionId) return
    await fetch(\`\${this.base}/events\`, {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify([{ event_name: event, session_id: this.sessionId,
        screen_name: window.location.pathname, properties: props, timestamp: new Date().toISOString() }]),
    }).catch(() => null)
  },
}

${RECORDING_IMPL}
// src/main.js: import { paaq } from './paaq'; paaq.init()`
}

function snippetVanilla(sdkToken: string, projectKey: string): string {
  return `<!-- Add before </body> in your HTML page -->
<script>
function getDeviceMeta() {
  return {
    userAgent:      navigator.userAgent,
    screenWidth:    screen.width,         screenHeight:   screen.height,
    viewportWidth:  window.innerWidth,    viewportHeight: window.innerHeight,
    timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale:         navigator.language,
    connectionType: navigator.connection?.effectiveType ?? null,
    referrer:       document.referrer || null,
    entryUrl:       window.location.href,
    pixelRatio:     window.devicePixelRatio,
    orientation:    window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
    touchSupport:   'ontouchstart' in window,
    cpuCores:       navigator.hardwareConcurrency ?? null,
    memoryGb:       navigator.deviceMemory ?? null,
  }
}

const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  null,
  appVersion: null, // optional: set to your app's version string

  _h() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.sdkToken, 'X-Project-ID': this.projectKey }
  },

  async init() {
    const res = await fetch(this.base + '/sdk-init', {
      method: 'POST',
      headers: Object.assign(this._h(), { 'X-SDK-Version': '${SDK_VERSION}', 'X-Platform': 'vanilla', 'X-Environment': 'production' }),
      body: JSON.stringify({ appVersion: this.appVersion || undefined, deviceMetadata: getDeviceMeta() }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (data?.ok) {
      this.sessionId = data.sessionId
${__WIRE_RECORDING_INTO_INIT}      console.log('[PAAQ] Connected', this.sessionId)
    }
  },

  async track(event, props) {
    if (!this.sessionId) return
    fetch(this.base + '/events', {
      method: 'POST', headers: this._h(),
      body: JSON.stringify([{ event_name: event, session_id: this.sessionId,
        screen_name: location.pathname, properties: props || {}, timestamp: new Date().toISOString() }]),
    }).catch(() => null)
  },
}

paaq.init().then(() => paaq.track('page_view', { title: document.title }))${RECORDING_IMPL}</script>`
}

function snippetNodejs(sdkToken: string, projectKey: string): string {
  return `// paaq.js — create this file and add it to your Node.js server
export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',

  async init(platform = 'nodejs') {
    const res = await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
        'X-SDK-Version': '${SDK_VERSION}',
        'X-Platform':    platform,
        'X-Environment': process.env.NODE_ENV ?? 'production',
      },
      body: JSON.stringify({}),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (data?.ok) console.log('[PAAQ] Connected —', data.meta?.projectName)
    return data
  },

  middleware() {
    return (req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        fetch(\`\${this.base}/events\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${this.sdkToken}\`, 'X-Project-ID': this.projectKey },
          body: JSON.stringify([{
            event_name: 'api_request',
            session_id: null,
            properties: { method: req.method, path: req.path, status: res.statusCode, duration_ms: Date.now() - start },
            timestamp: new Date().toISOString(),
          }]),
        }).catch(() => null)
      })
      next()
    }
  },
}

// server.js: import { paaq } from './paaq'; await paaq.init(); app.use(paaq.middleware())`
}

function snippetPython(sdkToken: string, projectKey: string): string {
  return `# paaq.py — create this file in your Python project
import httpx
import uuid

class PAAQ:
    SDK_TOKEN   = '${sdkToken}'
    PROJECT_KEY = '${projectKey}'
    BASE        = '${PAAQ_BASE}'
    session_id  = str(uuid.uuid4())

    @classmethod
    def _headers(cls, platform='python'):
        return {
            'Content-Type':  'application/json',
            'Authorization': f'Bearer {cls.SDK_TOKEN}',
            'X-Project-ID':  cls.PROJECT_KEY,
            'X-SDK-Version': '${SDK_VERSION}',
            'X-Platform':    platform,
            'X-Environment': 'production',
        }

    @classmethod
    def init(cls, platform='python'):
        try:
            r = httpx.post(
                f'{cls.BASE}/sdk-init',
                headers=cls._headers(platform),
                json={'sessionId': cls.session_id},
                timeout=5,
            )
            data = r.json()
            if data.get('ok'):
                print(f"[PAAQ] Connected — {data.get('meta', {}).get('projectName')}")
        except Exception as e:
            print(f'[PAAQ] Connection failed: {e}')

    @classmethod
    def track(cls, event_name: str, properties: dict = {}):
        try:
            httpx.post(
                f'{cls.BASE}/events',
                headers=cls._headers(),
                json=[{
                    'event_name': event_name,
                    'session_id': cls.session_id,
                    'properties': properties,
                    'timestamp':  __import__('datetime').datetime.utcnow().isoformat() + 'Z',
                }],
                timeout=5,
            )
        except Exception:
            pass

    @classmethod
    def fastapi_middleware(cls):
        from starlette.middleware.base import BaseHTTPMiddleware
        import time
        class _Middleware(BaseHTTPMiddleware):
            async def dispatch(inner_self, request, call_next):
                start = time.time()
                response = await call_next(request)
                cls.track('api_request', {
                    'method':      request.method,
                    'path':        request.url.path,
                    'status':      response.status_code,
                    'duration_ms': round((time.time() - start) * 1000),
                })
                return response
        return _Middleware

# Add to your main.py / app.py:
# from paaq import PAAQ
# PAAQ.init()
# app.add_middleware(PAAQ.fastapi_middleware())  # FastAPI / Starlette
`
}

export const SNIPPET_GENERATORS: Record<Framework, (sdkToken: string, projectKey: string) => string> = {
  nextjs: snippetNextjs,
  react: snippetReact,
  vue: snippetVue,
  vanilla: snippetVanilla,
  nodejs: snippetNodejs,
  python: snippetPython,
}

export function generateSdkSnippet(framework: Framework, sdkToken: string, projectKey: string): string {
  const gen = SNIPPET_GENERATORS[framework]
  if (!gen) throw new Error(`Unknown framework: ${framework}`)
  return gen(sdkToken, projectKey)
}
