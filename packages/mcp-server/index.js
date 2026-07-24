#!/usr/bin/env node
/**
 * PAAQ Intelligence MCP Server
 *
 * Lets any AI agent (Claude Code, Cursor, Windsurf) connect a website or app
 * to PAAQ Intelligence automatically.
 *
 * Setup — add to .mcp.json at the root of the CLIENT's project:
 * {
 *   "mcpServers": {
 *     "paaq": {
 *       "type": "stdio",
 *       "command": "npx",
 *       "args": ["-y", "@paaq/mcp-server"]
 *     }
 *   }
 * }
 *
 * Or if running from the PAAQ repo directly:
 * {
 *   "mcpServers": {
 *     "paaq": {
 *       "type": "stdio",
 *       "command": "node",
 *       "args": ["/absolute/path/to/paaq-listening-platform/packages/mcp-server/index.js"]
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const PAAQ_BASE = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'
const SDK_VERSION = '1.0.0'

// ── Auth headers (new multi-tenant scheme) ──────────────────────────────────

function sdkHeaders(sdkToken, projectKey, platform = 'mcp') {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${sdkToken}`,
    'X-Project-ID':  projectKey,
    'X-SDK-Version': SDK_VERSION,
    'X-Platform':    platform,
    'X-Environment': 'production',
  }
}

// ── Framework detection ─────────────────────────────────────────────────────

function detectFramework(packageJsonContent, requirementsTxtContent) {
  if (requirementsTxtContent || (!packageJsonContent && requirementsTxtContent !== undefined)) {
    return { framework: 'python', label: 'Python', confidence: 'high' }
  }

  if (!packageJsonContent) return null

  let pkg
  try { pkg = JSON.parse(packageJsonContent) } catch { return null }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  if (deps['next'])              return { framework: 'nextjs',  label: 'Next.js',        confidence: 'high' }
  if (deps['nuxt'])              return { framework: 'vue',     label: 'Vue 3 (Nuxt)',   confidence: 'high' }
  if (deps['@angular/core'])     return { framework: 'vanilla', label: 'Angular',        confidence: 'medium' }
  if (deps['svelte'])            return { framework: 'vanilla', label: 'Svelte',         confidence: 'medium' }
  if (deps['solid-js'])          return { framework: 'vanilla', label: 'SolidJS',        confidence: 'medium' }
  if (deps['react'])             return { framework: 'react',   label: 'React',          confidence: 'high' }
  if (deps['vue'])               return { framework: 'vue',     label: 'Vue 3',          confidence: 'high' }
  if (deps['express'] || deps['fastify'] || deps['hono'] || deps['koa']) {
    return { framework: 'nodejs', label: 'Node.js', confidence: 'high' }
  }
  if (deps['electron'])          return { framework: 'vanilla', label: 'Electron',       confidence: 'medium' }

  // Check if it has any web-like deps
  if (Object.keys(deps).length > 0) {
    return { framework: 'vanilla', label: 'JavaScript', confidence: 'low' }
  }
  return null
}

// ── Snippet generators — all use new multi-tenant auth ──────────────────────

function snippet_nextjs(sdkToken, projectKey) {
  return `// lib/paaq.ts — create this file in your Next.js project
export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  typeof crypto !== 'undefined' ? crypto.randomUUID() : '',

  async init() {
    const res = await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
        'X-SDK-Version': '${SDK_VERSION}',
        'X-Platform':    'nextjs',
        'X-Environment': process.env.NODE_ENV ?? 'production',
      },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
    if (res?.ok) {
      const data = await res.json().catch(() => null)
      if (data?.ok) {
        this.sessionId = data.sessionId
        console.log('[PAAQ] Connected —', data.meta?.projectName)
      }
    }
  },

  async track(eventName, properties = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
      },
      body: JSON.stringify([{
        event_name:  eventName,
        session_id:  this.sessionId,
        screen_name: typeof window !== 'undefined' ? window.location.pathname : '/',
        properties,
        timestamp:   new Date().toISOString(),
      }]),
    }).catch(() => null)
  },

  async identify(userId, traits = {}) {
    return this.track('$identify', { userId, ...traits })
  },
}

// app/providers.tsx — wrap your layout with this
// ─────────────────────────────────────────
// 'use client'
// import { useEffect } from 'react'
// import { paaq } from '@/lib/paaq'
//
// export function PaaqProvider({ children }: { children: React.ReactNode }) {
//   useEffect(() => { paaq.init() }, [])
//   return <>{children}</>
// }
//
// Then in app/layout.tsx:
// import { PaaqProvider } from './providers'
// <PaaqProvider>{children}</PaaqProvider>`
}

function snippet_react(sdkToken, projectKey) {
  return `// src/paaq.js — create this file in your React project
export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  crypto.randomUUID(),

  async init() {
    const res = await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
        'X-SDK-Version': '${SDK_VERSION}',
        'X-Platform':    'react',
        'X-Environment': import.meta.env?.MODE ?? 'production',
      },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
    if (res?.ok) {
      const data = await res.json().catch(() => null)
      if (data?.ok) console.log('[PAAQ] Connected —', data.meta?.projectName)
    }
  },

  async track(eventName, properties = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
      },
      body: JSON.stringify([{
        event_name:  eventName,
        session_id:  this.sessionId,
        screen_name: window.location.pathname,
        properties,
        timestamp:   new Date().toISOString(),
      }]),
    }).catch(() => null)
  },

  async identify(userId, traits = {}) {
    return this.track('$identify', { userId, ...traits })
  },
}

// src/main.jsx — add these two lines at the top of your entry file
// ─────────────────────────────────────────
// import { paaq } from './paaq'
// paaq.init()
`
}

function snippet_vue(sdkToken, projectKey) {
  return `// src/paaq.js — create this file in your Vue 3 project
export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  crypto.randomUUID(),

  async init() {
    const res = await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
        'X-SDK-Version': '${SDK_VERSION}',
        'X-Platform':    'vue',
        'X-Environment': import.meta.env?.MODE ?? 'production',
      },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
    if (res?.ok) {
      const data = await res.json().catch(() => null)
      if (data?.ok) console.log('[PAAQ] Connected —', data.meta?.projectName)
    }
  },

  async track(eventName, properties = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
      },
      body: JSON.stringify([{
        event_name:  eventName,
        session_id:  this.sessionId,
        screen_name: window.location.pathname,
        properties,
        timestamp:   new Date().toISOString(),
      }]),
    }).catch(() => null)
  },
}

// src/main.ts — add these two lines
// ─────────────────────────────────────────
// import { paaq } from './paaq'
// paaq.init()
`
}

function snippet_vanilla(sdkToken, projectKey) {
  return `<!-- Add this before </body> in your HTML page -->
<script>
  const paaq = {
    sdkToken:   '${sdkToken}',
    projectKey: '${projectKey}',
    base:       '${PAAQ_BASE}',
    sessionId:  crypto.randomUUID(),

    async init() {
      const res = await fetch(this.base + '/sdk-init', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + this.sdkToken,
          'X-Project-ID':  this.projectKey,
          'X-SDK-Version': '${SDK_VERSION}',
          'X-Platform':    'vanilla',
          'X-Environment': 'production',
        },
        body: JSON.stringify({ sessionId: this.sessionId }),
      }).catch(() => null)
      if (res?.ok) {
        const data = await res.json().catch(() => null)
        if (data?.ok) console.log('[PAAQ] Connected —', data.meta?.projectName)
      }
    },

    async track(eventName, properties) {
      await fetch(this.base + '/events', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + this.sdkToken,
          'X-Project-ID':  this.projectKey,
        },
        body: JSON.stringify([{
          event_name:  eventName,
          session_id:  this.sessionId,
          screen_name: location.pathname,
          properties:  properties ?? {},
          timestamp:   new Date().toISOString(),
        }]),
      }).catch(() => null)
    },
  }

  paaq.init().then(() => {
    paaq.track('page_view', { title: document.title, referrer: document.referrer })
  })
</script>`
}

function snippet_nodejs(sdkToken, projectKey) {
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

  async track(eventName, properties = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
      },
      body: JSON.stringify([{ event_name: eventName, properties, timestamp: new Date().toISOString() }]),
    }).catch(() => null)
  },

  // Express / Fastify / Hono middleware
  middleware() {
    return (req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        fetch(\`\${this.base}/events\`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': \`Bearer \${this.sdkToken}\`,
            'X-Project-ID':  this.projectKey,
          },
          body: JSON.stringify([{
            event_name: 'api_request',
            properties: {
              method:      req.method,
              path:        req.path ?? req.url,
              status:      res.statusCode,
              duration_ms: Date.now() - start,
            },
            timestamp: new Date().toISOString(),
          }]),
        }).catch(() => null)
      })
      if (next) next()
    }
  },
}

// Add to your server entry point (index.js / server.js):
// import { paaq } from './paaq.js'
// await paaq.init()
// app.use(paaq.middleware())   // Express / Fastify / Hono
`
}

function snippet_python(sdkToken, projectKey) {
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

const SNIPPETS = {
  nextjs:  snippet_nextjs,
  react:   snippet_react,
  vue:     snippet_vue,
  vanilla: snippet_vanilla,
  nodejs:  snippet_nodejs,
  python:  snippet_python,
}

const FRAMEWORK_LABELS = {
  nextjs:  'Next.js',
  react:   'React',
  vue:     'Vue 3',
  vanilla: 'Vanilla JS / HTML',
  nodejs:  'Node.js',
  python:  'Python',
}

// ── MCP server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'paaq-intelligence', version: '0.2.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'paaq_detect_framework',
      description:
        'Detect the framework of the project being connected by reading its package.json or requirements.txt. ' +
        'Call this first — before generating any snippet — so you pick the right integration template. ' +
        'Read the file contents yourself and pass them as strings to this tool.',
      inputSchema: {
        type: 'object',
        properties: {
          packageJsonContent: {
            type: 'string',
            description: 'Contents of package.json if it exists in the project root',
          },
          requirementsTxtContent: {
            type: 'string',
            description: 'Contents of requirements.txt if it exists (Python projects)',
          },
        },
      },
    },
    {
      name: 'paaq_verify_credentials',
      description:
        'Verify that a PAAQ SDK token and project key are valid by calling the live API. ' +
        'Always call this before generating or writing any integration code. ' +
        'Get the credentials from the user — they can copy them from https://paaq-listening-tool.vercel.app/connect',
      inputSchema: {
        type: 'object',
        properties: {
          sdkToken:   { type: 'string', description: 'SDK token — starts with sdk_live_ or sdk_test_' },
          projectKey: { type: 'string', description: 'Project key — starts with proj_' },
        },
        required: ['sdkToken', 'projectKey'],
      },
    },
    {
      name: 'paaq_generate_snippet',
      description:
        'Generate ready-to-paste integration code for a specific framework. ' +
        'Returns the exact file contents to write. Use paaq_detect_framework first to determine the framework. ' +
        'After generating the snippet, write the file to the project and then call paaq_send_test_event.',
      inputSchema: {
        type: 'object',
        properties: {
          sdkToken:   { type: 'string', description: 'SDK token (sdk_live_xxx)' },
          projectKey: { type: 'string', description: 'Project key (proj_xxx)' },
          framework: {
            type: 'string',
            enum: ['nextjs', 'react', 'vue', 'vanilla', 'nodejs', 'python'],
            description: 'Framework detected by paaq_detect_framework or confirmed by the user',
          },
        },
        required: ['sdkToken', 'projectKey', 'framework'],
      },
    },
    {
      name: 'paaq_send_test_event',
      description:
        'Send a test event to verify the connection works end-to-end. ' +
        'Call this after writing the integration file. Returns success or failure with the error reason.',
      inputSchema: {
        type: 'object',
        properties: {
          sdkToken:   { type: 'string', description: 'SDK token (sdk_live_xxx)' },
          projectKey: { type: 'string', description: 'Project key (proj_xxx)' },
          eventName:  { type: 'string', description: 'Test event name (default: paaq_connected)', default: 'paaq_connected' },
        },
        required: ['sdkToken', 'projectKey'],
      },
    },
    {
      name: 'paaq_list_frameworks',
      description: 'List all frameworks that PAAQ Intelligence supports.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'paaq_get_connection_url',
      description:
        'Get the URL where the user can find their SDK token and project key. ' +
        'Use this when the user does not know where to find their credentials.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  // ── paaq_detect_framework ───────────────────────────────────────────────
  if (name === 'paaq_detect_framework') {
    const result = detectFramework(args.packageJsonContent, args.requirementsTxtContent)

    if (!result) {
      return {
        content: [{
          type: 'text',
          text: [
            '⚠ Could not detect framework automatically.',
            '',
            'Please pass the contents of package.json (for JS/TS projects) or',
            'requirements.txt (for Python projects) to this tool.',
            '',
            'If you do not have either file, ask the user which framework they are using.',
            'Supported frameworks: nextjs, react, vue, vanilla, nodejs, python',
          ].join('\n'),
        }],
        isError: true,
      }
    }

    const confidenceNote = result.confidence === 'low'
      ? '\n\n⚠ Low confidence — ask the user to confirm this is correct before proceeding.'
      : result.confidence === 'medium'
      ? '\n\nNote: Auto-mapped to the closest supported integration. Ask the user to confirm.'
      : ''

    return {
      content: [{
        type: 'text',
        text: [
          `✓ Framework detected: **${result.label}**`,
          `MCP framework ID: \`${result.framework}\``,
          `Confidence: ${result.confidence}`,
          '',
          `Use \`${result.framework}\` as the framework parameter in paaq_generate_snippet.${confidenceNote}`,
        ].join('\n'),
      }],
    }
  }

  // ── paaq_verify_credentials ─────────────────────────────────────────────
  if (name === 'paaq_verify_credentials') {
    const { sdkToken, projectKey } = args

    if (!sdkToken?.startsWith('sdk_live_') && !sdkToken?.startsWith('sdk_test_')) {
      return {
        content: [{
          type: 'text',
          text: [
            '✗ Invalid SDK token format.',
            '',
            'The SDK token must start with sdk_live_ or sdk_test_.',
            'Get it from: https://paaq-listening-tool.vercel.app/connect',
          ].join('\n'),
        }],
        isError: true,
      }
    }

    if (!projectKey?.startsWith('proj_')) {
      return {
        content: [{
          type: 'text',
          text: [
            '✗ Invalid project key format.',
            '',
            'The project key must start with proj_.',
            'Get it from: https://paaq-listening-tool.vercel.app/connect',
          ].join('\n'),
        }],
        isError: true,
      }
    }

    try {
      const res = await fetch(`${PAAQ_BASE}/sdk-init`, {
        method: 'POST',
        headers: sdkHeaders(sdkToken, projectKey, 'mcp-verify'),
        body: JSON.stringify({ sessionId: crypto.randomUUID() }),
      })
      const data = await res.json()

      if (data.ok) {
        return {
          content: [{
            type: 'text',
            text: [
              '✓ Credentials verified successfully.',
              '',
              `Project: ${data.meta?.projectName}`,
              `Plan:    ${data.meta?.plan}`,
              `Session: ${data.sessionId}`,
              '',
              'Next step: call paaq_generate_snippet with the detected framework.',
            ].join('\n'),
          }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: [
            `✗ Credential check failed: ${data.error}`,
            '',
            'Make sure you are using the correct SDK Token (starts with sdk_live_) and',
            'Project Key (starts with proj_) from the same project.',
            'Both are visible at: https://paaq-listening-tool.vercel.app/connect',
          ].join('\n'),
        }],
        isError: true,
      }
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: `✗ Network error reaching PAAQ Intelligence API: ${err.message}`,
        }],
        isError: true,
      }
    }
  }

  // ── paaq_generate_snippet ───────────────────────────────────────────────
  if (name === 'paaq_generate_snippet') {
    const { sdkToken, projectKey, framework } = args
    const gen = SNIPPETS[framework]

    if (!gen) {
      return {
        content: [{
          type: 'text',
          text: `✗ Unknown framework: "${framework}". Supported: ${Object.keys(SNIPPETS).join(', ')}`,
        }],
        isError: true,
      }
    }

    const code = gen(sdkToken, projectKey)
    const label = FRAMEWORK_LABELS[framework] ?? framework
    const lang  = framework === 'python' ? 'python' : framework === 'vanilla' ? 'html' : 'javascript'

    const fileHint = {
      nextjs:  'Write this to **lib/paaq.ts** in the project root.',
      react:   'Write this to **src/paaq.js** in the project root.',
      vue:     'Write this to **src/paaq.js** in the project root.',
      vanilla: 'Add the <script> block to your main HTML file before </body>.',
      nodejs:  'Write this to **paaq.js** in the project root.',
      python:  'Write this to **paaq.py** in the project root.',
    }[framework] ?? 'Write this to a new file in the project root.'

    return {
      content: [{
        type: 'text',
        text: [
          `## PAAQ Intelligence — ${label} Integration`,
          '',
          fileHint,
          '',
          '```' + lang,
          code,
          '```',
          '',
          '**After writing the file:**',
          '1. Import and call `paaq.init()` from your app entry point (see comments in the snippet)',
          '2. Call `paaq_send_test_event` to confirm the connection is working',
        ].join('\n'),
      }],
    }
  }

  // ── paaq_send_test_event ────────────────────────────────────────────────
  if (name === 'paaq_send_test_event') {
    const { sdkToken, projectKey } = args
    const eventName = args.eventName ?? 'paaq_connected'

    // First do a quick credentials check
    try {
      const initRes = await fetch(`${PAAQ_BASE}/sdk-init`, {
        method: 'POST',
        headers: sdkHeaders(sdkToken, projectKey, 'mcp-test'),
        body: JSON.stringify({ sessionId: crypto.randomUUID() }),
      })
      const initData = await initRes.json()
      if (!initData.ok) {
        return {
          content: [{
            type: 'text',
            text: [
              `✗ Auth failed before sending test event: ${initData.error}`,
              '',
              'Check your SDK token and project key.',
            ].join('\n'),
          }],
          isError: true,
        }
      }

      // Now send the test event using the new auth scheme
      const evRes = await fetch(`${PAAQ_BASE}/events`, {
        method: 'POST',
        headers: sdkHeaders(sdkToken, projectKey, 'mcp-test'),
        body: JSON.stringify([{
          event_name:  eventName,
          session_id:  initData.sessionId,
          screen_name: '/mcp-test',
          properties:  {
            source:    'paaq-mcp-server',
            version:   '0.2.0',
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        }]),
      })
      const evData = await evRes.json()

      if (evData.ok) {
        return {
          content: [{
            type: 'text',
            text: [
              `✓ Test event "${eventName}" sent successfully.`,
              '',
              `Events inserted: ${evData.inserted}`,
              `Project: ${initData.meta?.projectName}`,
              '',
              'The PAAQ Intelligence dashboard will now show this project as connected.',
              'Open https://paaq-listening-tool.vercel.app/dashboard to see it.',
              '',
              '✓ Integration complete.',
            ].join('\n'),
          }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: [
            `✗ Event send failed: ${evData.error}`,
            '',
            'Auth passed but event ingestion failed. This is unexpected — please check the PAAQ status page.',
          ].join('\n'),
        }],
        isError: true,
      }
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: `✗ Network error: ${err.message}`,
        }],
        isError: true,
      }
    }
  }

  // ── paaq_list_frameworks ────────────────────────────────────────────────
  if (name === 'paaq_list_frameworks') {
    return {
      content: [{
        type: 'text',
        text: [
          '## Supported Frameworks',
          '',
          '| Framework | ID | Notes |',
          '|---|---|---|',
          '| Next.js | `nextjs` | App Router or Pages Router |',
          '| React | `react` | Vite, CRA, or any React setup |',
          '| Vue 3 | `vue` | Vite, Nuxt, or Vue CLI |',
          '| Vanilla JS / HTML | `vanilla` | No framework, plain HTML + JS |',
          '| Node.js | `nodejs` | Express, Fastify, Hono, Koa |',
          '| Python | `python` | FastAPI, Flask, Django, Starlette |',
          '',
          'Pass the ID value to `framework` in paaq_generate_snippet.',
        ].join('\n'),
      }],
    }
  }

  // ── paaq_get_connection_url ─────────────────────────────────────────────
  if (name === 'paaq_get_connection_url') {
    return {
      content: [{
        type: 'text',
        text: [
          '## Where to find your PAAQ Intelligence credentials',
          '',
          'Open this page and copy the SDK Token and Project Key:',
          'https://paaq-listening-tool.vercel.app/connect',
          '',
          '- **SDK Token** — starts with `sdk_live_...` — shown in the "Your credentials" section',
          '- **Project Key** — starts with `proj_...` — shown below the SDK Token',
          '',
          'Both are pre-filled in every code snippet on that page.',
          '',
          'If you have multiple projects, use the project switcher in the top-left of the dashboard',
          'to select the right project before copying credentials.',
        ].join('\n'),
      }],
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})

const transport = new StdioServerTransport()
await server.connect(transport)
