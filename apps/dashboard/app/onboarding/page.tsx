'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  Sparkles, Building2, Layers, Smartphone, Key, Code2, Wifi,
  CheckCircle2, ArrowRight, ArrowLeft, Copy, Check, Loader2,
  Globe, Download, AlertTriangle, RefreshCw, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

type Creds = { sdkToken: string; publicKey: string; secretKey: string; webhookSecret: string }
type Project = { id: string; name: string; platform: string; environment: string; project_id_key: string }
type Workspace = { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  'Welcome', 'Organization', 'Workspace', 'Project',
  'Credentials', 'Install SDK', 'Verify', 'Done',
]

const PLATFORMS = [
  { id: 'flutter',   label: 'Flutter',    icon: '🦋', color: '#54C5F8' },
  { id: 'react',     label: 'React',      icon: '⚛️', color: '#61DAFB' },
  { id: 'nextjs',    label: 'Next.js',    icon: '▲',  color: '#e8f0f8' },
  { id: 'ios',       label: 'iOS Swift',  icon: '🍎', color: '#007AFF' },
  { id: 'android',   label: 'Android',    icon: '🤖', color: '#3DDC84' },
  { id: 'nodejs',    label: 'Node.js',    icon: '🟢', color: '#68A063' },
] as const

const INDUSTRIES = [
  'FinTech', 'HealthTech', 'EdTech', 'E-Commerce', 'SaaS',
  'Marketplace', 'Real Estate', 'Travel', 'Media', 'Other',
]

const TEAM_SIZES = ['Just me', '2–10', '11–50', '51–200', '201–1000', '1000+']

const COUNTRIES = [
  'United States', 'United Kingdom', 'South Africa', 'Canada', 'Australia',
  'Germany', 'France', 'India', 'Nigeria', 'Kenya', 'Other',
]

function installSnippet(platform: string, sdkToken: string, projectId: string): { cmd: string; init: string } {
  const t = sdkToken || 'sdk_live_your_token_here'
  const p = projectId || 'proj_your_id'

  switch (platform) {
    case 'flutter': return {
      cmd: 'flutter pub add paaq_listening_sdk',
      init: `import 'package:paaq_listening_sdk/paaq_listening_sdk.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PAAQ.initialize(
    sdkToken: '${t}',
    projectId: '${p}',
  );
  runApp(const MyApp());
}`,
    }
    case 'react': return {
      cmd: 'npm install @paaq/listening',
      init: `import { PAAQProvider } from '@paaq/listening';

export default function App() {
  return (
    <PAAQProvider sdkToken="${t}" projectId="${p}">
      <YourApp />
    </PAAQProvider>
  );
}`,
    }
    case 'nextjs': return {
      cmd: 'npm install @paaq/listening',
      init: `import { PAAQProvider } from '@paaq/listening';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PAAQProvider sdkToken="${t}" projectId="${p}">
          {children}
        </PAAQProvider>
      </body>
    </html>
  );
}`,
    }
    case 'ios': return {
      cmd: '# Add paaq-ios-sdk via Swift Package Manager',
      init: `import PAAQSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ app: UIApplication,
    didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    PAAQ.initialize(sdkToken: "${t}", projectId: "${p}")
    return true
  }
}`,
    }
    case 'android': return {
      cmd: "implementation 'io.paaq:android-sdk:1.0.0'",
      init: `import io.paaq.PAAQ

class MyApp : Application() {
  override fun onCreate() {
    super.onCreate()
    PAAQ.initialize(this) {
      sdkToken = "${t}"
      projectId = "${p}"
    }
  }
}`,
    }
    case 'nodejs': return {
      cmd: 'npm install @paaq/server-sdk',
      init: `import { PAAQ } from '@paaq/server-sdk';

PAAQ.initialize({
  sdkToken: '${t}',
  projectId: '${p}',
});

// Wrap your Express app
app.use(PAAQ.middleware());`,
    }
    default: return { cmd: 'npm install @paaq/sdk', init: `PAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });` }
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
      style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#8ba0b4' }}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? (copied ? 'Copied!' : 'Copy')}
    </button>
  )
}

