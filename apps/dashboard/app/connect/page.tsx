'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { cn } from '@/lib/utils'
import {
  Copy, Check, Terminal, Bot, Code2, Zap,
  ChevronRight, Sparkles, Globe, Server, Smartphone,
  Eye, EyeOff, Loader2,
} from 'lucide-react'

// ── Copy button ────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
        copied
          ? 'border-healthy/40 bg-healthy/10 text-healthy'
          : 'border-border/60 bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ── Code block ────────────────────────────────────────────────────────
function CodeBlock({ code, language = 'bash', label }: { code: string; language?: string; label?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-[#0d1117] overflow-hidden">
      {label && (
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</span>
          <CopyBtn text={code} />
        </div>
      )}
      {!label && (
        <div className="flex justify-end px-3 pt-2">
          <CopyBtn text={code} />
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-[#e6edf3] whitespace-pre">
        {code}
      </pre>
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────────────
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-ai/40 bg-ai/10 text-xs font-bold text-ai">
          {n}
        </div>
        <div className="w-px flex-1 bg-border/40" />
      </div>
      <div className="pb-8 min-w-0 flex-1">
        <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </div>
  )
}

// ── Tab types ─────────────────────────────────────────────────────────
type TabId = 'mcp' | 'cli' | 'prompt' | 'manual'

const TABS: { id: TabId; label: string; icon: typeof Bot; desc: string }[] = [
  { id: 'mcp',    label: 'MCP Server',    icon: Zap,      desc: 'AI agents connect automatically' },
  { id: 'cli',    label: 'CLI',           icon: Terminal, desc: 'One command in your terminal' },
  { id: 'prompt', label: 'Agent Prompt',  icon: Bot,      desc: 'Copy + paste into any AI chat' },
  { id: 'manual', label: 'Manual',        icon: Code2,    desc: 'Generate a code snippet yourself' },
]

const FRAMEWORKS = ['nextjs', 'react', 'vue', 'vanilla', 'nodejs', 'python'] as const
type Framework = typeof FRAMEWORKS[number]
const FRAMEWORK_LABELS: Record<Framework, string> = {
  nextjs: 'Next.js', react: 'React', vue: 'Vue 3', vanilla: 'Vanilla JS', nodejs: 'Node.js', python: 'Python',
}

// ── Main page ──────────────────────────────────────────────────────────
export default function ConnectPage() {
  const { app } = useConnectedApp()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabId | null) ?? 'mcp'
  const [tab, setTab] = useState<TabId>(initialTab)
  const [framework, setFramework] = useState<Framework>('nextjs')
  const [sdkToken, setSdkToken] = useState<string | null>(null)
  const [projectKey, setProjectKey] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(true)

  const PAAQ_BASE = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    Promise.all([
      sb.from('tenant_projects')
        .select('project_id_key')
        .eq('id', app.id)
        .single(),
      sb.from('access_tokens')
        .select('token')
        .eq('project_id', app.id)
        .eq('token_type', 'sdk_token')
        .eq('status', 'active')
        .limit(1),
    ]).then(([{ data: proj }, { data: tokens }]) => {
      if (proj) setProjectKey(proj.project_id_key)
      if (tokens?.[0]) setSdkToken((tokens[0] as { token: string }).token)
      setLoading(false)
    })
  }, [app.id])

  const tok = sdkToken  ?? 'sdk_live_••••••••••••••••••••••••••••••••'
  const key = projectKey ?? 'proj_••••••••'

  // ── Generated content ──────────────────────────────────────────────

  const mcpJson = `{
  "mcpServers": {
    "paaq": {
      "type": "stdio",
      "command": "node",
      "args": ["packages/mcp-server/index.js"]
    }
  }
}`

  const cliCommand = `node packages/cli/index.js connect`

  const cliNonInteractive = `node packages/cli/index.js snippet \\
  --sdk-token   ${tok} \\
  --project-key ${key} \\
  --framework   ${framework}`

  const agentPrompt = `Connect my ${FRAMEWORK_LABELS[framework]} app to PAAQ Intelligence.

SDK Token:   ${tok}
Project Key: ${key}

Steps:
1. Detect my framework from package.json
2. Generate the PAAQ integration snippet
3. Add it to my app entry point
4. Send a test event to verify the connection

Use the paaq_verify_credentials and paaq_generate_snippet MCP tools if available.`

  const snippets: Record<Framework, string> = {
    nextjs: `// lib/paaq.ts — add to your Next.js project
export const paaq = {
  sdkToken:   '${tok}',
  projectKey: '${key}',
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

  async track(event: string, props: Record<string, unknown> = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: event, session_id: this.sessionId, properties: props }),
    }).catch(() => null)
  },
}

// In app/layout.tsx — call paaq.init() inside a useEffect`,

    react: `// src/paaq.js — add to your React project
export const paaq = {
  sdkToken:   '${tok}',
  projectKey: '${key}',
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

  async track(event, props = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: event, session_id: this.sessionId,
        screen_name: window.location.pathname, properties: props }),
    }).catch(() => null)
  },
}

// In src/main.jsx: import { paaq } from './paaq'; paaq.init()`,

    vue: `// src/paaq.js — add to your Vue 3 project
export const paaq = {
  sdkToken:   '${tok}',
  projectKey: '${key}',
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

  async track(event, props = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: event, session_id: this.sessionId,
        screen_name: window.location.pathname, properties: props }),
    }).catch(() => null)
  },
}

// In src/main.js: import { paaq } from './paaq'; paaq.init()`,

    vanilla: `<!-- Add before </body> in your HTML page -->
<script>
const PAAQ = {
  sdkToken:   '${tok}',
  projectKey: '${key}',
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

  async track(event, props) {
    await fetch(this.base + '/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: event, session_id: this.sessionId,
        screen_name: location.pathname, properties: props }),
    }).catch(() => null)
  },
}

PAAQ.init()
PAAQ.track('page_view', { title: document.title })
</script>`,

    nodejs: `// paaq.js — add to your Node.js project
export const paaq = {
  sdkToken:   '${tok}',
  projectKey: '${key}',
  base:       '${PAAQ_BASE}',

  async init(platform = 'nodejs') {
    await fetch(\`\${this.base}/sdk-init\`, {
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
  },

  // Express / Fastify / Hono middleware
  middleware() {
    return (req, res, next) => {
      const t = Date.now()
      res.on('finish', () => {
        fetch(\`\${this.base}/events\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
          body: JSON.stringify({ event_name: 'api_request', properties: {
            method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t,
          }}),
        }).catch(() => null)
      })
      next()
    }
  },
}

// In server.js: import { paaq } from './paaq.js'
// await paaq.init()
// app.use(paaq.middleware())`,

    python: `# paaq.py — add to your Python project
import httpx, uuid

class PAAQ:
    SDK_TOKEN   = '${tok}'
    PROJECT_KEY = '${key}'
    BASE        = '${PAAQ_BASE}'
    session_id  = str(uuid.uuid4())

    @classmethod
    def init(cls, platform='python', environment='production'):
        httpx.post(f'{cls.BASE}/sdk-init', headers={
            'Authorization': f'Bearer {cls.SDK_TOKEN}',
            'X-Project-ID':  cls.PROJECT_KEY,
            'X-SDK-Version': '1.0.0',
            'X-Platform':    platform,
            'X-Environment': environment,
        }, json={'sessionId': cls.session_id}, timeout=5)

    @classmethod
    def track(cls, event_name: str, properties: dict = {}):
        httpx.post(f'{cls.BASE}/events',
            headers={'x-api-key': cls.PROJECT_KEY},
            json={'event_name': event_name, 'session_id': cls.session_id,
                  'properties': properties}, timeout=5)

    @classmethod
    def fastapi_middleware(cls):
        from starlette.middleware.base import BaseHTTPMiddleware
        import time
        class _M(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                t = time.time()
                response = await call_next(request)
                cls.track('api_request', {'path': request.url.path,
                    'status': response.status_code, 'ms': round((time.time()-t)*1000)})
                return response
        return _M

# In main.py:
# from paaq import PAAQ
# PAAQ.init()
# app.add_middleware(PAAQ.fastapi_middleware())`,
  }

  if (loading || app.id === '__loading__') {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-ai" />
          <span className="text-xs font-semibold uppercase tracking-widest text-ai">PAAQ Intelligence</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Connect your app</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how you want to integrate PAAQ Intelligence into your website or app.
          Your credentials are pre-filled in every snippet.
        </p>
      </div>

      {/* Credentials strip */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Your credentials — {app.name}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {/* SDK Token */}
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">SDK Token</p>
              <code className="block truncate font-mono text-xs text-foreground">
                {sdkToken
                  ? (showToken ? sdkToken : `${sdkToken.slice(0, 16)}••••••••••••`)
                  : <span className="text-muted-foreground/50 italic text-[10px]">Not found</span>
                }
              </code>
            </div>
            {sdkToken && (
              <>
                <button onClick={() => setShowToken((s) => !s)} className="shrink-0 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <CopyBtn text={sdkToken} />
              </>
            )}
          </div>
          {/* Project Key */}
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Project Key</p>
              <code className="block truncate font-mono text-xs text-foreground">
                {projectKey ?? <span className="text-muted-foreground/50 italic text-[10px]">Loading…</span>}
              </code>
            </div>
            {projectKey && <CopyBtn text={projectKey} />}
          </div>
        </div>
      </div>

      {/* Method tabs */}
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition-all',
                  tab === t.id
                    ? 'border-ai/40 bg-ai/8 ring-1 ring-ai/20'
                    : 'border-border/50 bg-card hover:border-border hover:bg-accent/30',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5', tab === t.id ? 'text-ai' : 'text-muted-foreground')} />
                  <span className={cn('text-xs font-semibold', tab === t.id ? 'text-ai' : 'text-foreground')}>{t.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{t.desc}</p>
              </button>
            )
          })}
        </div>

        {/* ── MCP Tab ──────────────────────────────────────────────── */}
        {tab === 'mcp' && (
          <div className="space-y-0">
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-ai/20 bg-ai/5 px-4 py-3">
              <Zap className="h-4 w-4 text-ai shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                The MCP server lets AI agents (Claude Code, Cursor, Windsurf) connect any app automatically.
                Once set up, just describe what you want — the agent does the rest.
              </p>
            </div>

            <Step n={1} title="Install the MCP server dependency">
              <CodeBlock code={`cd /path/to/paaq-listening-platform/packages/mcp-server\nnpm install`} label="Terminal" />
            </Step>

            <Step n={2} title="Add .mcp.json to your project root">
              <p className="mb-2 text-[11px] text-muted-foreground">
                Create this file in the root of the project you want to connect:
              </p>
              <CodeBlock code={mcpJson} label=".mcp.json" language="json" />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Update the path in <code className="font-mono bg-muted/60 px-1 rounded text-[10px]">args</code> to point to where the PAAQ repo lives on your machine.
              </p>
            </Step>

            <Step n={3} title="Restart Claude Code and use this prompt">
              <p className="mb-2 text-[11px] text-muted-foreground">
                Open Claude Code in your project directory and paste this prompt:
              </p>
              <div className="rounded-xl border border-border/60 bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Agent prompt — copy and paste into Claude Code</span>
                  <CopyBtn text={`Connect my ${FRAMEWORK_LABELS[framework]} app to PAAQ Intelligence.\n\nSDK Token:   ${tok}\nProject Key: ${key}\n\nVerify credentials, generate the integration snippet, add it to my app, and send a test event to confirm the connection.`} />
                </div>
                <div className="p-4 text-[12px] text-[#e6edf3] font-mono leading-relaxed whitespace-pre">{`Connect my ${FRAMEWORK_LABELS[framework]} app to PAAQ Intelligence.

SDK Token:   ${tok}
Project Key: ${key}

Verify credentials, generate the integration snippet,
add it to my app, and send a test event to confirm.`}</div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Claude will call <code className="font-mono bg-muted/60 px-1 rounded text-[10px]">paaq_verify_credentials</code>, <code className="font-mono bg-muted/60 px-1 rounded text-[10px]">paaq_generate_snippet</code>, and <code className="font-mono bg-muted/60 px-1 rounded text-[10px]">paaq_send_test_event</code> automatically.
              </p>
            </Step>
          </div>
        )}

        {/* ── CLI Tab ───────────────────────────────────────────────── */}
        {tab === 'cli' && (
          <div className="space-y-0">
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <Terminal className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Run the PAAQ CLI from your terminal. It detects your framework automatically, verifies your credentials, and outputs the ready-to-paste integration code.
              </p>
            </div>

            <Step n={1} title="Open your terminal in your project directory">
              <CodeBlock code={`cd /path/to/your-project`} />
            </Step>

            <Step n={2} title="Run the interactive connect wizard">
              <CodeBlock code={`node /path/to/paaq-listening-platform/packages/cli/index.js connect`} label="Terminal" />
              <p className="mt-2 text-[11px] text-muted-foreground">
                The wizard will detect your framework, ask for your credentials, verify them, and output the snippet.
              </p>
            </Step>

            <Step n={3} title="Or run non-interactively with your credentials pre-filled">
              <div className="mb-2 flex flex-wrap gap-2">
                {FRAMEWORKS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFramework(f)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                      framework === f ? 'border-ai/40 bg-ai/10 text-ai' : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    {FRAMEWORK_LABELS[f]}
                  </button>
                ))}
              </div>
              <CodeBlock code={cliNonInteractive} label="Terminal — pre-filled with your credentials" />
            </Step>
          </div>
        )}

        {/* ── Agent Prompt Tab ──────────────────────────────────────── */}
        {tab === 'prompt' && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-ai/20 bg-ai/5 px-4 py-3">
              <Bot className="h-4 w-4 text-ai shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Copy this prompt and paste it into any AI coding assistant — Claude, ChatGPT, Cursor, Copilot, or any other.
                The agent will generate and add the integration code to your project.
              </p>
            </div>

            {/* Framework selector */}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Choose your framework:</p>
              <div className="flex flex-wrap gap-2">
                {FRAMEWORKS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFramework(f)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                      framework === f ? 'border-ai/40 bg-ai/10 text-ai' : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    {f === 'nextjs' && <Globe className="h-3 w-3" />}
                    {f === 'react' && <Globe className="h-3 w-3" />}
                    {(f === 'nodejs' || f === 'python') && <Server className="h-3 w-3" />}
                    {(f === 'vue' || f === 'vanilla') && <Globe className="h-3 w-3" />}
                    {FRAMEWORK_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* The prompt */}
            <div className="rounded-xl border border-border/60 bg-[#0d1117] overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Copy this prompt → paste into your AI agent
                </span>
                <CopyBtn text={agentPrompt} label="Copy prompt" />
              </div>
              <pre className="p-4 font-mono text-[12px] leading-relaxed text-[#e6edf3] whitespace-pre">
{agentPrompt}
              </pre>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                If the agent has the PAAQ MCP server configured, it will use the <code className="font-mono bg-muted/60 px-1 rounded text-[10px]">paaq_generate_snippet</code> tool automatically.
                Otherwise it will generate the integration code directly from the credentials in the prompt.
              </p>
            </div>
          </div>
        )}

        {/* ── Manual Tab ────────────────────────────────────────────── */}
        {tab === 'manual' && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <Code2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Choose your framework and copy the snippet below. Add it to your app's entry point — your credentials are already filled in.
              </p>
            </div>

            {/* Framework selector */}
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFramework(f)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                    framework === f ? 'border-ai/40 bg-ai/10 text-ai' : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {FRAMEWORK_LABELS[f]}
                </button>
              ))}
            </div>

            <CodeBlock
              code={snippets[framework]}
              label={`${FRAMEWORK_LABELS[framework]} — copy and paste into your project`}
              language={framework === 'python' ? 'python' : 'javascript'}
            />

            <div className="flex items-start gap-2.5 rounded-xl border border-healthy/25 bg-healthy/5 px-4 py-3">
              <Sparkles className="h-4 w-4 text-healthy shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                After adding the snippet and starting your app, your PAAQ Intelligence dashboard will automatically detect the connection and begin monitoring.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
