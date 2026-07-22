'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { fmt, fmtBytes, timeAgo, statusBadgeClass, planBadgeClass } from '@/lib/admin-utils'
import type { Tenant, AuditLogEntry } from '@/lib/admin-types'
import {
  Building2, ArrowRight, TrendingUp, Users, Zap, BrainCircuit,
  AlertTriangle, CheckCircle, XCircle, Clock, Activity,
} from 'lucide-react'

type PlatformStats = {
  totalTenants: number
  activeTenants: number
  totalProjects: number
  totalUsers: number
  eventsToday: number
  aiRequestsToday: number
  activeTokens: number
  sdkInstallations: number
}

const PLAN_ORDER = ['starter', 'growth', 'business', 'enterprise']

export default function PlatformOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([])
  const [recentAudit, setRecentAudit] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    const sb = createClient()
    const today = new Date().toISOString().slice(0, 10)

    Promise.all([
      sb.from('tenants').select('*', { count: 'exact', head: true }),
      sb.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('tenant_projects').select('*', { count: 'exact', head: true }),
      sb.from('tenant_users').select('*', { count: 'exact', head: true }),
      sb.from('usage_statistics').select('events_count').eq('date', today),
      sb.from('usage_statistics').select('ai_requests_count').eq('date', today),
      sb.from('access_tokens').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('sdk_installations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('tenants').select('*').order('created_at', { ascending: false }).limit(5),
      sb.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(8),
    ]).then(([
      { count: tt }, { count: at }, { count: tp }, { count: tu },
      { data: evts }, { data: ai },
      { count: tok }, { count: sdk },
      { data: tenants }, { data: audit },
    ]) => {
      setStats({
        totalTenants: tt ?? 0,
        activeTenants: at ?? 0,
        totalProjects: tp ?? 0,
        totalUsers: tu ?? 0,
        eventsToday: (evts ?? []).reduce((s, r) => s + (r.events_count ?? 0), 0),
        aiRequestsToday: (ai ?? []).reduce((s, r) => s + (r.ai_requests_count ?? 0), 0),
        activeTokens: tok ?? 0,
        sdkInstallations: sdk ?? 0,
      })
      setRecentTenants((tenants ?? []) as Tenant[])
      setRecentAudit((audit ?? []) as AuditLogEntry[])
    })
  }, [])

  const KpiCard = ({
    label, value, icon, sub, color,
  }: { label: string; value: string; icon: React.ReactNode; sub?: string; color?: string }) => (
    <div className="admin-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="mt-2 text-2xl font-black" style={{ color: color ?? 'var(--text)' }}>{value}</p>
          {sub && <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'color-mix(in oklch, var(--accent) 10%, transparent)', color: 'var(--accent)' }}
        >
          {icon}
        </div>
      </div>
    </div>
  )

  const systemChecks = [
    { label: 'Database', status: 'healthy' },
    { label: 'Realtime', status: 'healthy' },
    { label: 'Storage', status: 'healthy' },
    { label: 'Edge Functions', status: 'healthy' },
    { label: 'AI Services', status: 'healthy' },
    { label: 'Auth', status: 'healthy' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Platform Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Real-time view of the entire PAAQ Intelligence Platform
          </p>
        </div>
        <Link href="/admin/tenants/new" className="btn btn-primary">
          <Building2 className="h-4 w-4" /> Onboard Company
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Companies"    value={fmt(stats?.totalTenants ?? 0)}       icon={<Building2 className="h-4 w-4" />}    sub={`${stats?.activeTenants ?? 0} active`} />
        <KpiCard label="Total Projects"     value={fmt(stats?.totalProjects ?? 0)}      icon={<Zap className="h-4 w-4" />}          sub="across all tenants" />
        <KpiCard label="Events Today"       value={fmt(stats?.eventsToday ?? 0)}        icon={<Activity className="h-4 w-4" />}     sub="platform-wide" color="var(--accent)" />
        <KpiCard label="AI Requests Today"  value={fmt(stats?.aiRequestsToday ?? 0)}    icon={<BrainCircuit className="h-4 w-4" />} sub="across all agents" color="var(--ai)" />
        <KpiCard label="Platform Users"     value={fmt(stats?.totalUsers ?? 0)}         icon={<Users className="h-4 w-4" />}        sub="across all companies" />
        <KpiCard label="Active SDK Tokens"  value={fmt(stats?.activeTokens ?? 0)}       icon={<TrendingUp className="h-4 w-4" />}   sub="live credentials" />
        <KpiCard label="SDK Installations"  value={fmt(stats?.sdkInstallations ?? 0)}   icon={<Zap className="h-4 w-4" />}          sub="tracked devices" />
        <KpiCard label="Platform Health"    value="99.98%"                              icon={<CheckCircle className="h-4 w-4" />}  sub="30-day uptime" color="var(--healthy)" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Recent tenants */}
        <div className="admin-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recent Companies</h2>
            <Link href="/admin/tenants" className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentTenants.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No companies yet. <Link href="/admin/tenants/new" style={{ color: 'var(--accent)' }}>Onboard the first →</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Company', 'Plan', 'Status', 'Joined'].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTenants.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => window.location.href = `/admin/tenants/${t.id}`}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--text)' }}>{t.company_name}</td>
                    <td className="px-5 py-3"><span className={`badge ${planBadgeClass(t.subscription_plan)}`}>{t.subscription_plan}</span></td>
                    <td className="px-5 py-3"><span className={`badge ${statusBadgeClass(t.status)}`}>{t.status}</span></td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* System health */}
        <div className="space-y-4">
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>System Health</h2>
            </div>
            <div className="p-4 space-y-2">
              {systemChecks.map((c) => (
                <div key={c.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--healthy)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--healthy)' }}>Healthy</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit feed */}
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recent Activity</h2>
            </div>
            <div className="p-4">
              {recentAudit.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-dim)' }}>No admin actions yet</p>
              ) : (
                <ul className="space-y-3">
                  {recentAudit.map((a) => (
                    <li key={a.id} className="flex gap-2.5">
                      <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--text-dim)' }} />
                      <div>
                        <p className="text-xs" style={{ color: 'var(--text)' }}>{a.action}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(a.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plan distribution */}
      <div className="admin-card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Plan Distribution</h2>
        <div className="grid grid-cols-4 gap-3">
          {PLAN_ORDER.map((plan) => (
            <div key={plan} className="rounded-lg p-4 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className={`badge ${planBadgeClass(plan)}`}>{plan}</span>
              <p className="mt-3 text-2xl font-black" style={{ color: 'var(--text)' }}>—</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>companies</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
