'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  Building2, Smartphone, Key, Code2, CheckCircle2,
  ArrowRight, ArrowLeft, Copy, Check, Loader2, Sparkles,
  Globe, Layers, Wifi,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 0 | 1 | 2 | 3

type GeneratedCredentials = {
  sdkToken: string
  publicKey: string
  secretKey: string
  webhookSecret: string
}

type ProjectResult = {
  id: string
  name: string
  platform: string
  environment: string
  project_id_key: string
}

// ─── Platform config ─────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'flutter',   label: 'Flutter',      icon: '🦋', color: '#54C5F8' },
  { id: 'react',     label: 'React',        icon: '⚛️', color: '#61DAFB' },
  { id: 'nextjs',    label: 'Next.js',      icon: '▲',  color: '#000' },
  { id: 'ios',       label: 'iOS Swift',    icon: '🍎', color: '#007AFF' },
  { id: 'android',   label: 'Android',      icon: '🤖', color: '#3DDC84' },
  { id: 'nodejs',    label: 'Node.js',      icon: '🟢', color: '#68A063' },
] as const

const INDUSTRIES = [
  'FinTech', 'HealthTech', 'EdTech', 'E-Commerce', 'SaaS',
  'Marketplace', 'Real Estate', 'Travel', 'Media', 'Other',
]

