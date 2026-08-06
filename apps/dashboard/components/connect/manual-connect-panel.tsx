'use client'

// Power-user connection path — just the Agent Prompt method now (MCP/CLI/
// Manual tabs were dropped per request: one clear fallback path instead of
// four overlapping ones) plus the credentials strip. Lives inside a
// collapsed <details> disclosure on the one-prompt `/connect` page.

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { cn } from '@/lib/utils'
import { Copy, Check, Bot, Globe, Server, ChevronRight, Eye, EyeOff, Loader2 } from 'lucide-react'

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

const FRAMEWORKS = ['nextjs', 'react', 'vue', 'vanilla', 'nodejs', 'python'] as const
type Framework = typeof FRAMEWORKS[number]
const FRAMEWORK_LABELS: Record<Framework, string> = {
  nextjs: 'Next.js', react: 'React', vue: 'Vue 3', vanilla: 'Vanilla JS', nodejs: 'Node.js', python: 'Python',
}

// ── Main panel ──────────────────────────────────────────────────────────
export function ManualConnectPanel() {
  const { app } = useConnectedApp()
  const [framework, setFramework] = useState<Framework>('nextjs')
  const [sdkToken, setSdkToken] = useState<string | null>(null)
  const [projectKey, setProjectKey] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(true)

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

  const agentPrompt = `Connect my ${FRAMEWORK_LABELS[framework]} app to PAAQ Intelligence.

═══════════════════════════════════════════
CREDENTIALS
═══════════════════════════════════════════
SDK Token:   ${tok}
Project Key: ${key}

These credentials are already valid — do NOT ask me to get them from anywhere else.

═══════════════════════════════════════════
WHAT PAAQ INTELLIGENCE IS
═══════════════════════════════════════════
PAAQ Intelligence is a product analytics and AI monitoring platform.
Connecting this app means:
- All user events (page views, clicks, errors) are captured and analysed
- The PAAQ dashboard shows real-time connection status, sessions, and AI insights
- The connection is confirmed when a test event is received successfully

═══════════════════════════════════════════
STEP-BY-STEP INSTRUCTIONS
═══════════════════════════════════════════
Follow these steps exactly, in order:

STEP 1 — Detect the framework
  Read the file package.json (or requirements.txt for Python projects).
  If the PAAQ MCP server is available, call:
    paaq_detect_framework(packageJsonContent: <contents of package.json>)
  Otherwise, inspect the dependencies yourself to identify the framework.
  Supported: nextjs, react, vue, vanilla, nodejs, python

STEP 2 — Verify credentials
  Before writing any code, confirm the credentials work.
  Call: paaq_verify_credentials(sdkToken: "${tok}", projectKey: "${key}")
  If this fails, stop and tell me the error message.
  Do NOT continue to the next step if verification fails.

STEP 3 — Generate the integration code
  Call: paaq_generate_snippet(sdkToken: "${tok}", projectKey: "${key}", framework: <detected>)
  The tool returns the exact file contents to write.

STEP 4 — Write the integration file
  Use your own file tools to write the file to the project.
  The snippet output tells you the exact filename and location.
  Common locations:
    Next.js  → lib/paaq.ts
    React    → src/paaq.js
    Vue      → src/paaq.js
    Node.js  → paaq.js (project root)
    Python   → paaq.py (project root)
    Vanilla  → add the <script> block to the main HTML file

STEP 5 — Add the init call to the app entry point
  The snippet contains comments showing exactly where to add the import and init call.
  Make that edit now so the SDK initialises when the app starts.

STEP 6 — Send a test event to confirm the connection
  Call: paaq_send_test_event(sdkToken: "${tok}", projectKey: "${key}")
  A successful response means PAAQ Intelligence is now receiving data.
  Tell me the result.

═══════════════════════════════════════════
IF THE MCP SERVER IS NOT AVAILABLE
═══════════════════════════════════════════
Generate the integration code directly. The API endpoints are:

  Handshake:  POST https://mookyonwpovxscsbqwwl.supabase.co/functions/v1/sdk-init
  Events:     POST https://mookyonwpovxscsbqwwl.supabase.co/functions/v1/events

Auth headers for BOTH endpoints:
  Authorization: Bearer ${tok}
  X-Project-ID:  ${key}
  X-SDK-Version: 1.1.0
  X-Platform:    <framework name>
  X-Environment: production

Events endpoint accepts a JSON array of event objects:
  [{ event_name, session_id, screen_name, properties, timestamp }]

After writing the file and adding the init call, send a test event manually
to confirm the connection is working.

═══════════════════════════════════════════
DONE WHEN
═══════════════════════════════════════════
✓ paaq_verify_credentials returned ok: true
✓ Integration file written to the project
✓ Init call added to the app entry point
✓ paaq_send_test_event returned ok: true (or manual test event sent)
✓ You have told me the project name returned by the API`

  if (loading || app.id === '__loading__') {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">

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

      {/* Agent Prompt */}
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
                {(f === 'nodejs' || f === 'python') ? <Server className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
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
          <pre className="p-4 font-mono text-[12px] leading-relaxed text-[#e6edf3] whitespace-pre overflow-x-auto">
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
    </div>
  )
}
