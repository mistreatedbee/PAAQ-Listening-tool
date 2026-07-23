'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  Sparkles, Building2, Globe, Server, Smartphone, Boxes,
  Check, Copy, Loader2, ArrowRight, Key, AlertTriangle,
  Download, CheckCircle2, BarChart3, Activity, Flame, X,
} from 'lucide-react'
import {
  SiReact, SiNextdotjs, SiVuedotjs, SiAngular, SiJavascript,
  SiFlutter, SiApple, SiAndroid,
  SiNodedotjs, SiPython, SiGo, SiOpenjdk, SiDotnet,
} from 'react-icons/si'

// ─── Theme tokens (designer's light theme) ────────────────────────────────────

const C = {
  bg: '#f5f8fb',
  border: 'rgba(15,27,42,0.08)',
  borderStrong: 'rgba(15,27,42,0.15)',
  textPrimary: '#0f1b2a',
  textSecondary: '#4a5a6b',
  textMuted: '#7a8fa3',
  textPlaceholder: '#a0b0c0',
  teal: '#27a6ce',
  tealSoft: 'rgba(39,166,206,0.08)',
  green: '#16a34a',
  greenSoft: 'rgba(22,163,74,0.08)',
  yellow: '#ca8a04',
  red: '#dc2626',
  redSoft: 'rgba(220,38,38,0.08)',
}

const TEAL_GRADIENT = 'linear-gradient(135deg,#27a6ce,#51c9d3)'

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'welcome' | 'org' | 'product' | 'sdk' | 'done'

interface OrgData { company: string; industry: string; country: string; website: string; teamSize: string }
interface ProductData { projectName: string; productType: string; technology: string; environment: 'production' | 'staging' }
interface Credentials { projectId: string; sdkToken: string; publicKey: string; secretKey: string; webhookSecret: string }

// ─── Data ─────────────────────────────────────────────────────────────────────

type TechOption = { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string; platformId: string }

const TECH: Record<string, TechOption[]> = {
  website: [
    { Icon: SiReact,     color: '#61DAFB', label: 'React',      platformId: 'react' },
    { Icon: SiNextdotjs, color: '#111827', label: 'Next.js',    platformId: 'nextjs' },
    { Icon: SiVuedotjs,  color: '#42B883', label: 'Vue',        platformId: 'vue' },
    { Icon: SiAngular,   color: '#DD0031', label: 'Angular',    platformId: 'angular' },
    { Icon: SiJavascript,color: '#F7DF1E', label: 'Vanilla JS', platformId: 'vanilla' },
  ],
  mobile: [
    { Icon: SiFlutter,   color: '#02569B', label: 'Flutter',      platformId: 'flutter' },
    { Icon: SiReact,     color: '#61DAFB', label: 'React Native', platformId: 'reactnative' },
    { Icon: SiApple,     color: '#111827', label: 'iOS',          platformId: 'ios' },
    { Icon: SiAndroid,   color: '#3DDC84', label: 'Android',      platformId: 'android' },
  ],
  backend: [
    { Icon: SiNodedotjs, color: '#5FA04E', label: 'Node.js', platformId: 'nodejs' },
    { Icon: SiPython,    color: '#3776AB', label: 'Python',  platformId: 'python' },
    { Icon: SiGo,        color: '#00ADD8', label: 'Go',      platformId: 'go' },
    { Icon: SiOpenjdk,   color: '#ED8B00', label: 'Java',    platformId: 'java' },
    { Icon: SiDotnet,    color: '#512BD4', label: '.NET',    platformId: 'dotnet' },
  ],
  platform: [
    { Icon: SiReact,     color: '#61DAFB', label: 'React',   platformId: 'react' },
    { Icon: SiNextdotjs, color: '#111827', label: 'Next.js', platformId: 'nextjs' },
    { Icon: SiVuedotjs,  color: '#42B883', label: 'Vue',     platformId: 'vue' },
    { Icon: SiFlutter,   color: '#02569B', label: 'Flutter', platformId: 'flutter' },
    { Icon: SiNodedotjs, color: '#5FA04E', label: 'Node.js', platformId: 'nodejs' },
    { Icon: SiPython,    color: '#3776AB', label: 'Python',  platformId: 'python' },
    { Icon: SiGo,        color: '#00ADD8', label: 'Go',      platformId: 'go' },
  ],
}