// ─── Code snippets per platform ──────────────────────────────────────────────
function codeSnippet(platform: string, sdkToken: string, projectId: string): string {
  const token = sdkToken || 'sdk_live_your_token_here'
  const proj = projectId || 'proj_your_project_id'

  switch (platform) {
    case 'flutter':
      return `// pubspec.yaml
dependencies:
  paaq_sdk: ^1.0.0

// main.dart
import 'package:paaq_sdk/paaq_sdk.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PAAQ.initialize(
    sdkToken: '${token}',
    projectId: '${proj}',
  );
  runApp(const MyApp());
}`

    case 'react':
      return `// npm install @paaq/react

// App.tsx
import { PAAQProvider } from '@paaq/react';

export default function App() {
  return (
    <PAAQProvider
      sdkToken="${token}"
      projectId="${proj}"
    >
      <YourApp />
    </PAAQProvider>
  );
}`

    case 'nextjs':
      return `// npm install @paaq/next

// app/layout.tsx
import { PAAQProvider } from '@paaq/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PAAQProvider
          sdkToken="${token}"
          projectId="${proj}"
        >
          {children}
        </PAAQProvider>
      </body>
    </html>
  );
}`

    case 'ios':
      return `// Swift Package Manager — add paaq-ios-sdk
// AppDelegate.swift
import PAAQSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication,
    didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    PAAQ.initialize(
      sdkToken: "${token}",
      projectId: "${proj}"
    )
    return true
  }
}`

    case 'android':
      return `// build.gradle
implementation 'io.paaq:android-sdk:1.0.0'

// Application.kt
import io.paaq.PAAQ

class MyApp : Application() {
  override fun onCreate() {
    super.onCreate()
    PAAQ.initialize(this) {
      sdkToken = "${token}"
      projectId = "${proj}"
    }
  }
}`

    case 'nodejs':
      return `// npm install @paaq/node

// index.ts
import { PAAQ } from '@paaq/node';

PAAQ.initialize({
  sdkToken: '${token}',
  projectId: '${proj}',
});

// Wrap your express app or any async context
app.use(PAAQ.middleware());`

    default:
      return `PAAQ.initialize({
  sdkToken: '${token}',
  projectId: '${proj}',
});`
  }
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1.5 rounded-lg border bg-muted px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-healthy" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? (copied ? 'Copied!' : 'Copy')}
    </button>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEP_LABELS = ['Your Workspace', 'Your App', 'Your Credentials', 'Install & Go']

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i < current
                ? 'bg-healthy text-white'
                : i === current
                ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                : 'bg-muted text-muted-foreground'
            }`}>
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-[10px] font-semibold sm:block ${i === current ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`mx-2 mb-5 h-px w-12 sm:w-20 transition-colors ${i < current ? 'bg-healthy' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 0 — workspace
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')

  // Step 1 — project
  const [projectName, setProjectName] = useState('')
  const [platform, setPlatform] = useState<string>('')
  const [environment, setEnvironment] = useState<'production' | 'staging'>('production')

  // Step 2 — credentials (returned from edge fn)
  const [creds, setCreds] = useState<GeneratedCredentials | null>(null)
  const [project, setProject] = useState<ProjectResult | null>(null)

  // Step 0 → 1
  const goToProject = () => {
    if (!companyName.trim()) return
    setStep(1)
  }

  // Step 1 → create → Step 2
  const createWorkspace = async () => {
    if (!projectName.trim() || !platform) return
    setSubmitting(true)
    setError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) throw new Error('Not authenticated — please sign in again.')

      const res = await sb.functions.invoke('client-onboard', {
        body: { companyName, website, industry, projectName, platform, environment },
      })

      if (res.error) {
        const msg = typeof res.error === 'object' && 'message' in res.error
          ? String(res.error.message)
          : JSON.stringify(res.error)
        throw new Error(msg)
      }
      if (!res.data) throw new Error('No response from server — please try again.')

      const { project: proj, tokens } = res.data as { project: ProjectResult; tokens: GeneratedCredentials; tenantId: string }
      if (!proj || !tokens) throw new Error('Incomplete response from server.')
      setProject(proj)
      setCreds(tokens)
      setStep(2)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Request timed out after 30 seconds. Please try again.')
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      }
    } finally {
      clearTimeout(timeout)
      setSubmitting(false)
    }
  }

  // Step 3 → dashboard
  const finishOnboarding = () => {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-black">PAAQ Intelligence</span>
          </div>
          <span className="text-xs text-muted-foreground">Setup · {STEP_LABELS[step]}</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10 space-y-10">
        {/* Step indicator */}
        <StepBar current={step} />

        {/* ── Step 0: Workspace ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-black">Tell us about your company</h1>
              <p className="text-muted-foreground">This creates your workspace. You can always update it in settings.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Company name <span className="text-destructive">*</span></label>
                <input
                  autoFocus
                  className="w-full rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && goToProject()}
                  placeholder="Acme Corp"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Industry</label>
                  <select
                    className="w-full rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  >
                    <option value="">Select industry…</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="w-full rounded-xl border bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://acme.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={goToProject}
              disabled={!companyName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Step 1: App ───────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Smartphone className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-black">Connect your first app</h1>
              <p className="text-muted-foreground">PAAQ will monitor this app and build its knowledge graph.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5">App name <span className="text-destructive">*</span></label>
                <input
                  autoFocus
                  className="w-full rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Mobile App"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Platform <span className="text-destructive">*</span></label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all hover:scale-[1.02] ${
                        platform === p.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-border/80'
                      }`}
                    >
                      <span className="text-2xl">{p.icon}</span>
                      <span className="text-xs font-semibold">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Environment</label>
                <div className="flex gap-3">
                  {(['production', 'staging'] as const).map((env) => (
                    <button
                      key={env}
                      onClick={() => setEnvironment(env)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold capitalize transition-all ${
                        environment === env
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border/80'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${env === 'production' ? 'bg-healthy' : 'bg-warning'}`} />
                      {env}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-muted transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={createWorkspace}
                disabled={submitting || !projectName.trim() || !platform}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating your workspace…</>
                ) : (
                  <>Create workspace <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Credentials ───────────────────────────────────────────── */}
        {step === 2 && creds && project && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-healthy/10">
                <Key className="h-7 w-7 text-healthy" />
              </div>
              <h1 className="text-2xl font-black">Your credentials are ready</h1>
              <p className="text-muted-foreground">
                Save these now — the secret key and webhook secret are shown <strong>once only</strong>.
              </p>
            </div>

            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project: {project.name}</p>
              </div>

              {[
                { label: 'Project ID',      value: project.project_id_key, hint: 'Use this to identify your project' },
                { label: 'SDK Token',        value: creds.sdkToken,         hint: 'Used in your SDK initialization — safe to bundle in the app' },
                { label: 'Public Key',       value: creds.publicKey,         hint: 'Safe to expose client-side for read operations' },
                { label: 'Secret Key',       value: creds.secretKey,         hint: 'Server-side only — never expose in your app' },
                { label: 'Webhook Secret',   value: creds.webhookSecret,     hint: 'Used to verify incoming webhook signatures' },
              ].map(({ label, value, hint }, i) => (
                <div key={i} className="flex items-start gap-3 border-b px-4 py-3 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-bold">{label}</p>
                      {(label === 'Secret Key' || label === 'Webhook Secret') && (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-warning">Server only</span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground break-all">{value}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">{hint}</p>
                  </div>
                  <CopyBtn value={value} />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              <strong>Important:</strong> Store your Secret Key and Webhook Secret in a secure location (e.g. environment variables). They cannot be retrieved again.
            </div>

            <button
              onClick={() => setStep(3)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              I've saved my credentials <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Step 3: Install ───────────────────────────────────────────────── */}
        {step === 3 && creds && project && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ai/10">
                <Code2 className="h-7 w-7 text-ai" />
              </div>
              <h1 className="text-2xl font-black">Install the SDK</h1>
              <p className="text-muted-foreground">
                Add this to your <strong>{PLATFORMS.find((p) => p.id === project.platform)?.label ?? project.platform}</strong> app to start sending telemetry.
              </p>
            </div>

            {/* Code block */}
            <div className="relative rounded-2xl border bg-[#0d1117] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{PLATFORMS.find((p) => p.id === project.platform)?.icon ?? '📦'}</span>
                  <span className="text-xs font-semibold text-white/60">
                    {PLATFORMS.find((p) => p.id === project.platform)?.label ?? project.platform} · SDK Init
                  </span>
                </div>
                <CopyBtn value={codeSnippet(project.platform, creds.sdkToken, project.project_id_key)} label="Copy code" />
              </div>
              <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-green-300/90 font-mono">
                {codeSnippet(project.platform, creds.sdkToken, project.project_id_key)}
              </pre>
            </div>

            {/* What happens next */}
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-sm font-bold">What happens after install</p>
              {[
                { icon: <Wifi className="h-4 w-4 text-primary" />,   text: 'SDK connects to PAAQ on first app launch' },
                { icon: <Layers className="h-4 w-4 text-ai" />,      text: 'Events, errors, and sessions start flowing in' },
                { icon: <Sparkles className="h-4 w-4 text-warning" />,text: 'AI analyses your telemetry within minutes' },
                { icon: <CheckCircle2 className="h-4 w-4 text-healthy" />, text: 'Dashboard shows live data — ready to monitor' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {item.icon}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-muted transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={finishOnboarding}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <CheckCircle2 className="h-4 w-4" /> Open my dashboard
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              You can always come back to the install guide in Settings → SDK Setup
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
