'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { timeAgo } from '@/lib/admin-utils'
import type { AuditLogEntry } from '@/lib/admin-types'
import { ScrollText, Search, RefreshCw } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  Created: 'var(--healthy)',
  Generated: 'var(--accent)',
  Revoked: 'var(--warning)',
  Deleted: 'var(--critical)',
  Suspended: 'var(--warning)',
  Reactivated: 'var(--healthy)',
  Updated: 'var(--ai)',
}

function actionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.startsWith(key)) return color
  }
  return 'var(--text-muted)'
}

export default function AuditCenterPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const load = () => {
    setLoading(true)
    createClient()
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setEntries((data ?? []) as AuditLogEntry[])
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  const resourceTypes = [...new Set(entries.map((e) => e.resource_type).filter(Boolean))]

  const filtered = entries.filter((e) => {
    const matchSearch = !search
      || e.action.toLowerCase().includes(search.toLowerCase())
      || (e.admin_email ?? '').toLowerCase().includes(search.toLowerCase())
      || (e.resource_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || e.resource_type === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Audit Center</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Every admin action is logged — {entries.length} total entries
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Total Actions', value: entries.length, color: 'var(--accent)' },
          { label: 'Today', value: entries.filter((e) => new Date(e.created_at).toDateString() === new Date().toDateString()).length, color: 'var(--healthy)' },
          { label: 'Token Actions', value: entries.filter((e) => e.resource_type === 'token').length, color: 'var(--warning)' },
          { label: 'Tenant Actions', value: entries.filter((e) => e.resource_type === 'tenant').length, color: 'var(--ai)' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg px-4 py-2 flex items-center gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actions, admin, resource…" style={{ paddingLeft: '36px' }} />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All Types</option>
          {resourceTypes.map((t) => <option key={String(t)} value={String(t)}>{String(t)}</option>)}
        </select>
      </div>

      {/* Audit table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading audit log…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <ScrollText className="h-10 w-10 mx-auto" style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search || typeFilter !== 'all' ? 'No audit entries match your filters.' : 'No admin actions recorded yet.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Action', 'Resource', 'Type', 'Admin', 'IP', 'When'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-5 py-3">
                    <span className="font-medium" style={{ color: actionColor(entry.action) }}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {entry.resource_name ?? entry.resource_id?.slice(0, 8) ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    {entry.resource_type && (
                      <span className="badge badge-muted capitalize">{entry.resource_type}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {entry.admin_email ?? 'system'}
                  </td>
                  <td className="px-5 py-3 text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
                    {entry.ip_address ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(entry.created_at)}
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
