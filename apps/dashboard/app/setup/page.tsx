'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  Globe, Smartphone, Server, Network, Cloud,
  CheckCircle2, ArrowRight, ArrowLeft, Plus,
  Copy, Check, Loader2, Sparkles, Zap, Terminal,
  Package, GitBranch, Layers, Container, Clock,
  Settings, LayoutDashboard,
} from 'lucide-react'
import type { ConnectedApp } from '@/lib/connected-app'

// ── Step types ────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5

// ── Step 1: App types ─────────────────────────────────────────────────
const APP_TYPES = [
  { id: 'website',        emoji: '🌐', label: 'Website',              desc: 'React, Next.js, Vue, WordPress, Webflow',  icon: Globe,      accent: 'text-intel border-intel/30 bg-intel/8 hover:bg-intel/12',   activeAccent: 'border-intel bg-intel/10 ring-intel/20' },
  { id: 'mobile',         emoji: '📱', label: 'Mobile App',           desc: 'React Native, Flutter, iOS, Android',       icon: Smartphone, accent: 'text-ai border-ai/30 bg-ai/8 hover:bg-ai/12',             activeAccent: 'border-ai bg-ai/10 ring-ai/20' },
  { id: 'backend',        emoji: '🖥',  label: 'Backend / Server',     desc: 'Node.js, Python, Go, Java, PHP, .NET',      icon: Server,     accent: 'text-healthy border-healthy/30 bg-healthy/8 hover:bg-healthy/12', activeAccent: 'border-healthy bg-healthy/10 ring-healthy/20' },
  { id: 'api',            emoji: '🔗', label: 'API',                  desc: 'REST, GraphQL, gRPC, WebSocket',            icon: Network,    accent: 'text-warning border-warning/30 bg-warning/8 hover:bg-warning/12', activeAccent: 'border-warning bg-warning/10 ring-warning/20' },
  { id: 'infrastructure', emoji: '☁',  label: 'Cloud Infrastructure', desc: 'AWS, Azure, GCP, Docker, Kubernetes',       icon: Cloud,      accent: 'text-critical border-critical/30 bg-critical/8 hover:bg-critical/12', activeAccent: 'border-critical bg-critical/10 ring-critical/20' },
] as const

type AppTypeId = typeof APP_TYPES[number]['id']

// ── Step 2: Technologies ──────────────────────────────────────────────
const TECHNOLOGIES: Record<AppTypeId, string[]> = {
  website:        ['React', 'Next.js', 'Angular', 'Vue', 'WordPress', 'Shopify', 'Webflow', 'Other'],
  mobile:         ['React Native', 'Flutter', 'iOS (Swift)', 'Android (Kotlin)', 'Ionic', 'Other'],
  backend:        ['Node.js', 'Python', 'Go', 'Java', 'PHP', '.NET', 'Ruby', 'Other'],
  api:            ['REST', 'GraphQL', 'gRPC', 'WebSocket', 'Other'],
  infrastructure: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Vercel', 'Netlify', 'Other'],
}

// ── Step 3: Install methods ───────────────────────────────────────────
type MethodId = 'sdk' | 'tag' | 'cli' | 'github' | 'docker'

type InstallMethod = {
  id: MethodId
  label: string
  desc: string
  icon: typeof Terminal
  recommended?: boolean
}

const METHODS: Record<AppTypeId, InstallMethod[]> = {
  website: [
    { id: 'sdk',    label: 'SDK (npm / yarn)',  desc: 'Install via package manager — fastest setup', icon: Package,   recommended: true },
    { id: 'tag',    label: 'Tag Manager',        desc: 'Google Tag Manager, Segment or similar',       icon: Layers },
    { id: 'cli',    label: 'CLI',                desc: 'Command line setup tool',                      icon: Terminal },
    { id: 'github', label: 'GitHub Action',      desc: 'Automatic CI/CD integration',                  icon: GitBranch },
  ],
  mobile: [
    { id: 'sdk', label: 'SDK', desc: 'Install via package manager — fastest setup', icon: Package, recommended: true },
    { id: 'cli', label: 'CLI', desc: 'Command line setup tool',                     icon: Terminal },
  ],
  backend: [
    { id: 'sdk',    label: 'SDK',           desc: 'Install via package manager — fastest setup', icon: Package,   recommended: true },
    { id: 'cli',    label: 'CLI',           desc: 'Command line setup tool',                     icon: Terminal },
    { id: 'github', label: 'GitHub Action', desc: 'Automatic CI/CD integration',                 icon: GitBranch },
    { id: 'docker', label: 'Docker',        desc: 'Sidecar container',                           icon: Container },
  ],
  api: [
    { id: 'sdk', label: 'SDK / Middleware', desc: 'Wrap your API routes — fastest setup', icon: Package, recommended: true },
    { id: 'cli', label: 'CLI',              desc: 'Command line setup tool',               icon: Terminal },
  ],
  infrastructure: [
    { id: 'docker', label: 'Docker',        desc: 'Container deployment — recommended',  icon: Container, recommended: true },
    { id: 'cli',    label: 'CLI',           desc: 'Command line setup tool',             icon: Terminal },
    { id: 'github', label: 'GitHub Action', desc: 'CI/CD pipeline integration',          icon: GitBranch },
  ],
}

