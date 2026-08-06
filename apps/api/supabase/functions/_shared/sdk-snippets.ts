// Canonical SDK integration snippet templates — framework -> ready-to-write
// file content, credentials baked in. This is the source of truth; the MCP
// server (packages/mcp-server/index.js, a separate Node package with no
// import path into Deno edge functions) keeps a manually-synced copy of the
// same templates, the same way it already does for FRONTEND_PLATFORMS.
//
// Used by onboard-agent's generate_sdk_snippet tool and (indirectly, via the
// dashboard's Advanced/manual tab) apps/dashboard/app/connect/page.tsx.

export type Framework = 'nextjs' | 'react' | 'vue' | 'vanilla' | 'nodejs' | 'python'

const SDK_VERSION = '1.0.0'
const PAAQ_BASE = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  nextjs: 'Next.js',
  react: 'React',
  vue: 'Vue 3',
  vanilla: 'Vanilla JS / HTML',
  nodejs: 'Node.js',
  python: 'Python',
}

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
      console.log('[PAAQ] Connected', this.sessionId)
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
      console.log('[PAAQ] Connected', this.sessionId)
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
      console.log('[PAAQ] Connected', this.sessionId)
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
    if (data?.ok) { this.sessionId = data.sessionId; console.log('[PAAQ] Connected', this.sessionId) }
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

paaq.init().then(() => paaq.track('page_view', { title: document.title }))
</script>`
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
