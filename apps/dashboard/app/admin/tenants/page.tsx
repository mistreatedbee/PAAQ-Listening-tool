'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { timeAgo, planBadgeClass, statusBadgeClass } from '@/lib/admin-utils'
import type { Tenant } from '@/lib/admin-types'
import { Building2, Plus, Search, MoreVertical, ExternalLink, Ban, Trash2, RefreshCw, ArrowUpRight } from 'lucide-react'

type TenantWithCounts = Tenant & {
  _projectCount?: number
  _userCount?: number
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.from('tenants')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTenants((data ?? []) as Tenant[])
        setLoading(false)
      })
  }, [])

  const filtered = tenants.filter((t) => {
    const matchSearch = t.company_name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchPlan = planFilter === 'all' || t.subscription_plan === planFilter
    return matchSearch && matchStatus && matchPlan
  })

  const handleSuspend = async (id: string) => {
    const sb = createClient()
    await sb.from('tenants').update({ status: 'suspended' }).eq('id', id)
    setTenants((prev) => prev.map((t) => t.id === id ? { ...t, status: 'suspended' } : t))
    setActionMenu(null)
  }

  const handleActivate = async (id: string) => {
    const sb = createClient()
    await sb.from('tenants').update({ status: 'active' }).eq('id', id)
    setTenants((prev) => prev.map((t) => t.id === id ? { ...t, status: 'active' } : t))
    setActionMenu(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Tenant Management</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {tenants.length} companies registered on the platform
          </p>
        </div>
        <Link href="/admin/tenants/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> Onboard Company
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            style={{ paddingLeft: '36px', width: '100%' }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="churned">Churned</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All Plans</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading tenants…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Building2 className="h-10 w-10 mx-auto" style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search || statusFilter !== 'all' || planFilter !== 'all' ? 'No companies match your filters.' : 'No companies yet.'}
            </p>
            {!search && statusFilter === 'all' && planFilter === 'all' && (
              <Link href="/admin/tenants/new" className="btn btn-primary inline-flex"><Plus className="h-4 w-4" /> Onboard First Company</Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Company', 'Plan', 'Status', 'SDK Platform', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-5 py-3.5">
                    <div>
                      <Link href={`/admin/tenants/${t.id}`} className="font-semibold hover:underline" style={{ color: 'var(--text)' }}>
                        {t.company_name}
                      </Link>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.slug}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${planBadgeClass(t.subscription_plan)}`}>{t.subscription_plan}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${statusBadgeClass(t.status)}`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t.industry ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(t.created_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 relative">
                      <Link href={`/admin/tenants/${t.id}`} className="btn btn-ghost p-1.5" title="Open detail">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        className="btn btn-ghost p-1.5"
                        onClick={() => setActionMenu(actionMenu === t.id ? null : t.id)}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                      {actionMenu === t.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} aria-hidden />
                          <div
                            className="absolute right-0 top-8 z-20 w-44 rounded-xl overflow-hidden shadow-2xl"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border-hi)' }}
                          >
                            <Link
                              href={`/admin/tenants/${t.id}`}
                              className="flex items-center gap-2.5 px-3 py-2 text-sm"
                              style={{ color: 'var(--text)' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> View Detail
                            </Link>
                            <Link
                              href={`/tokens?tenant=${t.id}`}
                              className="flex items-center gap-2.5 px-3 py-2 text-sm"
                              style={{ color: 'var(--text)' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Manage Tokens
                            </Link>
                            <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                            {t.status !== 'suspended' ? (
                              <button
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm"
                                style={{ color: 'var(--warning)' }}
                                onClick={() => handleSuspend(t.id)}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <Ban className="h-3.5 w-3.5" /> Suspend
                              </button>
                            ) : (
                              <button
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm"
                                style={{ color: 'var(--healthy)' }}
                                onClick={() => handleActivate(t.id)}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <RefreshCw className="h-3.5 w-3.5" /> Reactivate
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
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