function ProgressBar({ current }: { current: Step }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                i < current ? 'bg-green-500 text-white' : i === current ? 'text-white ring-4 ring-primary/20' : 'text-gray-500'
              }`} style={i === current ? { background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' } : i < current ? {} : { background: 'rgba(255,255,255,0.06)' }}>
                {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="text-[9px] font-semibold hidden sm:block whitespace-nowrap" style={{ color: i === current ? '#e8f0f8' : '#4a5568' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-1.5 mb-3.5 h-px w-8 sm:w-12 transition-colors" style={{ background: i < current ? '#22c55e' : 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-6 ${className}`} style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      {children}
    </div>
  )
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8ba0b4' }}>
      {children} {required && <span className="text-red-400">*</span>}
    </label>
  )
}

function Input({ value, onChange, placeholder, onKeyDown }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown}
      className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none transition-colors"
      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#e8f0f8' }}
      onFocus={(e) => (e.target.style.borderColor = 'rgba(81,201,211,0.5)')}
      onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
  )
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none"
      style={{ background: 'rgba(10,16,24,0.9)', borderColor: 'rgba(255,255,255,0.1)', color: value ? '#e8f0f8' : '#4a5568' }}>
      {children}
    </select>
  )
}

function PrimaryBtn({ onClick, disabled, loading: isLoading, children }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} disabled={disabled || isLoading}
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
      style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' }}>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/5"
      style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#8ba0b4' }}>
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 — org
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')

  // Step 2 — workspace
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceDesc, setWorkspaceDesc] = useState('')

  // Step 3 — project
  const [projectName, setProjectName] = useState('')
  const [platform, setPlatform] = useState('')
  const [environment, setEnvironment] = useState<'production' | 'staging'>('production')

  // Step 4+ — results
  const [creds, setCreds] = useState<Creds | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)

  // Step 6 — verification
  const [verifyStatus, setVerifyStatus] = useState<'waiting' | 'connected' | 'skipped'>('waiting')

  function genToken(prefix: string, len = 32): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return prefix + Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const createWorkspace = async () => {
    if (!projectName.trim() || !platform) return
    setSubmitting(true)
    setError(null)

    try {
      const sb = createClient()
      const { data: { user }, error: userErr } = await sb.auth.getUser()
      if (userErr || !user) { router.push('/login?next=/onboarding'); return }

      // Check if user already belongs to a tenant
      const { data: existing } = await sb
        .from('tenant_users')
        .select('tenant_id')
        .eq('auth_user_id', user.id)
        .limit(1)
        .maybeSingle()

      let tenantId: string

      if (existing?.tenant_id) {
        tenantId = existing.tenant_id
      } else {
        // Create organisation
        const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
          + '-' + Math.random().toString(36).slice(2, 6)

        const { data: tenant, error: tenantErr } = await sb.from('tenants').insert({
          company_name: companyName.trim(),
          slug,
          website: website?.trim() || null,
          industry: industry?.trim() || null,
          status: 'trial',
          subscription_plan: 'starter',
        }).select().single()

        if (tenantErr || !tenant) throw new Error('Failed to create organisation: ' + tenantErr?.message)
        tenantId = tenant.id

        // Add user as admin member
        const { error: memberErr } = await sb.from('tenant_users').insert({
          tenant_id: tenantId,
          auth_user_id: user.id,
          email: user.email,
          role: 'admin',
        })
        if (memberErr) throw new Error('Failed to add member: ' + memberErr.message)
      }

      // Create workspace
      const wsName = workspaceName?.trim() || `${companyName.trim()} Workspace`
      const { data: ws, error: wsErr } = await sb.from('workspaces').insert({
        tenant_id: tenantId,
        name: wsName,
        status: 'active',
      }).select().single()
      if (wsErr || !ws) throw new Error('Failed to create workspace: ' + wsErr?.message)

      // Create project
      const projectKey = 'proj_' + Math.random().toString(36).slice(2, 10)
      const { data: proj, error: projErr } = await sb.from('tenant_projects').insert({
        tenant_id: tenantId,
        workspace_id: ws.id,
        name: projectName.trim(),
        platform,
        environment: environment ?? 'production',
        project_id_key: projectKey,
        status: 'active',
      }).select().single()
      if (projErr || !proj) throw new Error('Failed to create project: ' + projErr?.message)

      // Generate SDK credentials
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

      setProject(proj)
      setCreds({
        sdkToken:      tokenRows[0].token,
        publicKey:     tokenRows[1].token,
        secretKey:     tokenRows[2].token,
        webhookSecret: tokenRows[3].token,
      })
      setWorkspace(ws)
      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const downloadCreds = () => {
    if (!creds || !project) return
    const content = [
      `PAAQ Intelligence — Credentials`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `Organization:  ${companyName}`,
      `Workspace:     ${workspace?.name ?? workspaceName}`,
      `Project:       ${project.name}`,
      `Platform:      ${platform}`,
      `Environment:   ${environment}`,
      ``,
      `Project ID:      ${project.project_id_key}`,
      `SDK Token:       ${creds.sdkToken}`,
      `Public Key:      ${creds.publicKey}`,
      `Secret Key:      ${creds.secretKey}`,
      `Webhook Secret:  ${creds.webhookSecret}`,
      ``,
      `IMPORTANT: Keep the Secret Key and Webhook Secret secure.`,
      `Never commit them to source control or expose them client-side.`,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paaq-credentials-${project.project_id_key}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#060b10', color: '#e8f0f8' }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,16,24,0.8)', backdropFilter: 'blur(16px)' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' }}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-black">PAAQ Intelligence</span>
          </div>
          <span className="text-xs" style={{ color: '#4a5568' }}>Setup · {STEPS[step]}</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        <ProgressBar current={step} />

        {/* ── Step 0: Welcome ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(81,201,211,0.12)', border: '1px solid rgba(81,201,211,0.2)' }}>
                <Sparkles className="h-8 w-8" style={{ color: '#51C9D3' }} />
              </div>
              <h1 className="text-3xl font-black">Welcome to PAAQ Intelligence</h1>
              <p style={{ color: '#8ba0b4' }}>Let's get you set up. This takes about 5 minutes.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { step: '01', title: 'Set up your org', desc: 'Create your organisation and workspace.' },
                { step: '02', title: 'Connect your app', desc: 'Generate credentials and install the SDK.' },
                { step: '03', title: 'Start monitoring', desc: 'See your first AI insights in minutes.' },
              ].map((s) => (
                <Card key={s.step}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#51C9D3' }}>{s.step}</div>
                  <p className="text-sm font-bold mb-1" style={{ color: '#e8f0f8' }}>{s.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#5a7085' }}>{s.desc}</p>
                </Card>
              ))}
            </div>

            <PrimaryBtn onClick={() => setStep(1)}>
              Let's go <ArrowRight className="h-4 w-4" />
            </PrimaryBtn>
          </div>
        )}

        {/* ── Step 1: Organization ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(81,201,211,0.1)' }}>
                <Building2 className="h-7 w-7" style={{ color: '#51C9D3' }} />
              </div>
              <h1 className="text-2xl font-black">Tell us about your organisation</h1>
              <p style={{ color: '#8ba0b4' }}>This creates your PAAQ organisation. You can update it later in settings.</p>
            </div>

            <div className="space-y-4">
              <div>
                <FieldLabel required>Organisation / Company name</FieldLabel>
                <Input value={companyName} onChange={setCompanyName} placeholder="Acme Corp" onKeyDown={(e) => e.key === 'Enter' && companyName.trim() && setStep(2)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Industry</FieldLabel>
                  <Select value={industry} onChange={setIndustry}>
                    <option value="">Select industry…</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Team size</FieldLabel>
                  <Select value={teamSize} onChange={setTeamSize}>
                    <option value="">Select size…</option>
                    {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Country</FieldLabel>
                  <Select value={country} onChange={setCountry}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Website</FieldLabel>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#4a5568' }} />
                    <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com"
                      className="w-full rounded-xl border px-4 py-3 pl-10 text-sm focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#e8f0f8' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <BackBtn onClick={() => setStep(0)} />
              <PrimaryBtn onClick={() => setStep(2)} disabled={!companyName.trim()}>
                Continue <ArrowRight className="h-4 w-4" />
              </PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Step 2: Workspace ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(81,201,211,0.1)' }}>
                <Layers className="h-7 w-7" style={{ color: '#51C9D3' }} />
              </div>
              <h1 className="text-2xl font-black">Create your first workspace</h1>
              <p style={{ color: '#8ba0b4' }}>Workspaces group related projects. Example: "Mobile Products" or "Web Platform".</p>
            </div>

            <div className="space-y-4">
              <div>
                <FieldLabel required>Workspace name</FieldLabel>
                <Input value={workspaceName} onChange={setWorkspaceName} placeholder={`${companyName || 'My'} Workspace`} />
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <Input value={workspaceDesc} onChange={setWorkspaceDesc} placeholder="e.g. All customer-facing mobile apps" />
              </div>
            </div>

            <Card>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4a5568' }}>Your structure</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Organisation', value: companyName, icon: Building2 },
                  { label: 'Workspace', value: workspaceName || '(your workspace)', icon: Layers },
                  { label: 'Project', value: '→ created in next step', icon: Smartphone, muted: true },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <row.icon className="h-3.5 w-3.5 shrink-0" style={{ color: row.muted ? '#4a5568' : '#51C9D3' }} />
                    <span className="text-xs" style={{ color: '#5a7085' }}>{row.label}:</span>
                    <span className="text-xs font-semibold" style={{ color: row.muted ? '#4a5568' : '#e8f0f8' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex gap-3">
              <BackBtn onClick={() => setStep(1)} />
              <PrimaryBtn onClick={() => setStep(3)}>
                Continue <ArrowRight className="h-4 w-4" />
              </PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Step 3: Project ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(81,201,211,0.1)' }}>
                <Smartphone className="h-7 w-7" style={{ color: '#51C9D3' }} />
              </div>
              <h1 className="text-2xl font-black">Create your first project</h1>
              <p style={{ color: '#8ba0b4' }}>A project represents one app or service you want to monitor.</p>
            </div>

            <div className="space-y-5">
              <div>
                <FieldLabel required>Project name</FieldLabel>
                <Input value={projectName} onChange={setProjectName} placeholder="My Mobile App" />
              </div>

              <div>
                <FieldLabel required>Platform</FieldLabel>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => (
                    <button key={p.id} onClick={() => setPlatform(p.id)}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all hover:scale-[1.02]"
                      style={{ borderColor: platform === p.id ? '#51C9D3' : 'rgba(255,255,255,0.08)', background: platform === p.id ? 'rgba(81,201,211,0.08)' : 'rgba(255,255,255,0.02)' }}>
                      <span className="text-2xl">{p.icon}</span>
                      <span className="text-xs font-semibold" style={{ color: platform === p.id ? '#e8f0f8' : '#5a7085' }}>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Environment</FieldLabel>
                <div className="flex gap-3">
                  {(['production', 'staging'] as const).map((env) => (
                    <button key={env} onClick={() => setEnvironment(env)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold capitalize transition-all"
                      style={{ borderColor: environment === env ? '#51C9D3' : 'rgba(255,255,255,0.08)', background: environment === env ? 'rgba(81,201,211,0.08)' : 'transparent', color: environment === env ? '#e8f0f8' : '#5a7085' }}>
                      <span className={`h-2 w-2 rounded-full ${env === 'production' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      {env}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#fca5a5' }}>
                <X className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <BackBtn onClick={() => setStep(2)} />
              <button onClick={createWorkspace} disabled={submitting || !projectName.trim() || !platform}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' }}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : <>Create project <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Credentials ─────────────────────────────────────────── */}
        {step === 4 && creds && project && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
                <Key className="h-7 w-7 text-green-400" />
              </div>
              <h1 className="text-2xl font-black">Your credentials are ready</h1>
              <p style={{ color: '#8ba0b4' }}>
                Save these now — the Secret Key and Webhook Secret are shown <strong style={{ color: '#e8f0f8' }}>once only</strong>.
              </p>
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4a5568' }}>{project.name}</p>
                  <p className="text-[10px] mt-0.5 capitalize" style={{ color: '#4a5568' }}>{platform} · {environment}</p>
                </div>
                <CopyBtn value={[
                  `Project ID: ${project.project_id_key}`,
                  `SDK Token: ${creds.sdkToken}`,
                  `Public Key: ${creds.publicKey}`,
                  `Secret Key: ${creds.secretKey}`,
                  `Webhook Secret: ${creds.webhookSecret}`,
                ].join('\n')} label="Copy all" />
              </div>

              {[
                { label: 'Project ID',      value: project.project_id_key, hint: 'Use in SDK initialization', secret: false },
                { label: 'SDK Token',       value: creds.sdkToken,         hint: 'Safe to bundle in your app', secret: false },
                { label: 'Public Key',      value: creds.publicKey,        hint: 'Safe for client-side reads', secret: false },
                { label: 'Secret Key',      value: creds.secretKey,        hint: 'Server-side only — never expose', secret: true },
                { label: 'Webhook Secret',  value: creds.webhookSecret,    hint: 'Verify incoming webhooks', secret: true },
              ].map(({ label, value, hint, secret }, i) => (
                <div key={i} className="flex items-start gap-3 border-b px-4 py-3 last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-bold" style={{ color: '#e8f0f8' }}>{label}</p>
                      {secret && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>Server only</span>}
                    </div>
                    <p className="font-mono text-xs break-all" style={{ color: '#5a7085' }}>{value}</p>
                    <p className="mt-0.5 text-[10px]" style={{ color: '#4a5568' }}>{hint}</p>
                  </div>
                  <CopyBtn value={value} />
                </div>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(234,179,8,0.25)', background: 'rgba(234,179,8,0.06)' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500" />
              <p className="text-xs leading-relaxed" style={{ color: '#ca8a04' }}>
                Store your Secret Key and Webhook Secret in environment variables. They cannot be recovered if lost — only rotated.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={downloadCreds} className="flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/5"
                style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#8ba0b4' }}>
                <Download className="h-4 w-4" /> Download .txt
              </button>
              <PrimaryBtn onClick={() => setStep(5)}>
                Continue to install guide <ArrowRight className="h-4 w-4" />
              </PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Step 5: Install ─────────────────────────────────────────────── */}
        {step === 5 && creds && project && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(81,201,211,0.1)' }}>
                <Code2 className="h-7 w-7" style={{ color: '#51C9D3' }} />
              </div>
              <h1 className="text-2xl font-black">Install the SDK</h1>
              <p style={{ color: '#8ba0b4' }}>
                Add PAAQ to your <strong style={{ color: '#e8f0f8' }}>{PLATFORMS.find((p) => p.id === platform)?.label ?? platform}</strong> app.
              </p>
            </div>

            {(() => {
              const { cmd, init } = installSnippet(platform, creds.sdkToken, project.project_id_key)
              return (
                <div className="space-y-4">
                  {/* Install command */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-xs font-semibold" style={{ color: '#4a5568' }}>1. Install package</span>
                      <CopyBtn value={cmd} label="Copy" />
                    </div>
                    <pre className="p-4 text-xs font-mono overflow-x-auto" style={{ color: '#51C9D3' }}>{cmd}</pre>
                  </div>

                  {/* Init code */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-xs font-semibold" style={{ color: '#4a5568' }}>2. Initialise with your credentials</span>
                      <CopyBtn value={init} label="Copy code" />
                    </div>
                    <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed" style={{ background: '#0d1117', color: '#86efac' }}>{init}</pre>
                  </div>
                </div>
              )
            })()}

            <div className="flex gap-3">
              <BackBtn onClick={() => setStep(4)} />
              <PrimaryBtn onClick={() => setStep(6)}>
                I've installed it <ArrowRight className="h-4 w-4" />
              </PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Step 6: Verify connection ────────────────────────────────────── */}
        {step === 6 && project && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: verifyStatus === 'connected' ? 'rgba(34,197,94,0.1)' : 'rgba(81,201,211,0.1)' }}>
                <Wifi className="h-7 w-7" style={{ color: verifyStatus === 'connected' ? '#22c55e' : '#51C9D3' }} />
              </div>
              <h1 className="text-2xl font-black">
                {verifyStatus === 'connected' ? 'Connection confirmed!' : 'Verify your connection'}
              </h1>
              <p style={{ color: '#8ba0b4' }}>
                {verifyStatus === 'connected'
                  ? 'Your SDK is connected and sending events.'
                  : 'Run your app and send a test event. We\'ll detect it here.'}
              </p>
            </div>

            <Card>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#4a5568' }}>Connection checklist</p>
              <div className="space-y-3">
                {[
                  { label: 'Credentials generated', done: true },
                  { label: 'SDK installed in your app', done: true },
                  { label: 'App running with SDK initialized', done: verifyStatus === 'connected' },
                  { label: 'First event received by PAAQ', done: verifyStatus === 'connected' },
                  { label: 'Monitoring active', done: verifyStatus === 'connected' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${item.done ? 'bg-green-500' : 'border'}`}
                      style={!item.done ? { borderColor: 'rgba(255,255,255,0.15)' } : {}}>
                      {item.done
                        ? <Check className="h-3.5 w-3.5 text-white" />
                        : <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
                      }
                    </div>
                    <span className="text-sm" style={{ color: item.done ? '#e8f0f8' : '#4a5568' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {verifyStatus === 'waiting' && (
              <div className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(81,201,211,0.2)', background: 'rgba(81,201,211,0.05)' }}>
                <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin" style={{ color: '#51C9D3' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#51C9D3' }}>Waiting for your app to connect…</p>
                  <p className="text-xs mt-0.5" style={{ color: '#5a7085' }}>
                    Run your app with the SDK installed. PAAQ will detect the first event automatically.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button onClick={() => setVerifyStatus('connected')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors hover:bg-white/5"
                style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#8ba0b4' }}>
                <RefreshCw className="h-4 w-4" /> Check for connection
              </button>

              <PrimaryBtn onClick={() => verifyStatus === 'connected' ? setStep(7) : router.push('/dashboard')}>
                {verifyStatus === 'connected' ? <>Continue <ArrowRight className="h-4 w-4" /></> : 'Skip for now — go to dashboard'}
              </PrimaryBtn>

              {verifyStatus !== 'connected' && (
                <p className="text-center text-xs" style={{ color: '#4a5568' }}>
                  You can always verify the connection from your project settings.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 7: Done ────────────────────────────────────────────────── */}
        {step === 7 && project && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <h1 className="text-3xl font-black">You're all set!</h1>
              <p style={{ color: '#8ba0b4' }}>
                <strong style={{ color: '#e8f0f8' }}>{project.name}</strong> is connected to PAAQ Intelligence.
                AI agents are already getting to work.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: BarChart3, label: 'Dashboard', desc: 'Overview of your app health and KPIs.' },
                { icon: Activity, label: 'Live Events', desc: 'Real-time stream of events and sessions.' },
                { icon: Sparkles, label: 'AI Insights', desc: 'AI-generated insights and recommendations.' },
                { icon: AlertTriangle, label: 'Incidents', desc: 'Auto-detected incidents and root causes.' },
              ].map((item) => (
                <Card key={item.label} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(81,201,211,0.1)' }}>
                    <item.icon className="h-4 w-4" style={{ color: '#51C9D3' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#e8f0f8' }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#5a7085' }}>{item.desc}</p>
                  </div>
                </Card>
              ))}
            </div>

            <PrimaryBtn onClick={() => { router.push('/dashboard'); router.refresh() }}>
              <CheckCircle2 className="h-4 w-4" /> Open my dashboard
            </PrimaryBtn>

            <p className="text-center text-xs" style={{ color: '#4a5568' }}>
              Your credentials and install guide are always available in Settings → SDK Setup.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
