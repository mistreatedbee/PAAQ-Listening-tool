'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { statusBadgeClass, timeAgo, maskToken } from '@/lib/admin-utils'
import type { AccessToken, Tenant, TenantProject } from '@/lib/admin-types'
import { Key, Copy, Check, RefreshCw, XCircle, Plus, Loader2, Filter } from 'lucide-react'

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="btn btn-ghost p-1.5" title="Copy full token">
      {copied ? <Check className="h-3.5 w-3.5" style={{ color: 'var(--healthy)' }} /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

const TOKEN_TYPES = ['sdk_token', 'public_key', 'secret_key', 'webhook_secret'] as const
const TYPE_LABELS: Record<string, string> = {
  sdk_token: 'SDK Token', public_key: 'Public Key', secret_key: 'Secret Key', webhook_secret: 'Webhook Secret',
}
const TYPE_PREFIXES: Record<string, string> = {
  sdk_token: 'sdk_live_', public_key: 'pk_live_', secret_key: 'sk_live_', webhook_secret: 'whsec_',
}

function genToken(type: string): string {
  const prefix = TYPE_PREFIXES[type] ?? 'tok_'
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return prefix + Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function TokensPage() {
  const searchParams = useSearchParams()
  const filterTenant = searchParams.get('tenant')

  const [tokens, setTokens] = useState<AccessToken[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [projects, setProjects] = useState<TenantProject[]>([])
  const [loading, setLoading] = useState(true)

  const [genTenantId, setGenTenantId] = useState(filterTenant ?? '')
  const [genProjectId, setGenProjectId] = useState('')
  const [genTypes, setGenTypes] = useState<Set<string>>(new Set(TOKEN_TYPES))
  const [generating, setGenerating] = useState(false)
  const [newTokens, setNewTokens] = useState<Record<string, string>>({})
  const [showGenForm, setShowGenForm] = useState(false)

  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('access_tokens').select('*').order('created_at', { ascending: false }).limit(100),
      sb.from('tenants').select('id, company_name').order('company_name'),
      sb.from('tenant_projects').select('id, tenant_id, name, platform').order('name'),
    ]).then(([{ data: tok }, { data: ten }, { data: proj }]) => {
      setTokens((tok ?? []) as AccessToken[])
      setTenants((ten ?? []) as Tenant[])
      setProjects((proj ?? []) as TenantProject[])
      setLoading(false)
    })
  }, [])

  const filteredProjects = projects.filter((p) => !genTenantId || p.tenant_id === genTenantId)
  const filteredTokens = tokens
    .filter((t) => !filterTenant || t.tenant_id === filterTenant)
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)
    .filter((t) => typeFilter === 'all' || t.token_type === typeFilter)

  const handleGenerate = async () => {
    if (!genTenantId || !genProjectId) return
    setGenerating(true)
    const sb = createClient()
    const generated: Record<string, string> = {}
    const rows = []

    for (const type of genTypes) {
      const token = genToken(type)
      generated[type] = token
      rows.push({
        tenant_id: genTenantId,
        project_id: genProjectId,
        token_type: type,
        token,
        token_hint: token.slice(-4),
        status: 'active',
      })
    }

    const { data } = await sb.from('access_tokens').insert(rows).select()
    if (data) {
      setTokens((prev) => [...(data as AccessToken[]), ...prev])
      setNewTokens(generated)
      await sb.from('admin_audit_log').insert({
        action: `Generated ${rows.length} credential(s) for project`,
        resource_type: 'token',
        resource_id: genProjectId,
      })
    }
    setGenerating(false)
  }

  const handleRevoke = async (tokenId: string) => {
    const sb = createClient()
    await sb.from('access_tokens').update({ status: 'revoked' }).eq('id', tokenId)
    setTokens((prev) => prev.map((t) => t.id === tokenId ? { ...t, status: 'revoked' } : t))
    setNewTokens((prev) => { const n = { ...prev }; return n })
  }

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.company_name ?? id.slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Access Token Management</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Generate, rotate, and revoke SDK keys, API secrets, and webhook credentials
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowGenForm((s) => !s)}>
          <Plus className="h-4 w-4" /> Generate Credentials
        </button>
      </div>

      {/* Generate form */}
      {showGenForm && (
        <div className="admin-card p-5 space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Generate New Credentials</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Company</label>
              <select value={genTenantId} onChange={(e) => { setGenTenantId(e.target.value); setGenProjectId('') }}>
                <option value="">Select company…</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Project</label>
              <select value={genProjectId} onChange={(e) => setGenProjectId(e.target.value)} disabled={!genTenantId}>
                <option value="">Select project…</option>
                {filteredProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Credential Types</label>
            <div className="flex flex-wrap gap-2">
              {TOKEN_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setGenTypes((prev) => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n })}
                  className="badge"
                  style={{
                    cursor: 'pointer',
                    background: genTypes.has(type) ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'var(--surface-2)',
                    color: genTypes.has(type) ? 'var(--accent)' : 'var(--text-muted)',
                    borderColor: genTypes.has(type) ? 'color-mix(in oklch, var(--accent) 30%, transparent)' : 'var(--border-hi)',
                  }}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {Object.keys(newTokens).length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-hi)' }}>
              <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'color-mix(in oklch, var(--healthy) 8%, transparent)', color: 'var(--healthy)', borderBottom: '1px solid var(--border)' }}>
                Generated — shown once only
              </div>
              {Object.entries(newTokens).map(([type, value]) => (
                <div key={type} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>{TYPE_LABELS[type]}</p>
                    <p className="font-mono text-xs truncate" style={{ color: 'var(--accent)' }}>{value}</p>
                  </div>
                  <CopyBtn value={value} />
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-primary" onClick={handleGenerate} disabled={!genTenantId || !genProjectId || genTypes.size === 0 || generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Key className="h-4 w-4" /> Generate</>}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="rotating">Rotating</option>
          <option value="expired">Expired</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All Types</option>
          {TOKEN_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      {/* Tokens table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading tokens…</div>
        ) : filteredTokens.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Key className="h-8 w-8 mx-auto" style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No credentials yet. Generate your first above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Type', 'Token', 'Company', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((tok) => (
                <tr key={tok.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-5 py-3">
                    <span className="badge badge-accent text-[10px]">{TYPE_LABELS[tok.token_type]}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {maskToken(tok.token)}
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text)' }}>
                    {tenantName(tok.tenant_id)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${statusBadgeClass(tok.status)}`}>{tok.status}</span>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(tok.created_at)}</td>
                  <td className="px-5 py-3">
                    {tok.status === 'active' && (
                      <div className="flex items-center gap-1">
                        <CopyBtn value={tok.token} />
                        <button className="btn btn-danger p-1.5 text-xs" onClick={() => handleRevoke(tok.id)} title="Revoke">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
