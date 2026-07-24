#!/usr/bin/env node
/**
 * PAAQ Intelligence MCP Server
 *
 * Exposes tools that let any AI agent (Claude Code, Cursor, etc.) automatically
 * connect a website or app to PAAQ Intelligence with a single prompt like:
 *   "Connect my Next.js app to PAAQ Intelligence"
 *
 * Setup in Claude Code — add to .mcp.json at your project root:
 *   { "mcpServers": { "paaq": { "command": "node", "args": ["path/to/packages/mcp-server/index.js"] } } }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const PAAQ_BASE = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'

// ── Snippet generators ──────────────────────────────────────────────────────

function snippet_nextjs(sdkToken, projectKey) {
  return `// 1. Create lib/paaq.ts in your project
// ─────────────────────────────────────────
export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  typeof crypto !== 'undefined' ? crypto.randomUUID() : '',

  async init() {
    await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
        'X-SDK-Version': '1.0.0',
        'X-Platform':    'nextjs',
        'X-Environment': process.env.NODE_ENV ?? 'production',
      },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
  },

  async track(eventName, properties = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: eventName, session_id: this.sessionId, properties }),
    }).catch(() => null)
  },
}

// 2. Call paaq.init() in your root layout (app/layout.tsx)
// ─────────────────────────────────────────
// 'use client'
// import { useEffect } from 'react'
// import { paaq } from '@/lib/paaq'
//
// export default function RootLayout({ children }) {
//   useEffect(() => { paaq.init() }, [])
//   return <html><body>{children}</body></html>
// }
`
}

function snippet_react(sdkToken, projectKey) {
  return `// 1. Create src/paaq.js in your project
// ─────────────────────────────────────────
export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  crypto.randomUUID(),

  async init() {
    await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
        'X-SDK-Version': '1.0.0',
        'X-Platform':    'react',
        'X-Environment': import.meta.env.MODE ?? 'production',
      },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
  },

  async track(eventName, properties = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({
        event_name:  eventName,
        session_id:  this.sessionId,
        screen_name: window.location.pathname,
        properties,
      }),
    }).catch(() => null)
  },
}

// 2. Add to src/main.jsx (or index.jsx)
// ─────────────────────────────────────────
// import { paaq } from './paaq'
// paaq.init()
`
}

function snippet_vue(sdkToken, projectKey) {
  return `// 1. Create src/paaq.js
// ─────────────────────────────────────────
export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  crypto.randomUUID(),

  async init() {
    await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID':  this.projectKey,
        'X-SDK-Version': '1.0.0',
        'X-Platform':    'vue',
        'X-Environment': import.meta.env.MODE ?? 'production',
      },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
  },

  async track(eventName, properties = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: eventName, session_id: this.sessionId, screen_name: window.location.pathname, properties }),
    }).catch(() => null)
  },
}

// 2. Add to src/main.js
// ─────────────────────────────────────────
// import { paaq } from './paaq'
// paaq.init()
`
}

function snippet_vanilla(sdkToken, projectKey) {
  return `<!-- Add before </body> in your HTML -->
<script>
  const PAAQ = {
    sdkToken:   '${sdkToken}',
    projectKey: '${projectKey}',
    base:       '${PAAQ_BASE}',
    sessionId:  crypto.randomUUID(),

    async init() {
      await fetch(this.base + '/sdk-init', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + this.sdkToken,
          'X-Project-ID':  this.projectKey,
          'X-SDK-Version': '1.0.0',
          'X-Platform':    'vanilla',
          'X-Environment': 'production',
        },
        body: JSON.stringify({ sessionId: this.sessionId }),
      }).catch(() => null)
    },

    async track(eventName, properties) {
      await fetch(this.base + '/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
        body: JSON.stringify({ event_name: eventName, session_id: this.sessionId, screen_name: location.pathname, properties }),
      }).catch(() => null)
    },
  }

  PAAQ.init()
  PAAQ.track('page_view', { title: document.title, referrer: document.referrer })
</script>`
}

function snippet_nodejs(sdkToken, projectKey) {
  return `// paaq.js — add to your Node.js/Express server
// ─────────────────────────────────────────
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
        'X-SDK-Version': '1.0.0',
        'X-Platform':    platform,
        'X-Environment': process.env.NODE_ENV ?? 'production',
      },
      body: JSON.stringify({}),
    }).catch(() => null)
    return res?.json().catch(() => null)
  },

  // Express middleware — tracks every request as an event
  middleware() {
    return (req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        fetch(\`\${this.base}/events\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
          body: JSON.stringify({
            event_name: 'api_request',
            properties: {
              method:   req.method,
              path:     req.path,
              status:   res.statusCode,
              duration: Date.now() - start,
            },
          }),
        }).catch(() => null)
      })
      next()
    }
  },
}

// Add to your server entry point (index.js / server.js):
// import { paaq } from './paaq.js'
// await paaq.init()
// app.use(paaq.middleware())
`
}

function snippet_python(sdkToken, projectKey) {
  return `# paaq.py — add to your Python project
# ─────────────────────────────────────────
import httpx
import uuid

class PAAQ:
    SDK_TOKEN   = '${sdkToken}'
    PROJECT_KEY = '${projectKey}'
    BASE        = '${PAAQ_BASE}'
    session_id  = str(uuid.uuid4())

    @classmethod
    def init(cls, platform='python', environment='production'):
        httpx.post(
            f'{cls.BASE}/sdk-init',
            headers={
                'Authorization': f'Bearer {cls.SDK_TOKEN}',
                'X-Project-ID':  cls.PROJECT_KEY,
                'X-SDK-Version': '1.0.0',
                'X-Platform':    platform,
                'X-Environment': environment,
            },
            json={'sessionId': cls.session_id},
            timeout=5,
        )

    @classmethod
    def track(cls, event_name: str, properties: dict = {}):
        httpx.post(
            f'{cls.BASE}/events',
            headers={'x-api-key': cls.PROJECT_KEY},
            json={'event_name': event_name, 'session_id': cls.session_id, 'properties': properties},
            timeout=5,
        )

    @classmethod
    def fastapi_middleware(cls):
        from starlette.middleware.base import BaseHTTPMiddleware
        import time
        class _M(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                start = time.time()
                response = await call_next(request)
                cls.track('api_request', {
                    'method': request.method,
                    'path':   request.url.path,
                    'status': response.status_code,
                    'duration_ms': round((time.time() - start) * 1000),
                })
                return response
        return _M

# Add to your main.py:
# from paaq import PAAQ
# PAAQ.init()
# app.add_middleware(PAAQ.fastapi_middleware())
`
}

const SNIPPETS = { nextjs: snippet_nextjs, react: snippet_react, vue: snippet_vue, vanilla: snippet_vanilla, nodejs: snippet_nodejs, python: snippet_python }
const FRAMEWORK_LABELS = { nextjs: 'Next.js', react: 'React', vue: 'Vue 3', vanilla: 'Vanilla JS / HTML', nodejs: 'Node.js', python: 'Python' }

// ── MCP server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'paaq-intelligence', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'paaq_verify_credentials',
      description: 'Test whether a PAAQ SDK token and project key are valid by calling the live API. Use this first to confirm the credentials work before generating code.',
      inputSchema: {
        type: 'object',
        properties: {
          sdkToken:   { type: 'string', description: 'SDK token starting with sdk_live_ (from the app management page → SDK Token)' },
          projectKey: { type: 'string', description: 'Project key starting with proj_ (from the app management page → Project Key)' },
        },
        required: ['sdkToken', 'projectKey'],
      },
    },
    {
      name: 'paaq_generate_snippet',
      description: 'Generate ready-to-paste integration code for connecting a website or app to PAAQ Intelligence. Returns the full code to add to the project.',
      inputSchema: {
        type: 'object',
        properties: {
          sdkToken:   { type: 'string', description: 'SDK token (sdk_live_xxx)' },
          projectKey: { type: 'string', description: 'Project key (proj_xxx)' },
          framework:  {
            type: 'string',
            enum: ['nextjs', 'react', 'vue', 'vanilla', 'nodejs', 'python'],
            description: 'The framework/language of the project to connect',
          },
        },
        required: ['sdkToken', 'projectKey', 'framework'],
      },
    },
    {
      name: 'paaq_send_test_event',
      description: 'Send a test event to PAAQ Intelligence to verify the connection is working end-to-end. Returns success/failure.',
      inputSchema: {
        type: 'object',
        properties: {
          sdkToken:   { type: 'string' },
          projectKey: { type: 'string' },
          eventName:  { type: 'string', description: 'Name of the test event to send', default: 'test_connection' },
        },
        required: ['sdkToken', 'projectKey'],
      },
    },
    {
      name: 'paaq_list_frameworks',
      description: 'List all frameworks that PAAQ Intelligence supports, with a short description of each.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  // ── paaq_verify_credentials ─────────────────────────────────────────────
  if (name === 'paaq_verify_credentials') {
    try {
      const res = await fetch(`${PAAQ_BASE}/sdk-init`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${args.sdkToken}`,
          'X-Project-ID':  args.projectKey,
          'X-SDK-Version': '1.0.0',
          'X-Platform':    'react',
          'X-Environment': 'production',
        },
        body: JSON.stringify({ sessionId: crypto.randomUUID() }),
      })
      const data = await res.json()

      if (data.ok) {
        return {
          content: [{
            type: 'text',
            text: `✓ Credentials valid\n\nProject: ${data.meta?.projectName}\nPlan: ${data.meta?.plan}\nSession ID: ${data.sessionId}\n\nYou can now generate the integration snippet with paaq_generate_snippet.`,
          }],
        }
      } else {
        return {
          content: [{ type: 'text', text: `✗ Credentials invalid\n\nError: ${data.error}\n\nCheck that your SDK token (starts with sdk_live_) and project key (starts with proj_) are correct. Both are visible on your app management page in PAAQ Intelligence.` }],
          isError: true,
        }
      }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `✗ Network error: ${err.message}` }],
        isError: true,
      }
    }
  }

  // ── paaq_generate_snippet ───────────────────────────────────────────────
  if (name === 'paaq_generate_snippet') {
    const gen = SNIPPETS[args.framework]
    if (!gen) {
      return { content: [{ type: 'text', text: `Unknown framework: ${args.framework}. Supported: ${Object.keys(SNIPPETS).join(', ')}` }], isError: true }
    }
    const code = gen(args.sdkToken, args.projectKey)
    const label = FRAMEWORK_LABELS[args.framework] ?? args.framework
    return {
      content: [{
        type: 'text',
        text: `## PAAQ Intelligence — ${label} Integration\n\n\`\`\`${args.framework === 'python' ? 'python' : args.framework === 'vanilla' ? 'html' : 'javascript'}\n${code}\n\`\`\`\n\nAfter adding this code, open the app management page in PAAQ Intelligence — the connection status will update automatically within a few seconds of your app sending its first event.`,
      }],
    }
  }

  // ── paaq_send_test_event ────────────────────────────────────────────────
  if (name === 'paaq_send_test_event') {
    const eventName = args.eventName ?? 'test_connection'
    try {
      const res = await fetch(`${PAAQ_BASE}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': args.projectKey,
        },
        body: JSON.stringify({
          event_name:  eventName,
          session_id:  crypto.randomUUID(),
          screen_name: '/mcp-test',
          properties:  { source: 'paaq-mcp-server', timestamp: new Date().toISOString() },
        }),
      })
      const data = await res.json()
      if (data.ok) {
        return { content: [{ type: 'text', text: `✓ Test event "${eventName}" sent successfully.\n\nInserted: ${data.inserted} event(s)\n\nCheck your PAAQ Intelligence dashboard — the connection status will now show as active.` }] }
      } else {
        return { content: [{ type: 'text', text: `✗ Event failed: ${data.error}` }], isError: true }
      }
    } catch (err) {
      return { content: [{ type: 'text', text: `✗ Network error: ${err.message}` }], isError: true }
    }
  }

  // ── paaq_list_frameworks ────────────────────────────────────────────────
  if (name === 'paaq_list_frameworks') {
    return {
      content: [{
        type: 'text',
        text: `## Supported Frameworks\n\n| Framework | Value | Notes |\n|---|---|---|\n| Next.js | \`nextjs\` | App Router or Pages Router |\n| React | \`react\` | Vite, CRA, or any React setup |\n| Vue 3 | \`vue\` | Vite or Vue CLI |\n| Vanilla JS | \`vanilla\` | Plain HTML + JS, no framework |\n| Node.js | \`nodejs\` | Express, Fastify, Hono, etc. |\n| Python | \`python\` | FastAPI, Flask, Django |\n\nUse the value string with paaq_generate_snippet.`,
      }],
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})

const transport = new StdioServerTransport()
await server.connect(transport)