// ── Step 4: Checklist generation ──────────────────────────────────────
type ChecklistItem = {
  id: string
  label: string
  detail: string
  code?: string
  isKey?: boolean
  isVerify?: boolean
}

function buildChecklist(type: AppTypeId, tech: string, _method: string, apiKey: string, projectId: string): ChecklistItem[] {
  const isPy     = tech === 'Python'
  const isFlutter = tech === 'Flutter'
  const isBack   = type === 'backend'
  const isMobile = type === 'mobile'
  const isWeb    = type === 'website'

  const installCmd = isBack && isPy
    ? 'pip install paaq-server-sdk'
    : isMobile && isFlutter
    ? 'flutter pub add paaq_mobile_sdk'
    : isBack
    ? 'npm install @paaq/server-sdk'
    : isWeb
    ? 'npm install @paaq/web-sdk'
    : 'npm install @paaq/sdk'

  const initCode = isBack && isPy
    ? `from paaq import PAAQ\n\nPAAQ.initialize(\n    sdk_token="${apiKey}",\n    project_id="${projectId}"\n)`
    : isMobile && isFlutter
    ? `await PAAQ.initialize(\n  sdkToken: '${apiKey}',\n  projectId: '${projectId}',\n);`
    : isBack
    ? `import { PAAQ } from '@paaq/server-sdk';\n\nPAAQ.initialize({\n  sdkToken: '${apiKey}',\n  projectId: '${projectId}',\n});\napp.use(PAAQ.middleware());`
    : `import { PAAQProvider } from '@paaq/web-sdk';\n\n<PAAQProvider\n  sdkToken="${apiKey}"\n  projectId="${projectId}"\n>\n  <YourApp />\n</PAAQProvider>`

  const startCmd = isBack && isPy
    ? 'python app.py'
    : isMobile && isFlutter
    ? 'flutter run'
    : isBack
    ? 'npm start'
    : 'npm run dev'

  return [
    { id: 'install',  label: 'Install the SDK',         detail: 'Run this command in your project directory',         code: installCmd },
    { id: 'key',      label: 'Copy your API Key',        detail: 'Keep this secure — never commit to version control', isKey: true },
    { id: 'init',     label: 'Initialise the SDK',       detail: 'Add this to your application entry point',           code: initCode },
    { id: 'start',    label: 'Start your application',   detail: 'Run your app as you normally would',                 code: startCmd },
    { id: 'verify',   label: 'Verify connection',         detail: 'Click the button below to confirm PAAQ can see your app', isVerify: true },
  ]
}

// ── Step 5: Verification steps ────────────────────────────────────────
const VERIFY_STEPS = [
  { label: 'Connection Established',    detail: 'Secure channel confirmed' },
  { label: 'SDK Verified',              detail: 'SDK version and token validated' },
  { label: 'Events Received',           detail: 'First data signals detected' },
  { label: 'Authentication Successful', detail: 'API key accepted' },
  { label: 'AI Discovery Started',      detail: 'Agents are now learning your application' },
]

const DISCOVER_STEPS = [
  'Application Discovery',
  'Frontend Analysis',
  'Backend Analysis',
  'User Journey Mapping',
  'API Discovery',
  'Knowledge Base Generation',
]

