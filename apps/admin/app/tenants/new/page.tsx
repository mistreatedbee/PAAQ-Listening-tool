'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { PLAN_LIMITS } from '@/lib/types'
import type { SubscriptionPlan, Platform } from '@/lib/types'
import { platformIcon, maskToken } from '@/lib/utils'
import {
  Building2, Folder, Key, Code2, CheckCircle2, ArrowRight,
  ArrowLeft, Copy, Check, Loader2, Sparkles,
} from 'lucide-react'

type Step = 'company' | 'plan' | 'project' | 'keys' | 'install'

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'company', label: 'Create Company',  icon: <Building2 className="h-4 w-4" /> },
  { id: 'plan',    label: 'Choose Plan',     icon: <Sparkles className="h-4 w-4" /> },
  { id: 'project', label: 'First Project',   icon: <Folder className="h-4 w-4" /> },
  { id: 'keys',    label: 'Generate Keys',   icon: <Key className="h-4 w-4" /> },
  { id: 'install', label: 'Install Guide',   icon: <Code2 className="h-4 w-4" /> },
]

const PLATFORMS: Platform[] = ['flutter', 'react', 'nextjs', 'android', 'ios', 'nodejs']
const PLANS: SubscriptionPlan[] = ['starter', 'growth', 'business', 'enterprise']

