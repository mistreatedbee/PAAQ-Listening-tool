'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { fmt, timeAgo } from '@/lib/admin-utils'
import type { Tenant } from '@/lib/admin-types'
import { Activity, AlertTriangle, Zap, TrendingUp, Users, RefreshCw } from 'lucide-react'

type DailyStat = {
  date: string
  events_count: number
  errors_count: number
  sessions_count: number
  ai_requests_count: number
  api_requests_count: number
  active_users_count: number
}

export default function EventMonitorPage() {
  const [stats, setStats] = useState<DailyStat[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = () => {
    const sb = createClient()
    const since = new Date()
    since.setDate(since.getDate() - 14)
    Promise.all([
      sb.from('usage_statistics')
        .select('date, events_count, errors_count, sessions_count, ai_requests_count, api_requests_count, active_users_count')
        .gte('date', since.toISOString().slice(0, 10))
        .order('date', { ascending: false }),
      sb.from('tenants').select('*').eq('status', 'active').order('company_name').limit(20),
    ]).then(([{ data: s }, { data: t }]) => {
      setStats((s ?? []) as DailyStat[])
      setTenants((t ?? []) as Tenant[])
      setLastRefresh(new Date())
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const totals = stats.reduce(
    (acc, s) => ({
      events: acc.events + s.events_count,
      errors: acc.errors + s.errors_count,
      sessions: acc.sessions + s.sessions_count,
      ai: acc.ai + s.ai_requests_count,
    }),
    { events: 0, errors: 0, sessions: 0, ai: 0 },
  )

  const today = stats[0] ?? null

  const MetricBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%`, background: color }} />
    </div>
  )

  const maxEvents = Math.max(...stats.map((s) => s.events_count), 1)
  const maxErrors = Math.max(...stats.map((s) => s.errors_count), 1)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Global Event Monitor</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Platform-wide event stream · refreshed {timeAgo(lastRefresh.toISOString())}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Today KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Events Today',    value: fmt(today?.events_count ?? 0),      icon: <Activity className="h-4 w-4" />,      color: 'var(--accent)' },
          { label: 'Errors Today',    value: fmt(today?.errors_count ?? 0),       icon: <AlertTriangle className="h-4 w-4" />, color: 'var(--critical)' },
          { label: 'Sessions Today',  value: fmt(today?.sessions_count ?? 0),     icon: <Users className="h-4 w-4" />,        color: 'var(--healthy)' },
          { label: 'AI Calls Today',  value: fmt(today?.ai_requests_count ?? 0),  icon: <Zap className="h-4 w-4" />,         color: 'var(--ai)' },
        ].map((kpi) => (
          <div key={kpi.label} className="admin-card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
              <span style={{ color: kpi.color }}>{kpi.icon}</span>
            </div>
            <p className="text-2xl font-black" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* 14-day chart */}
        <div className="admin-card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>14-Day Event Volume</h2>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : stats.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No data yet. Events will appear once SDKs are connected.</div>
          ) : (
            <div className="space-y-2">
              {stats.slice(0, 14).map((s) => (
                <div key={s.date} className="flex items-center gap-3">
                  <span className="text-[11px] w-20 shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </span>
                  <MetricBar value={s.events_count} max={maxEvents} color="var(--accent)" />
                  <span className="text-[11px] w-14 text-right font-mono" style={{ color: 'var(--text)' }}>
                    {fmt(s.events_count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error rate */}
        <div className="admin-card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Error Rate (14d)</h2>
          {stats.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No data yet.</div>
          ) : (
            <div className="space-y-2">
              {stats.slice(0, 7).map((s) => {
                const rate = s.events_count > 0 ? ((s.errors_count / s.events_count) * 100).toFixed(1) : '0'
                return (
                  <div key={s.date} className="flex items-center gap-3">
                    <span className="text-[11px] w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </span>
                    <MetricBar value={s.errors_count} max={maxErrors} color="var(--critical)" />
                    <span className="text-[11px] w-10 text-right" style={{ color: 'var(--critical)' }}>{rate}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 14-day totals summary */}
      <div className="admin-card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>14-Day Platform Totals</h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { label: 'Total Events',    value: fmt(totals.events),   color: 'var(--accent)' },
            { label: 'Total Errors',    value: fmt(totals.errors),   color: 'var(--critical)' },
            { label: 'Total Sessions',  value: fmt(totals.sessions), color: 'var(--healthy)' },
            { label: 'Total AI Calls',  value: fmt(totals.ai),       color: 'var(--ai)' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