// ── CopyButton ────────────────────────────────────────────────────────
function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className={cn(
        'flex items-center gap-1 rounded-md border border-border/60 bg-muted/60 font-medium text-muted-foreground transition-colors hover:text-foreground',
        small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]',
      )}
    >
      {copied ? <Check className="h-3 w-3 text-healthy" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── Connected App Card ─────────────────────────────────────────────────
function AppCard({ app }: { app: ConnectedApp }) {
  const connectedCount = [app.sdkStatus.frontend, app.sdkStatus.backend, app.sdkStatus.database]
    .filter((s) => s === 'connected').length
  const coverage = Math.round((connectedCount / 3) * 100)
  const health   = coverage === 100 ? 'Excellent' : coverage >= 66 ? 'Good' : 'Limited'
  const healthTone = coverage === 100 ? 'healthy' : coverage >= 66 ? 'ai' : 'warning'

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: app.accentColor }}
          >
            {app.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{app.name}</p>
            <p className="text-[10px] text-muted-foreground">{app.environment} · {app.connectedSince}</p>
          </div>
        </div>
        <ToneBadge tone="healthy" dot>Connected</ToneBadge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/40 bg-background/30 px-2.5 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">Coverage</p>
          <p className="text-base font-bold text-ai tabular-nums">{coverage}%</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/30 px-2.5 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">Health</p>
          <p className={cn('text-sm font-semibold', healthTone === 'healthy' ? 'text-healthy' : healthTone === 'ai' ? 'text-ai' : 'text-warning')}>
            {health}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/30 px-2.5 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">Last Seen</p>
          <p className="text-[11px] font-medium text-foreground">Live</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href="/dashboard"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-ai/30 bg-ai/10 px-3 py-2 text-xs font-semibold text-ai hover:bg-ai/20 transition-colors"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Intelligence
        </Link>
        <Link
          href="/settings"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Manage
        </Link>
      </div>
    </div>
  )
}

