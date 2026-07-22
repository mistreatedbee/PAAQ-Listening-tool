'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { planBadgeClass, statusBadgeClass, timeAgo, fmt, maskToken, platformIcon } from '@/lib/utils'
import type { Tenant, TenantProject, TenantUser, AccessToken, Subscription, AuditLogEntry } from '@/lib/types'
import {
  ArrowLeft, Building2, Folder, Users, Key, ScrollText, CreditCard,
  Plus, RefreshCw, Loader2, Copy, Check, ExternalLink,
} from 'lucide-react'

type Tab = 'overview' | 'projects' | 'users' | 'tokens' | 'subscription' | 'audit'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',     label: 'Overview'     },
  { id: 'projects',     label: 'Projects'     },
  { id: 'users',        label: 'Users'        },
  { id: 'tokens',       label: 'API Keys'     },
  { id: 'subscription', label: 'Subscription' },
  { id: 'audit',        label: 'Audit Log'    },
]

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="btn btn-ghost p-1">
      {copied ? <Check className="h-3 w-3" style={{ color: 'var(--healthy)' }} /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [projects, setProjects] = useState<TenantProject[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])
  const [tokens, setTokens] = useState<AccessToken[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [audit, setAudit] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('tenants').select('*').eq('id', id).single(),
      sb.from('tenant_projects').select('*').eq('tenant_id', id).order('created_at'),
      sb.from('tenant_users').select('*').eq('tenant_id', id).order('created_at'),
      sb.from('access_tokens').select('*').eq('tenant_id', id).order('created_at', { ascending: false }),
      sb.from('subscriptions').select('*').eq('tenant_id', id).single(),
      sb.from('admin_audit_log').select('*').eq('resource_id', id).order('created_at', { ascending: false }).limit(30),
    ]).then(([{ data: t }, { data: p }, { data: u }, { data: tok }, { data: sub }, { data: au }]) => {
      setTenant(t as Tenant | null)
      setProjects((p ?? []) as TenantProject[])
      setUsers((u ?? []) as TenantUser[])
      setTokens((tok ?? []) as AccessToken[])
      setSubscription(sub as Subscription | null)
      setAudit((au ?? []) as AuditLogEntry[])
      setLoading(false)
    })
  }, [id])

  const handleRevokeToken = async (tokenId: string) => {
    const sb = createClient()
    await sb.from('access_tokens').update({ status: 'revoked' }).eq('id', tokenId)
    setTokens((prev) => prev.map((t) => t.id === tokenId ? { ...t, status: 'revoked' } : t))
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
  if (!tenant) return (
    <div className="space-y-4">
      <Link href="/tenants" className="btn btn-ghost"><ArrowLeft className="h-4 w-4" /> Tenants</Link>
      <p style={{ color: 'var(--text-muted)' }}>Tenant not found.</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/tenants" className="btn btn-ghost p-1.5"><ArrowLeft className="h-4 w-4" /></Link>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white"
            style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)' }}
          >
            {tenant.company_name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{tenant.company_name}</h1>
              <span className={`badge ${statusBadgeClass(tenant.status)}`}>{tenant.status}</span>
              <span className={`badge ${planBadgeClass(tenant.subscription_plan)}`}>{tenant.subscription_plan}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tenant.slug}{tenant.website ? ` · ${tenant.website}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/tokens?tenant=${id}`} className="btn btn-secondary"><Key className="h-4 w-4" /> Manage Keys</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all"
            style={{
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { label: 'Projects', value: projects.length, icon: <Folder className="h-4 w-4" /> },
            { label: 'Users', value: users.length, icon: <Users className="h-4 w-4" /> },
            { label: 'Active Tokens', value: tokens.filter((t) => t.status === 'active').length, icon: <Key className="h-4 w-4" /> },
          ].map((s) => (
            <div key={s.label} className="admin-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: 'var(--accent)' }}>{s.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
              <p className="text-3xl font-black" style={{ color: 'var(--text)' }}>{s.value}</p>
            </div>
          ))}
          <div className="admin-card p-5 col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Company Details</p>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              {[
                ['ID', tenant.id], ['Industry', tenant.industry ?? '—'],
                ['Website', tenant.website ?? '—'], ['Created', timeAgo(tenant.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span style={{ color: 'var(--text-muted)', minWidth: '80px' }}>{k}</span>
                  <span style={{ color: 'var(--text)', fontFamily: k === 'ID' ? 'monospace' : 'inherit', fontSize: k === 'ID' ? '11px' : '14px' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Projects */}
      {tab === 'projects' && (
        <div className="admin-card overflow-hidden">
          {projects.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No projects. <Link href={`/tenants/new`} style={{ color: 'var(--accent)' }}>Add via onboarding →</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {['Name', 'Platform', 'Environment', 'Project ID', 'Status', 'Created'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--text)' }}>{p.name}</td>
                    <td className="px-5 py-3">{platformIcon(p.platform)} {p.platform}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{p.environment}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--accent)' }}>{p.project_id_key}</td>
                    <td className="px-5 py-3"><span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span></td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="admin-card overflow-hidden">
          {users.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No users added yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {['Email', 'Name', 'Role', 'Status', 'Last Login', 'Joined'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--text)' }}>{u.email}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{u.full_name ?? '—'}</td>
                    <td className="px-5 py-3"><span className="badge badge-muted capitalize">{u.role.replace('_', ' ')}</span></td>
                    <td className="px-5 py-3"><span className={`badge ${statusBadgeClass(u.status)}`}>{u.status}</span></td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{u.last_login ? timeAgo(u.last_login) : '—'}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tokens */}
      {tab === 'tokens' && (
        <div className="space-y-3">
          {tokens.length === 0 ? (
            <div className="admin-card py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No credentials generated. <Link href={`/tokens?tenant=${id}`} style={{ color: 'var(--accent)' }}>Generate →</Link>
            </div>
          ) : (
            tokens.map((tok) => (
              <div key={tok.id} className="admin-card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{tok.token_type.replace('_', ' ')}</span>
                    <span className={`badge ${statusBadgeClass(tok.status)}`}>{tok.status}</span>
                  </div>
                  <p className="font-mono text-xs" style={{ color: tok.status === 'active' ? 'var(--accent)' : 'var(--text-dim)' }}>
                    {maskToken(tok.token)}
                  </p>
                </div>
                <p className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{timeAgo(tok.created_at)}</p>
                {tok.status === 'active' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <CopyBtn value={tok.token} />
                    <button className="btn btn-danger btn-ghost" onClick={() => handleRevokeToken(tok.id)} title="Revoke">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Subscription */}
      {tab === 'subscription' && (
        <div className="admin-card p-6 space-y-4">
          {!subscription ? (
            <p style={{ color: 'var(--text-muted)' }}>No subscription record.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={`badge ${planBadgeClass(subscription.plan)}`}>{subscription.plan}</span>
                <span className={`badge ${statusBadgeClass(subscription.billing_status)}`}>{subscription.billing_status}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Max Projects', subscription.max_projects],
                  ['Max Users', subscription.max_users],
                  ['Events / Month', fmt(subscription.max_events_per_month)],
                  ['AI Requests / Month', fmt(subscription.max_ai_requests_per_month)],
                  ['Storage', `${subscription.max_storage_gb} GB`],
                  ['Renewal', subscription.renewal_date ? timeAgo(subscription.renewal_date) : '—'],
                  ['Stripe Customer', subscription.stripe_customer_id ?? '—'],
                  ['Stripe Sub', subscription.stripe_subscription_id ?? '—'],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ color: 'var(--text)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Audit */}
      {tab === 'audit' && (
        <div className="admin-card overflow-hidden">
          {audit.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No audit entries.</div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {['Action', 'By', 'When'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>{a.action}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{a.admin_email ?? 'system'}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