function genToken(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return prefix + Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function genProjectId(): string {
  return 'proj_' + Math.random().toString(36).slice(2, 10)
}

type GeneratedKeys = {
  projectId: string
  sdkToken: string
  publicKey: string
  secretKey: string
  webhookSecret: string
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="btn btn-ghost p-1.5"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" style={{ color: 'var(--healthy)' }} /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export default function OnboardingWizardPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('company')
  const [saving, setSaving] = useState(false)

  // Company
  const [companyName, setCompanyName] = useState('')
  const [slug, setSlug] = useState('')
  const [website, setWebsite] = useState('')
  const [industry, setIndustry] = useState('')

  // Plan
  const [plan, setPlan] = useState<SubscriptionPlan>('growth')

  // Project
  const [projectName, setProjectName] = useState('')
  const [platform, setPlatform] = useState<Platform>('flutter')
  const [environment, setEnvironment] = useState('production')

  // Generated
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [keys, setKeys] = useState<GeneratedKeys | null>(null)

  const stepIdx = STEPS.findIndex((s) => s.id === step)

  const handleCreateCompany = async () => {
    if (!companyName || !slug) return
    setSaving(true)
    const sb = createClient()
    const { data, error } = await sb.from('tenants').insert({
      company_name: companyName,
      slug,
      website: website || null,
      industry: industry || null,
      status: 'trial',
      subscription_plan: 'starter',
    }).select().single()
    if (!error && data) {
      setTenantId(data.id)
      // Create subscription row
      await sb.from('subscriptions').insert({ tenant_id: data.id, plan, ...PLAN_LIMITS[plan], billing_status: 'trialing' })
      await sb.from('admin_audit_log').insert({ action: `Created tenant: ${companyName}`, resource_type: 'tenant', resource_id: data.id, resource_name: companyName })
    }
    setSaving(false)
    setStep('plan')
  }

  const handleSetPlan = async () => {
    if (!tenantId) return
    setSaving(true)
    const sb = createClient()
    await sb.from('tenants').update({ subscription_plan: plan }).eq('id', tenantId)
    await sb.from('subscriptions').upsert({ tenant_id: tenantId, plan, ...PLAN_LIMITS[plan] })
    setSaving(false)
    setStep('project')
  }

  const handleCreateProject = async () => {
    if (!tenantId || !projectName) return
    setSaving(true)
    const sb = createClient()
    const projIdKey = genProjectId()
    const { data, error } = await sb.from('tenant_projects').insert({
      tenant_id: tenantId,
      name: projectName,
      platform,
      environment,
      project_id_key: projIdKey,
      status: 'active',
    }).select().single()
    if (!error && data) {
      setProjectId(data.id)
      await sb.from('admin_audit_log').insert({ action: `Created project: ${projectName} (${platform})`, resource_type: 'project', resource_id: data.id, resource_name: projectName })
    }
    setSaving(false)
    setStep('keys')
  }

  const handleGenerateKeys = async () => {
    if (!tenantId || !projectId) return
    setSaving(true)
    const sb = createClient()
    const generated: GeneratedKeys = {
      projectId: genProjectId(),
      sdkToken: genToken('sdk_live_'),
      publicKey: genToken('pk_live_'),
      secretKey: genToken('sk_live_'),
      webhookSecret: genToken('whsec_'),
    }

    const tokenRows = [
      { token_type: 'sdk_token', token: generated.sdkToken, token_hint: generated.sdkToken.slice(-4) },
      { token_type: 'public_key', token: generated.publicKey, token_hint: generated.publicKey.slice(-4) },
      { token_type: 'secret_key', token: generated.secretKey, token_hint: generated.secretKey.slice(-4) },
      { token_type: 'webhook_secret', token: generated.webhookSecret, token_hint: generated.webhookSecret.slice(-4) },
    ].map((t) => ({ ...t, tenant_id: tenantId, project_id: projectId, status: 'active' }))

    await sb.from('access_tokens').insert(tokenRows)
    await sb.from('admin_audit_log').insert({ action: 'Generated SDK credentials', resource_type: 'token', resource_id: projectId, resource_name: projectName })

    setKeys(generated)
    setSaving(false)
    setStep('install')
  }

  const sdkSnippets: Record<string, string> = {
    flutter: `await PAQQListening.initialize(\n  projectId: "${keys?.projectId ?? 'proj_xxx'}",\n  sdkToken: "${keys?.sdkToken ?? 'sdk_live_xxx'}",\n  environment: "${environment}",\n);`,
    react: `import { Listening } from '@paaq/sdk-react';\n\nListening.init({\n  projectId: '${keys?.projectId ?? 'proj_xxx'}',\n  sdkToken: '${keys?.sdkToken ?? 'sdk_live_xxx'}',\n});`,
    nextjs: `// app/layout.tsx\nimport { ListeningProvider } from '@paaq/sdk-next';\n\nexport default function Layout({ children }) {\n  return (\n    <ListeningProvider\n      projectId="${keys?.projectId ?? 'proj_xxx'}"\n      sdkToken="${keys?.sdkToken ?? 'sdk_live_xxx'}"\n    >\n      {children}\n    </ListeningProvider>\n  );\n}`,
    android: `PAQQListening.initialize(\n  context = this,\n  projectId = "${keys?.projectId ?? 'proj_xxx'}",\n  sdkToken = "${keys?.sdkToken ?? 'sdk_live_xxx'}"\n)`,
    ios: `PAQQListening.initialize(\n  projectId: "${keys?.projectId ?? 'proj_xxx'}",\n  sdkToken: "${keys?.sdkToken ?? 'sdk_live_xxx'}"\n)`,
    nodejs: `const { Listening } = require('@paaq/sdk-node');\n\nListening.init({\n  projectId: '${keys?.projectId ?? 'proj_xxx'}',\n  secretKey: '${keys?.secretKey ?? 'sk_live_xxx'}',\n});`,
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Onboard New Company</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          5-step wizard to get a company live on the platform
        </p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 flex-1">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1"
              style={{
                background: s.id === step ? 'color-mix(in oklch, var(--accent) 10%, transparent)' : i < stepIdx ? 'color-mix(in oklch, var(--healthy) 8%, transparent)' : 'var(--surface)',
                border: `1px solid ${s.id === step ? 'color-mix(in oklch, var(--accent) 30%, transparent)' : i < stepIdx ? 'color-mix(in oklch, var(--healthy) 25%, transparent)' : 'var(--border)'}`,
              }}
            >
              <span style={{ color: s.id === step ? 'var(--accent)' : i < stepIdx ? 'var(--healthy)' : 'var(--text-dim)' }}>
                {i < stepIdx ? <CheckCircle2 className="h-4 w-4" /> : s.icon}
              </span>
              <span className="text-[11px] font-medium hidden sm:block" style={{ color: s.id === step ? 'var(--accent)' : i < stepIdx ? 'var(--healthy)' : 'var(--text-muted)' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-dim)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="admin-card p-6 space-y-5">

        {step === 'company' && (
          <>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Company Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Company Name *</label>
                <input value={companyName} onChange={(e) => { setCompanyName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')) }} placeholder="Acme Corporation" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Slug (URL-safe) *</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-corporation" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Website</label>
                  <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Industry</label>
                  <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="FinTech" />
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleCreateCompany} disabled={!companyName || !slug || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="h-4 w-4" /></>}
            </button>
          </>
        )}

        {step === 'plan' && (
          <>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Choose Subscription Plan</h2>
            <div className="grid grid-cols-2 gap-3">
              {PLANS.map((p) => {
                const limits = PLAN_LIMITS[p]
                const selected = plan === p
                return (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      background: selected ? 'color-mix(in oklch, var(--accent) 10%, transparent)' : 'var(--surface-2)',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-hi)'}`,
                    }}
                  >
                    <p className="font-semibold capitalize" style={{ color: selected ? 'var(--accent)' : 'var(--text)' }}>{p}</p>
                    <p className="text-lg font-black mt-1" style={{ color: 'var(--text)' }}>
                      {limits.price_usd === 0 ? 'Free' : limits.price_usd === -1 ? 'Custom' : `$${limits.price_usd}/mo`}
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      {limits.max_projects} projects · {(limits.max_events_per_month / 1000).toFixed(0)}K events · {limits.max_users} users
                    </p>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={() => setStep('company')}><ArrowLeft className="h-4 w-4" /> Back</button>
              <button className="btn btn-primary" onClick={handleSetPlan} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </>
        )}

        {step === 'project' && (
          <>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Create First Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Project Name *</label>
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Mobile App" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Platform *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className="rounded-lg p-2 text-center text-xs transition-all"
                        style={{
                          background: platform === p ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'var(--surface-2)',
                          border: `1px solid ${platform === p ? 'var(--accent)' : 'var(--border-hi)'}`,
                          color: platform === p ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        <div>{platformIcon(p)}</div>
                        <div className="mt-1">{p}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Environment</label>
                  <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={() => setStep('plan')}><ArrowLeft className="h-4 w-4" /> Back</button>
              <button className="btn btn-primary" onClick={handleCreateProject} disabled={!projectName || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </>
        )}

        {step === 'keys' && (
          <>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Generate Credentials</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Generate secure SDK and API credentials for <strong style={{ color: 'var(--text)' }}>{projectName}</strong>.
              These will be displayed once — save them securely.
            </p>
            <div
              className="rounded-lg p-4 space-y-2 text-sm font-mono"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-hi)' }}
            >
              {[
                { label: 'SDK Token', desc: 'Used by mobile/web SDKs', prefix: 'sdk_live_xxx' },
                { label: 'Public Key', desc: 'Safe to embed in client apps', prefix: 'pk_live_xxx' },
                { label: 'Secret Key', desc: 'Server-to-server only', prefix: 'sk_live_xxx' },
                { label: 'Webhook Secret', desc: 'Verify webhook payloads', prefix: 'whsec_xxx' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold block" style={{ color: 'var(--text-muted)', fontFamily: 'inherit' }}>{item.label}</span>
                    <span style={{ color: 'var(--text-dim)' }}>{item.prefix}</span>
                  </div>
                  <span className="badge badge-muted text-[10px]">{item.desc}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={() => setStep('project')}><ArrowLeft className="h-4 w-4" /> Back</button>
              <button className="btn btn-primary" onClick={handleGenerateKeys} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Key className="h-4 w-4" /> Generate All Credentials</>}
              </button>
            </div>
          </>
        )}

        {step === 'install' && keys && (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--healthy)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                {companyName} is ready!
              </h2>
            </div>

            {/* Credentials */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-hi)' }}>
              <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                Credentials — shown once, save securely
              </div>
              {[
                { label: 'Project ID',      value: keys.projectId,     desc: 'Identifies the project' },
                { label: 'SDK Token',       value: keys.sdkToken,      desc: 'Mobile/web SDKs' },
                { label: 'Public Key',      value: keys.publicKey,     desc: 'Client-safe' },
                { label: 'Secret Key',      value: keys.secretKey,     desc: 'Server only — keep private' },
                { label: 'Webhook Secret',  value: keys.webhookSecret, desc: 'Verify payloads' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    <p className="font-mono text-xs truncate mt-0.5" style={{ color: 'var(--accent)' }}>{item.value}</p>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--text-dim)' }}>{item.desc}</span>
                  <CopyBtn value={item.value} />
                </div>
              ))}
            </div>

            {/* Installation snippet */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                {platformIcon(platform)} {platform} SDK Installation
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-hi)' }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{platform}</span>
                  <CopyBtn value={sdkSnippets[platform] ?? ''} />
                </div>
                <pre className="p-4 font-mono text-xs overflow-x-auto" style={{ color: 'var(--text)', background: '#060b10' }}>
                  {sdkSnippets[platform]}
                </pre>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={() => router.push(`/tenants/${tenantId}`)}>
                View Tenant Detail
              </button>
              <button className="btn btn-primary" onClick={() => router.push('/tenants')}>
                Back to Companies
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