const ALL_TECH = [...TECH.website, ...TECH.mobile, ...TECH.backend]

const PRODUCT_TYPES = [
  { id: 'website',  Icon: Globe,      label: 'Website',       desc: 'React, Next.js, Vue and more' },
  { id: 'mobile',   Icon: Smartphone, label: 'Mobile app',    desc: 'Flutter, native iOS or Android' },
  { id: 'backend',  Icon: Server,     label: 'Backend API',   desc: 'Node.js, Python, Go and more' },
  { id: 'platform', Icon: Boxes,      label: 'Full platform', desc: 'A connected web, mobile and API stack' },
]

const INDUSTRIES = ['SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'Media', 'Gaming', 'Education', 'FinTech', 'HealthTech', 'EdTech', 'Marketplace', 'Real Estate', 'Travel', 'Other']
const COUNTRIES  = ['United States', 'United Kingdom', 'South Africa', 'Canada', 'Australia', 'Germany', 'France', 'India', 'Nigeria', 'Kenya', 'Other']
const TEAM_SIZES = ['Just me', '2–10', '11–50', '51–200', '200+']

// ─── Install snippets ─────────────────────────────────────────────────────────

function installSnippet(platformId: string, sdkToken: string, projectId: string): { cmd: string; init: string } {
  const t = sdkToken || 'sdk_live_your_token_here'
  const p = projectId || 'proj_your_id'
  switch (platformId) {
    case 'react': return {
      cmd: 'npm install @paaq/web-sdk',
      init: `import { PAAQProvider } from '@paaq/web-sdk';\n\nexport default function App() {\n  return (\n    <PAAQProvider sdkToken="${t}" projectId="${p}">\n      <YourApp />\n    </PAAQProvider>\n  );\n}`,
    }
    case 'nextjs': return {
      cmd: 'npm install @paaq/web-sdk',
      init: `import { PAAQProvider } from '@paaq/web-sdk';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html><body>\n      <PAAQProvider sdkToken="${t}" projectId="${p}">\n        {children}\n      </PAAQProvider>\n    </body></html>\n  );\n}`,
    }
    case 'vue': return {
      cmd: 'npm install @paaq/web-sdk',
      init: `import { createApp } from 'vue';\nimport { PAAQPlugin } from '@paaq/web-sdk';\n\nconst app = createApp(App);\napp.use(PAAQPlugin, { sdkToken: '${t}', projectId: '${p}' });\napp.mount('#app');`,
    }
    case 'angular': return {
      cmd: 'npm install @paaq/web-sdk',
      init: `import { PAAQ } from '@paaq/web-sdk';\n\n// In main.ts\nPAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });`,
    }
    case 'vanilla': return {
      cmd: '# Add to your HTML <head>',
      init: `<script>\n  window.PAAQ_CONFIG = { sdkToken: '${t}', projectId: '${p}' };\n</script>\n<script src="https://cdn.paaq.ai/web-sdk.js" async></script>`,
    }
    case 'flutter': return {
      cmd: 'flutter pub add paaq_mobile_sdk',
      init: `import 'package:paaq_mobile_sdk/paaq_mobile_sdk.dart';\n\nvoid main() async {\n  WidgetsFlutterBinding.ensureInitialized();\n  await PAAQ.initialize(sdkToken: '${t}', projectId: '${p}');\n  runApp(const MyApp());\n}`,
    }
    case 'reactnative': return {
      cmd: 'npm install @paaq/mobile-sdk',
      init: `import { PAAQProvider } from '@paaq/mobile-sdk';\n\nexport default function App() {\n  return (\n    <PAAQProvider sdkToken="${t}" projectId="${p}">\n      <YourApp />\n    </PAAQProvider>\n  );\n}`,
    }
    case 'ios': return {
      cmd: '# Add via Swift Package Manager',
      init: `import PAAQSDK\n\n@main\nclass AppDelegate: UIResponder, UIApplicationDelegate {\n  func application(_ app: UIApplication,\n    didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {\n    PAAQ.initialize(sdkToken: "${t}", projectId: "${p}")\n    return true\n  }\n}`,
    }
    case 'android': return {
      cmd: "implementation 'io.paaq:android-sdk:1.0.0'",
      init: `import io.paaq.PAAQ\n\nclass MyApp : Application() {\n  override fun onCreate() {\n    super.onCreate()\n    PAAQ.initialize(this) {\n      sdkToken = "${t}"\n      projectId = "${p}"\n    }\n  }\n}`,
    }
    case 'nodejs': return {
      cmd: 'npm install @paaq/server-sdk',
      init: `import { PAAQ } from '@paaq/server-sdk';\n\nPAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });\n\napp.use(PAAQ.middleware());`,
    }
    case 'python': return {
      cmd: 'pip install paaq-server-sdk',
      init: `from paaq import PAAQ\n\nPAAQ.initialize(sdk_token='${t}', project_id='${p}')\n\n# Flask / FastAPI\napp.add_middleware(PAAQ.middleware)`,
    }
    case 'go': return {
      cmd: 'go get github.com/paaq/go-sdk',
      init: `import "github.com/paaq/go-sdk"\n\nfunc main() {\n    paaq.Initialize(paaq.Config{\n        SDKToken:  "${t}",\n        ProjectID: "${p}",\n    })\n    http.Handle("/", paaq.Middleware(yourHandler))\n    http.ListenAndServe(":8080", nil)\n}`,
    }
    case 'java': return {
      cmd: `// Add to pom.xml\n<dependency>\n  <groupId>ai.paaq</groupId>\n  <artifactId>paaq-java-sdk</artifactId>\n  <version>1.0.0</version>\n</dependency>`,
      init: `import ai.paaq.PAAQ;\n\n@SpringBootApplication\npublic class Application {\n  public static void main(String[] args) {\n    PAAQ.initialize(new PAAQConfig()\n      .sdkToken("${t}")\n      .projectId("${p}"));\n    SpringApplication.run(Application.class, args);\n  }\n}`,
    }
    case 'dotnet': return {
      cmd: 'dotnet add package PAAQ.ServerSDK',
      init: `using PAAQ;\n\n// In Program.cs\nbuilder.Services.AddPAAQ(options => {\n    options.SDKToken = "${t}";\n    options.ProjectId = "${p}";\n});\napp.UsePAAQ();`,
    }
    default: return { cmd: 'npm install @paaq/web-sdk', init: `PAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });` }
  }
}

// ─── Reusable UI components ───────────────────────────────────────────────────

function PrimaryButton({ onClick, disabled, loading, loadingLabel = 'Working…', children, className = '' }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; loadingLabel?: string; children: React.ReactNode; className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading}
      style={{ background: TEAL_GRADIENT }}
      className={`flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>
      {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{loadingLabel}</> : children}
    </button>
  )
}

function SecondaryButton({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ borderColor: C.borderStrong, color: C.textSecondary }}
      className="flex h-12 items-center justify-center gap-2 rounded-xl border bg-white px-5 text-sm font-semibold transition-colors hover:bg-slate-50">
      {children}
    </button>
  )
}

function FieldLabel({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <label className="mb-2 flex items-center gap-1 text-sm font-semibold" style={{ color: C.textPrimary }}>
      {children}
      {required && <span style={{ color: C.teal }}>*</span>}
      {optional && <span className="text-xs font-normal" style={{ color: C.textMuted }}>(optional)</span>}
    </label>
  )
}

function TextInput({ value, onChange, placeholder, onEnter, ariaLabel }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onEnter?: () => void; ariaLabel?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      value={value} aria-label={ariaLabel} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter() }}
      style={{
        borderColor: focused ? C.teal : C.border,
        boxShadow: focused ? `0 0 0 3px ${C.tealSoft}` : 'none',
      }}
      className="h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400"
    />
  )
}

function SelectDropdown({ value, onChange, options, placeholder, ariaLabel }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string; ariaLabel?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <select value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        borderColor: focused ? C.teal : C.border,
        boxShadow: focused ? `0 0 0 3px ${C.tealSoft}` : 'none',
        color: value ? C.textPrimary : C.textPlaceholder,
      }}
      className="h-12 w-full appearance-none rounded-xl border bg-white px-4 text-sm outline-none transition-all">
      <option value="" disabled>{placeholder}</option>
      {options.map((o) => <option key={o} value={o} style={{ color: C.textPrimary }}>{o}</option>)}
    </select>
  )
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={copy}
      style={{ borderColor: C.borderStrong, color: copied ? C.green : C.textSecondary }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-50">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function Rule() {
  return <hr className="border-0 border-t" style={{ borderColor: C.border }} />
}

function LabeledDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="h-px flex-1" style={{ background: C.border }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>{children}</span>
      <span className="h-px flex-1" style={{ background: C.border }} />
    </div>
  )
}

function StepFooter({ onBack, onNext, nextLabel, nextDisabled, loading, loadingLabel }: {
  onBack?: () => void; onNext: () => void; nextLabel: string; nextDisabled?: boolean; loading?: boolean; loadingLabel?: string
}) {
  return (
    <div className="flex gap-3">
      {onBack && (
        <SecondaryButton onClick={onBack}>
          <ArrowRight className="h-4 w-4 rotate-180" />
          Back
        </SecondaryButton>
      )}
      <PrimaryButton onClick={onNext} disabled={nextDisabled} loading={loading} loadingLabel={loadingLabel} className="flex-1">
        {nextLabel}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </PrimaryButton>
    </div>
  )
}

function StepShell({ icon, iconTone = 'teal', iconSize = 'md', title, subtitle, children }: {
  icon: React.ReactNode; iconTone?: 'teal' | 'green'; iconSize?: 'md' | 'lg'; title: string; subtitle: React.ReactNode; children: React.ReactNode
}) {
  const box = iconSize === 'lg' ? 'h-16 w-16' : 'h-14 w-14'
  const tone = iconTone === 'green'
    ? { background: C.greenSoft, color: C.green, border: `1px solid rgba(22,163,74,0.25)` }
    : { background: C.tealSoft, color: C.teal, border: `1px solid rgba(39,166,206,0.25)` }
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className={`mb-5 flex ${box} items-center justify-center rounded-2xl`} style={tone}>{icon}</div>
        <h1 className={`${iconSize === 'lg' ? 'text-3xl' : 'text-2xl'} font-black tracking-tight`} style={{ color: C.textPrimary }}>
          {title}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: C.textSecondary }}>{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const PROGRESS_STEPS = ['Org', 'Product', 'Keys', 'Done']

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="mx-auto mb-10 flex max-w-md items-start">
      {PROGRESS_STEPS.map((label, i) => {
        const stepNum = i + 1
        const isDone = stepNum < currentStep
        const isActive = stepNum === currentStep
        const isLast = i === PROGRESS_STEPS.length - 1
        return [
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
              style={isDone
                ? { background: C.green, color: '#fff' }
                : isActive
                  ? { background: TEAL_GRADIENT, color: '#fff', boxShadow: `0 0 0 4px ${C.tealSoft}` }
                  : { background: 'rgba(15,27,42,0.05)', color: C.textMuted }
              }>
              {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
            </div>
            <span className="hidden text-[9px] font-semibold uppercase tracking-wide sm:block sm:text-[10px]"
              style={{ color: isActive ? C.textPrimary : C.textMuted }}>
              {label}
            </span>
          </div>,
          !isLast && (
            <div key={`line-${label}`} className="mt-3.5 h-px flex-1"
              style={{ background: stepNum < currentStep ? C.green : C.border }} />
          ),
        ]
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [org, setOrg] = useState<OrgData>({ company: '', industry: '', country: '', website: '', teamSize: '' })
  const [product, setProduct] = useState<ProductData>({ projectName: '', productType: '', technology: '', environment: 'production' })
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  function genToken(prefix: string, len = 32): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return prefix + Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const createProject = async () => {
    if (!product.projectName.trim() || !product.technology) return
    setSubmitting(true)
    setError(null)
    try {
      const sb = createClient()
      const { data: { user }, error: userErr } = await sb.auth.getUser()
      if (userErr || !user) { router.push('/login?next=/onboarding'); return }

      const { data: existing } = await sb
        .from('tenant_users').select('tenant_id').eq('auth_user_id', user.id).limit(1).maybeSingle()

      let tenantId: string

      if (existing?.tenant_id) {
        tenantId = existing.tenant_id
      } else {
        const slug = org.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
          + '-' + Math.random().toString(36).slice(2, 6)

        const { data: tenant, error: tenantErr } = await sb.from('tenants').insert({
          company_name: org.company.trim(),
          slug,
          website: org.website?.trim() || null,
          industry: org.industry?.trim() || null,
          status: 'trial',
          subscription_plan: 'starter',
        }).select().single()
        if (tenantErr || !tenant) throw new Error(tenantErr?.message ?? 'Failed to create organisation')
        tenantId = tenant.id

        const { error: memberErr } = await sb.from('tenant_users').insert({
          tenant_id: tenantId,
          auth_user_id: user.id,
          email: user.email,
          role: 'admin',
        })
        if (memberErr) throw new Error('Failed to add member: ' + memberErr.message)
      }

      // Auto-create workspace silently
      const wsName = `${org.company.trim() || 'My'} Workspace`
      const { data: ws, error: wsErr } = await sb.from('workspaces').insert({
        tenant_id: tenantId, name: wsName, status: 'active',
      }).select().single()
      if (wsErr || !ws) throw new Error(wsErr?.message ?? 'Failed to create workspace')

      const techOption = ALL_TECH.find((t) => t.label === product.technology)
      const platformId = techOption?.platformId ?? 'other'
      const projectKey = 'proj_' + Math.random().toString(36).slice(2, 10)

      const { data: proj, error: projErr } = await sb.from('tenant_projects').insert({
        tenant_id: tenantId, workspace_id: ws.id,
        name: product.projectName.trim(), platform: platformId,
        environment: product.environment, project_id_key: projectKey, status: 'active',
      }).select().single()
      if (projErr || !proj) throw new Error(projErr?.message ?? 'Failed to create project')

      const tokenRows = [
        { token_type: 'sdk_token',      prefix: 'sdk_live_' },
        { token_type: 'public_key',     prefix: 'pk_live_' },
        { token_type: 'secret_key',     prefix: 'sk_live_' },
        { token_type: 'webhook_secret', prefix: 'whsec_' },
      ].map(({ token_type, prefix }) => {
        const t = genToken(prefix)
        return { tenant_id: tenantId, project_id: proj.id, token_type, token: t, token_hint: t.slice(-4), status: 'active' }
      })
      await sb.from('access_tokens').insert(tokenRows)

      setCredentials({
        projectId:     proj.project_id_key,
        sdkToken:      tokenRows[0].token,
        publicKey:     tokenRows[1].token,
        secretKey:     tokenRows[2].token,
        webhookSecret: tokenRows[3].token,
      })
      setScreen('sdk')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const stepNumber = screen === 'org' ? 1 : screen === 'product' ? 2 : screen === 'sdk' ? 3 : screen === 'done' ? 4 : null

  const screenLabel: Record<Screen, string> = {
    welcome: '', org: 'Organisation', product: 'Connect Product', sdk: 'SDK Setup', done: 'Done',
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.textPrimary }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 h-14 w-full border-b backdrop-blur-md"
        style={{ background: 'rgba(255,255,255,0.85)', borderColor: C.border }}>
        <div className="mx-auto flex h-full max-w-2xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ background: TEAL_GRADIENT }}>
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold" style={{ color: C.textPrimary }}>PAAQ Intelligence</span>
          </div>
          {screen !== 'welcome' && (
            <span className="text-xs font-medium" style={{ color: C.textMuted }}>
              Setup · {screenLabel[screen]}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {stepNumber !== null && <ProgressBar currentStep={stepNumber} />}

        {/* ── Welcome ────────────────────────────────────────────────────── */}
        {screen === 'welcome' && (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: C.tealSoft, color: C.teal, border: `1px solid rgba(39,166,206,0.25)` }}>
                <Sparkles className="h-8 w-8" />
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: C.textPrimary }}>
                Welcome to PAAQ Intelligence
              </h1>
              <p className="mt-3 max-w-md text-base leading-relaxed" style={{ color: C.textSecondary }}>
                AI that listens to your digital product and tells you what's happening — and why.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { n: '01', title: 'Set up your org',                  body: 'Add your company details to create your PAAQ account.' },
                { n: '02', title: 'Connect your digital product',      body: 'Pick your stack and grab the right SDK in seconds.' },
                { n: '03', title: 'Start getting AI insights in minutes', body: 'Agents begin analysing your product right away.' },
              ].map((b) => (
                <div key={b.n} className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.teal }}>{b.n}</div>
                  <div className="mt-2 text-sm font-bold" style={{ color: C.textPrimary }}>{b.title}</div>
                  <p className="mt-1.5 text-xs leading-relaxed" style={{ color: C.textMuted }}>{b.body}</p>
                </div>
              ))}
            </div>

            <PrimaryButton onClick={() => setScreen('org')} className="w-full">
              Get started <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
            <p className="text-center text-xs" style={{ color: C.textMuted }}>
              Takes about 3 minutes · No credit card needed
            </p>
          </div>
        )}

        {/* ── Organisation ───────────────────────────────────────────────── */}
        {screen === 'org' && (
          <StepShell
            icon={<Building2 className="h-6 w-6" />}
            title="Tell us about your organisation"
            subtitle="This sets up your PAAQ account. You can update it later.">
            <Rule />
            <div>
              <FieldLabel required>Organisation / Company name</FieldLabel>
              <TextInput
                value={org.company} onChange={(v) => setOrg({ ...org, company: v })}
                placeholder="Acme Corp" ariaLabel="Company name"
                onEnter={() => org.company.trim() && setScreen('product')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Industry</FieldLabel>
                <SelectDropdown value={org.industry} onChange={(v) => setOrg({ ...org, industry: v })} options={INDUSTRIES} placeholder="Select industry…" ariaLabel="Industry" />
              </div>
              <div>
                <FieldLabel>Country</FieldLabel>
                <SelectDropdown value={org.country} onChange={(v) => setOrg({ ...org, country: v })} options={COUNTRIES} placeholder="Select country…" ariaLabel="Country" />
              </div>
            </div>
            <div>
              <FieldLabel optional>Website</FieldLabel>
              <TextInput value={org.website} onChange={(v) => setOrg({ ...org, website: v })} placeholder="https://acme.com" ariaLabel="Website" />
            </div>
            <div>
              <FieldLabel optional>Team size</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {TEAM_SIZES.map((size) => {
                  const active = org.teamSize === size
                  return (
                    <button key={size} type="button" onClick={() => setOrg({ ...org, teamSize: active ? '' : size })}
                      style={{ borderColor: active ? C.teal : C.border, background: active ? C.tealSoft : '#fff', color: active ? C.textPrimary : C.textMuted }}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors">
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>
            <Rule />
            <StepFooter onBack={() => setScreen('welcome')} onNext={() => setScreen('product')} nextLabel="Continue" nextDisabled={!org.company.trim()} />
          </StepShell>
        )}

        {/* ── Connect Product ─────────────────────────────────────────────── */}
        {screen === 'product' && (
          <StepShell
            icon={<Globe className="h-6 w-6" />}
            title="Connect your digital product"
            subtitle="Tell us what you're connecting — we'll give you the right SDK.">
            <Rule />
            <div>
              <FieldLabel required>Project name</FieldLabel>
              <TextInput value={product.projectName} onChange={(v) => setProduct({ ...product, projectName: v })} placeholder="My Digital Product" ariaLabel="Project name" />
            </div>

            <div>
              <FieldLabel required>What are you connecting?</FieldLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PRODUCT_TYPES.map((pt) => {
                  const active = product.productType === pt.id
                  const Icon = pt.Icon
                  return (
                    <button key={pt.id} type="button"
                      onClick={() => setProduct({ ...product, productType: pt.id, technology: '' })}
                      aria-pressed={active}
                      style={{
                        borderColor: active ? C.teal : C.border,
                        background: active ? 'rgba(39,166,206,0.055)' : '#fff',
                        boxShadow: active ? '0 8px 20px rgba(39,166,206,0.10)' : '0 1px 2px rgba(15,27,42,0.02)',
                      }}
                      className="group relative flex min-h-[108px] items-start gap-4 overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all hover:border-slate-300 hover:shadow-md">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors"
                        style={{ background: active ? '#e4f8fb' : '#f4f7fa', color: active ? C.teal : C.textSecondary }}>
                        <Icon className="h-5 w-5" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 pr-5">
                        <span className="block text-sm font-bold" style={{ color: C.textPrimary }}>{pt.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed" style={{ color: C.textMuted }}>{pt.desc}</span>
                      </span>
                      {active && (
                        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: C.teal }}>
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {product.productType && (
              <div>
                <div className="mb-2 flex items-end justify-between gap-4">
                  <FieldLabel required>Choose your primary technology</FieldLabel>
                  <span className="mb-2 hidden text-xs sm:block" style={{ color: C.textMuted }}>You can add more later</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(TECH[product.productType] ?? []).map((tech) => {
                    const active = product.technology === tech.label
                    const Icon = tech.Icon
                    return (
                      <button key={tech.label} type="button"
                        onClick={() => setProduct({ ...product, technology: tech.label })}
                        aria-pressed={active}
                        style={{
                          borderColor: active ? C.teal : C.border,
                          background: active ? 'rgba(39,166,206,0.055)' : '#fff',
                          boxShadow: active ? '0 8px 18px rgba(39,166,206,0.10)' : '0 1px 2px rgba(15,27,42,0.02)',
                        }}
                        className="group relative flex min-h-[112px] flex-col items-center justify-center rounded-2xl border p-4 transition-all hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100">
                        <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 transition-colors group-hover:bg-slate-100">
                          <Icon className="h-6 w-6" style={{ color: tech.color }} />
                        </span>
                        <span className="text-xs font-semibold" style={{ color: active ? C.textPrimary : C.textSecondary }}>
                          {tech.label}
                        </span>
                        {active && (
                          <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: C.teal }}>
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <FieldLabel>Environment</FieldLabel>
              <div className="flex gap-3">
                {(['production', 'staging'] as const).map((env) => {
                  const active = product.environment === env
                  return (
                    <button key={env} type="button" onClick={() => setProduct({ ...product, environment: env })}
                      style={{ borderColor: active ? C.teal : C.border, background: active ? C.tealSoft : '#fff', color: active ? C.textPrimary : C.textMuted }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold capitalize transition-all">
                      <span className="h-2 w-2 rounded-full" style={{ background: env === 'production' ? C.green : C.yellow }} />
                      {env}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm" role="alert"
                style={{ background: C.redSoft, borderColor: 'rgba(220,38,38,0.3)', color: C.red }}>
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Rule />
            <StepFooter
              onBack={() => setScreen('org')}
              onNext={createProject}
              nextLabel="Create project"
              nextDisabled={!product.projectName.trim() || !product.productType || !product.technology}
              loading={submitting}
              loadingLabel="Creating…"
            />
          </StepShell>
        )}

        {/* ── SDK Setup (credentials + install guide) ─────────────────────── */}
        {screen === 'sdk' && credentials && (
          <SdkSetupScreen product={product} credentials={credentials} onBack={() => setScreen('product')} onNext={() => setScreen('done')} />
        )}

        {/* ── Done ────────────────────────────────────────────────────────── */}
        {screen === 'done' && (
          <StepShell
            icon={<CheckCircle2 className="h-8 w-8" />}
            iconTone="green" iconSize="lg"
            title="You're all set!"
            subtitle={
              <>
                <strong style={{ color: C.textPrimary }}>{product.projectName || 'Your project'}</strong>{' '}
                is connected to PAAQ Intelligence. AI agents are already getting to work.
              </>
            }>
            <Rule />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { Icon: BarChart3, title: 'Dashboard',   desc: 'Overview of your product health & KPIs' },
                { Icon: Activity,  title: 'Live Events', desc: 'Real-time stream of events and sessions' },
                { Icon: Sparkles,  title: 'AI Insights', desc: 'AI-generated patterns and recommendations' },
                { Icon: Flame,     title: 'Incidents',   desc: 'Auto-detected issues and root causes' },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: C.tealSoft, color: C.teal }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold" style={{ color: C.textPrimary }}>{title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: C.textMuted }}>{desc}</span>
                  </span>
                </div>
              ))}
            </div>
            <Rule />
            <PrimaryButton onClick={() => { router.push('/dashboard'); router.refresh() }} className="w-full">
              <CheckCircle2 className="h-4 w-4" /> Open my dashboard
            </PrimaryButton>
            <p className="text-center text-xs" style={{ color: C.textMuted }}>
              Your credentials and install guide are always available in Settings → SDK Setup.
            </p>
          </StepShell>
        )}
      </div>
    </div>
  )
}

// ─── SDK Setup screen ─────────────────────────────────────────────────────────

function SdkSetupScreen({ product, credentials, onBack, onNext }: {
  product: ProductData; credentials: Credentials; onBack: () => void; onNext: () => void
}) {
  const techOption = ALL_TECH.find((t) => t.label === product.technology)
  const { cmd, init } = installSnippet(techOption?.platformId ?? 'other', credentials.sdkToken, credentials.projectId)

  const rows = [
    { label: 'Project ID',      value: credentials.projectId,     hint: 'Use in SDK initialization',          secret: false },
    { label: 'SDK Token',       value: credentials.sdkToken,      hint: 'Safe to bundle in your app',         secret: false },
    { label: 'Public Key',      value: credentials.publicKey,     hint: 'Safe for client-side reads',         secret: false },
    { label: 'Secret Key',      value: credentials.secretKey,     hint: 'Server-side only — never expose',    secret: true },
    { label: 'Webhook Secret',  value: credentials.webhookSecret, hint: 'Verify incoming webhooks',           secret: true },
  ]

  const copyAll = rows.map((r) => `${r.label}: ${r.value}`).join('\n')

  const downloadTxt = () => {
    const content = rows.map((r) => `${r.label}: ${r.value}`).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${product.projectName || 'paaq'}-credentials.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <StepShell
      icon={<Key className="h-6 w-6" />}
      iconTone="green"
      title="Your credentials are ready"
      subtitle={
        <>
          Save these now — Secret Key and Webhook Secret are shown{' '}
          <strong style={{ color: C.textPrimary }}>once only</strong>.
        </>
      }>

      {/* Credential table */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: C.border }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: 'rgba(15,27,42,0.02)', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div className="text-sm font-bold" style={{ color: C.textPrimary }}>{product.projectName || 'Untitled project'}</div>
            <div className="text-xs capitalize" style={{ color: C.textMuted }}>{product.technology} · {product.environment}</div>
          </div>
          <CopyButton text={copyAll} label="Copy all" />
        </div>
        {rows.map((r, i) => (
          <div key={r.label} className="flex items-start gap-3 px-4 py-3"
            style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: C.textPrimary }}>{r.label}</span>
                {r.secret && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{ background: 'rgba(202,138,4,0.12)', color: C.yellow }}>
                    Server only
                  </span>
                )}
              </div>
              <div className="mt-1 break-all font-mono text-xs" style={{ color: C.textSecondary }}>{r.value}</div>
              <div className="mt-0.5 text-[10px]" style={{ color: C.textMuted }}>{r.hint}</div>
            </div>
            <CopyButton text={r.value} />
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-relaxed"
        style={{ background: 'rgba(202,138,4,0.06)', borderColor: 'rgba(202,138,4,0.25)', color: C.yellow }}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Store Secret Key and Webhook Secret in environment variables. They cannot be recovered if lost — only rotated.</span>
      </div>

      <LabeledDivider>Install the SDK</LabeledDivider>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>1. Install package</span>
          <CopyButton text={cmd} />
        </div>
        <div className="overflow-x-auto rounded-xl border p-4 font-mono text-xs"
          style={{ borderColor: C.border, background: '#f8fafc', color: C.teal }}>
          {cmd}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>2. Initialise with your credentials</span>
          <CopyButton text={init} label="Copy code" />
        </div>
        <pre className="overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed"
          style={{ background: '#0d1117', color: '#86efac' }}>
          {init}
        </pre>
      </div>

      <Rule />

      <div className="flex gap-3">
        <SecondaryButton onClick={downloadTxt}>
          <Download className="h-4 w-4" /> Download .txt
        </SecondaryButton>
        <PrimaryButton onClick={onNext} className="flex-1">
          I've added the SDK <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </div>

      <div className="flex justify-center">
        <button type="button" onClick={onBack}
          className="text-xs underline-offset-2 hover:underline"
          style={{ color: C.textMuted }}>
          Back to product setup
        </button>
      </div>
    </StepShell>
  )
}