// ── Step indicator ────────────────────────────────────────────────────
function StepIndicator({ current, total = 5 }: { current: Step; total?: number }) {
  const LABELS = ['Choose type', 'Technology', 'Installation', 'Configure', 'Verify']
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }, (_, i) => {
        const n = (i + 1) as Step
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
              done   && 'bg-ai text-white',
              active && 'bg-foreground text-background ring-4 ring-foreground/10',
              !done && !active && 'bg-muted text-muted-foreground',
            )}>
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            {active && (
              <span className="ml-2 text-xs font-semibold text-foreground hidden sm:block">
                {LABELS[i]}
              </span>
            )}
            {i < total - 1 && (
              <div className={cn(
                'mx-2 h-px flex-1 w-8 transition-colors',
                done ? 'bg-ai/60' : 'bg-border/60',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function SetupPage() {
  const { app, allApps } = useConnectedApp()

  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [appType, setAppType]       = useState<AppTypeId | null>(null)
  const [technology, setTechnology] = useState<string | null>(null)
  const [method, setMethod]         = useState<MethodId | null>(null)
  const [checklist, setChecklist]   = useState<ChecklistItem[]>([])
  const [done, setDone]             = useState<Record<string, boolean>>({})

  // Step 5 state
  const [verifying, setVerifying]   = useState(false)
  const [verifyIdx, setVerifyIdx]   = useState(-1)
  const [verified, setVerified]     = useState(false)
  const [discoverIdx, setDiscoverIdx] = useState(-1)

  const hasApps = allApps.length > 0

  const startVerification = useCallback(() => {
    setVerifying(true)
    let i = 0
    const tick = () => {
      setVerifyIdx(i)
      i++
      if (i < VERIFY_STEPS.length) setTimeout(tick, 900)
      else {
        setTimeout(() => {
          setVerified(true)
          let d = 0
          const discover = () => {
            setDiscoverIdx(d)
            d++
            if (d < DISCOVER_STEPS.length) setTimeout(discover, 700)
          }
          setTimeout(discover, 400)
        }, 600)
      }
    }
    setTimeout(tick, 400)
  }, [])

  // Move to step 4 and generate checklist
  const goStep4 = useCallback(() => {
    if (!appType || !technology || !method) return
    const items = buildChecklist(appType, technology, method, app.apiKey, app.id)
    setChecklist(items)
    setDone({})
    setStep(4)
  }, [appType, technology, method, app.apiKey, app.id])

  const resetWizard = () => {
    setStep(1)
    setAppType(null)
    setTechnology(null)
    setMethod(null)
    setChecklist([])
    setDone({})
    setVerifying(false)
    setVerifyIdx(-1)
    setVerified(false)
    setDiscoverIdx(-1)
  }

  const handleMarkDone = (id: string) => {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }))
    if (id === 'verify') {
      startVerification()
      setStep(5)
    }
  }

  const chosenType = APP_TYPES.find((t) => t.id === appType)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Setup &amp; Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your applications and watch AI discover how your organisation operates.
          </p>
        </div>
        {hasApps && !showWizard && (
          <button
            onClick={() => { setShowWizard(true); resetWizard() }}
            className="flex items-center gap-2 rounded-xl border border-ai/30 bg-ai/10 px-4 py-2 text-sm font-semibold text-ai hover:bg-ai/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Connect another app
          </button>
        )}
      </div>

      {/* Connected Applications */}
      {hasApps && !showWizard && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Connected Applications</h2>
            <span className="rounded-full border border-healthy/30 bg-healthy/10 px-2 py-0.5 text-[10px] font-bold text-healthy">
              {allApps.length} connected
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {allApps.map((a) => <AppCard key={a.id} app={a} />)}
          </div>
        </div>
      )}

      {/* Wizard — show if no apps, or if user clicked "Connect another" */}
      {(!hasApps || showWizard) && (
        <div className="space-y-6">
          {/* Empty state hero */}
          {!hasApps && !showWizard && (
            <div className="rounded-2xl border border-ai/20 bg-ai/5 px-6 py-10 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ai/10">
                <Sparkles className="h-8 w-8 text-ai" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Connect your first application</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  PAAQ Intelligence will automatically begin learning how your organisation operates within minutes.
                </p>
              </div>
              <button
                onClick={() => setShowWizard(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-ai px-6 py-3 text-sm font-semibold text-white hover:bg-ai/90 transition-colors shadow-lg shadow-ai/20"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Wizard card */}
          {showWizard && (
            <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
              {/* Wizard header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-6 py-4">
                <StepIndicator current={step} />
                {step < 5 && (
                  <button
                    onClick={() => {
                      if (hasApps) { setShowWizard(false); resetWizard() }
                      else resetWizard()
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="px-6 py-6 space-y-6">

                {/* ── Step 1: Choose type ─────────────────────────────── */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-semibold text-foreground">What would you like to connect?</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Choose the type of application you want to monitor.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {APP_TYPES.map((t) => {
                        const Icon = t.icon
                        const selected = appType === t.id
                        return (
                          <button
                            key={t.id}
                            onClick={() => { setAppType(t.id); setTechnology(null); setMethod(null) }}
                            className={cn(
                              'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                              selected
                                ? `${t.activeAccent} ring-2`
                                : `border-border/60 bg-card hover:bg-accent/30`,
                            )}
                          >
                            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-lg', t.accent)}>
                              {t.emoji}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{t.label}</p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{t.desc}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => appType && setStep(2)}
                        disabled={!appType}
                        className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 disabled:opacity-30"
                      >
                        Next <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Choose technology ────────────────────────── */}
                {step === 2 && appType && (
                  <div className="space-y-4">
                    <div>
                      <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <h2 className="text-base font-semibold text-foreground">Which technology are you using?</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Connecting: <span className="font-medium text-foreground">{chosenType?.label}</span>
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {TECHNOLOGIES[appType].map((tech) => (
                        <button
                          key={tech}
                          onClick={() => { setTechnology(tech); setMethod(null) }}
                          className={cn(
                            'rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all',
                            technology === tech
                              ? 'border-ai/50 bg-ai/10 text-ai ring-2 ring-ai/20'
                              : 'border-border/60 bg-card text-foreground hover:border-border hover:bg-accent/30',
                          )}
                        >
                          {tech}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2">
                      <button onClick={() => setStep(1)} className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        onClick={() => technology && setStep(3)}
                        disabled={!technology}
                        className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-30 transition-all"
                      >
                        Next <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Installation method ──────────────────────── */}
                {step === 3 && appType && (
                  <div className="space-y-4">
                    <div>
                      <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <h2 className="text-base font-semibold text-foreground">How would you like to install?</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {chosenType?.label} · <span className="font-medium">{technology}</span>
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {METHODS[appType].map((m) => {
                        const Icon = m.icon
                        const selected = method === m.id
                        return (
                          <button
                            key={m.id}
                            onClick={() => setMethod(m.id)}
                            className={cn(
                              'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                              selected
                                ? 'border-ai/50 bg-ai/10 ring-2 ring-ai/20'
                                : 'border-border/60 bg-card hover:bg-accent/30',
                            )}
                          >
                            <div className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                              selected ? 'border-ai/40 bg-ai/15 text-ai' : 'border-border/60 bg-muted/50 text-muted-foreground',
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-foreground">{m.label}</p>
                                {m.recommended && (
                                  <span className="rounded-full bg-healthy/15 px-1.5 py-0.5 text-[9px] font-bold text-healthy">Recommended</span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{m.desc}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex justify-between pt-2">
                      <button onClick={() => setStep(2)} className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        onClick={() => method && goStep4()}
                        disabled={!method}
                        className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-30 transition-all"
                      >
                        Generate instructions <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 4: Installation checklist ───────────────────── */}
                {step === 4 && (
                  <div className="space-y-4">
                    <div>
                      <button onClick={() => setStep(3)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <h2 className="text-base font-semibold text-foreground">Follow these steps to connect</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {chosenType?.label} · {technology} · {method?.toUpperCase()}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {checklist.map((item, idx) => {
                        const isDone = done[item.id] ?? false
                        const prevDone = idx === 0 || (done[checklist[idx - 1].id] ?? false)
                        const canCheck = prevDone || idx === 0

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              'rounded-xl border transition-all',
                              isDone ? 'border-healthy/30 bg-healthy/5 opacity-70' : 'border-border/60 bg-background/40',
                              !canCheck && 'opacity-40 pointer-events-none',
                            )}
                          >
                            <div className="flex items-start gap-3 p-4">
                              <button
                                onClick={() => canCheck && !item.isVerify && handleMarkDone(item.id)}
                                className="mt-0.5 shrink-0 focus:outline-none"
                              >
                                {isDone
                                  ? <CheckCircle2 className="h-5 w-5 text-healthy" />
                                  : <div className="h-5 w-5 rounded-full border-2 border-border/60" />
                                }
                              </button>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={cn('text-sm font-semibold', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                                    {idx + 1}. {item.label}
                                  </p>
                                  {!isDone && item.code && <CopyButton text={item.code} />}
                                </div>
                                <p className="text-[10px] text-muted-foreground">{item.detail}</p>

                                {item.code && !isDone && (
                                  <pre className="overflow-x-auto rounded-lg border border-border/50 bg-muted/50 p-3 font-mono text-[11px] text-foreground whitespace-pre-wrap">
                                    {item.code}
                                  </pre>
                                )}

                                {item.isKey && !isDone && (
                                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2">
                                    <code className="flex-1 font-mono text-[11px] text-foreground">
                                      {app.apiKey.slice(0, 20)}••••••••
                                    </code>
                                    <CopyButton text={app.apiKey} small />
                                  </div>
                                )}

                                {item.isVerify && !isDone && (
                                  <button
                                    onClick={() => {
                                      handleMarkDone(item.id)
                                    }}
                                    disabled={!canCheck}
                                    className="flex items-center gap-2 rounded-lg border border-ai/30 bg-ai/10 px-4 py-2 text-sm font-semibold text-ai hover:bg-ai/20 transition-colors disabled:opacity-40"
                                  >
                                    <Zap className="h-3.5 w-3.5" />
                                    Check Connection
                                  </button>
                                )}

                                {!item.isVerify && !item.isKey && !isDone && (
                                  <button
                                    onClick={() => canCheck && handleMarkDone(item.id)}
                                    className="text-[10px] font-medium text-ai hover:underline"
                                  >
                                    Mark as complete →
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Step 5: Live verification ─────────────────────────── */}
                {step === 5 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      {verified
                        ? <CheckCircle2 className="mx-auto h-12 w-12 text-healthy" />
                        : <Loader2 className="mx-auto h-12 w-12 text-ai animate-spin" />
                      }
                      <h2 className="text-base font-semibold text-foreground">
                        {verified ? 'Connected successfully!' : 'Verifying connection…'}
                      </h2>
                      {!verified && (
                        <p className="text-sm text-muted-foreground">This takes just a few seconds.</p>
                      )}
                    </div>

                    {/* Verification steps */}
                    <div className="rounded-xl border border-border/60 bg-background/30 p-4 space-y-1.5">
                      {VERIFY_STEPS.map((vs, i) => {
                        const done_ = verifyIdx > i || verified
                        const active = verifyIdx === i && !verified
                        return (
                          <div key={vs.label} className={cn('flex items-center gap-3 rounded-lg px-2 py-1.5 transition-all', active && 'bg-ai/8')}>
                            <div className="shrink-0">
                              {done_   && <CheckCircle2 className="h-4 w-4 text-healthy" />}
                              {active  && <Loader2 className="h-4 w-4 text-ai animate-spin" />}
                              {!done_ && !active && <div className="h-4 w-4 rounded-full border-2 border-border/40 opacity-40" />}
                            </div>
                            <div>
                              <p className={cn('text-xs font-medium', done_ ? 'text-muted-foreground' : active ? 'text-foreground' : 'text-muted-foreground/40')}>
                                {vs.label}
                              </p>
                              {active && (
                                <p className="text-[10px] text-muted-foreground/70">{vs.detail}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* AI Discovery panel — shows after verified */}
                    {verified && (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-ai/20 bg-ai/5 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-ai" />
                            <p className="text-sm font-semibold text-foreground">AI Discovery in progress</p>
                          </div>
                          <div className="space-y-1.5">
                            {DISCOVER_STEPS.map((ds, i) => {
                              const done_ = discoverIdx > i
                              const active = discoverIdx === i
                              return (
                                <div key={ds} className="flex items-center gap-2">
                                  <div className="shrink-0">
                                    {done_   && <CheckCircle2 className="h-3.5 w-3.5 text-healthy" />}
                                    {active  && <Loader2 className="h-3.5 w-3.5 text-ai animate-spin" />}
                                    {!done_ && !active && <div className="h-3.5 w-3.5 rounded-full border-2 border-border/30 opacity-30" />}
                                  </div>
                                  <p className={cn('text-xs', done_ ? 'text-muted-foreground' : active ? 'font-medium text-foreground' : 'text-muted-foreground/40')}>
                                    {ds}
                                  </p>
                                  {done_  && <ToneBadge tone="healthy">Completed</ToneBadge>}
                                  {active && <ToneBadge tone="ai">Running</ToneBadge>}
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <Clock className="h-3 w-3 text-muted-foreground/50" />
                            <p className="text-[10px] text-muted-foreground/50">Estimated completion: 3–5 minutes</p>
                          </div>
                        </div>

                        {/* Success footer */}
                        <div className="flex gap-3">
                          <Link
                            href="/dashboard"
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-ai px-5 py-3 text-sm font-semibold text-white hover:bg-ai/90 transition-colors shadow-lg shadow-ai/20"
                          >
                            <LayoutDashboard className="h-4 w-4" />
                            Go to Intelligence Dashboard
                          </Link>
                          <button
                            onClick={() => { setShowWizard(false); resetWizard() }}
                            className="rounded-xl border border-border/60 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Discovery — for already-connected apps */}
      {hasApps && !showWizard && (
        <div className="rounded-xl border border-ai/20 bg-ai/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ai" />
            <p className="text-sm font-semibold text-foreground">AI Discovery</p>
            <ToneBadge tone="ai">Active</ToneBadge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DISCOVER_STEPS.map((ds, i) => (
              <div key={ds} className="flex items-center gap-2 rounded-lg border border-ai/15 bg-background/40 px-3 py-2">
                {i < 2
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-healthy shrink-0" />
                  : i === 2
                  ? <Loader2 className="h-3.5 w-3.5 text-ai animate-spin shrink-0" />
                  : <div className="h-3.5 w-3.5 rounded-full border-2 border-border/30 opacity-30 shrink-0" />
                }
                <p className="text-[10px] font-medium text-muted-foreground">{ds}</p>
                {i < 2 && <span className="ml-auto text-[9px] font-bold text-healthy">Done</span>}
                {i === 2 && <span className="ml-auto text-[9px] font-bold text-ai">Running</span>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Agents are continuously learning — coverage improves over time
          </p>
        </div>
      )}
    </div>
  )
}
