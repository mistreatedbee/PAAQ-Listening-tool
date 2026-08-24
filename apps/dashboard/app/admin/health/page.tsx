'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, HelpCircle } from 'lucide-react'

type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'checking' | 'not_monitored'

type Service = {
  name: string
  category: string
  status: ServiceStatus
  latencyMs?: number
  note?: string
}

export default function SystemHealthPage() {
  const [services, setServices] = useState<Service[]>([])
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [checking, setChecking] = useState(true)

  const checkHealth = async () => {
    setChecking(true)
    const sb = createClient()

    const checking_: Service[] = [
      { name: 'Database (Postgres)', category: 'Core Infrastructure', status: 'checking' },
      { name: 'Realtime',            category: 'Core Infrastructure', status: 'checking' },
      { name: 'Storage',             category: 'Core Infrastructure', status: 'checking' },
      { name: 'Auth',                category: 'Core Infrastructure', status: 'checking' },
      { name: 'Edge Functions',      category: 'Compute',             status: 'checking' },
      { name: 'OpenRouter AI',       category: 'AI Services',         status: 'checking' },
      { name: 'Stripe Webhooks',     category: 'Integrations',        status: 'not_monitored', note: 'No Stripe integration found in this codebase' },
      { name: 'Agora SDK',           category: 'Integrations',        status: 'not_monitored', note: 'No Agora integration found in this codebase' },
      { name: 'Next.js Dashboard',   category: 'Applications',        status: 'healthy', note: 'You are viewing this page right now' },
      { name: 'Admin Platform',      category: 'Applications',        status: 'healthy', note: 'This app' },
    ]
    setServices(checking_)

    // Real probe: Supabase database, measured from the browser.
    const dbStart = Date.now()
    const { error: dbErr } = await sb.from('tenants').select('id').limit(1)
    const dbMs = Date.now() - dbStart

    // Real probes, run server-side (avoids exposing service-role-only checks
    // like Auth settings / the AI provider key to the browser).
    const edgeStart = Date.now()
    const { data: remote, error: remoteErr } = await sb.functions.invoke('platform-health', { body: {} })
    const edgeMs = Date.now() - edgeStart

    const statusFor = (probe?: { ok: boolean }): ServiceStatus =>
      !probe ? 'down' : probe.ok ? 'healthy' : 'down'

    const results: Service[] = [
      { name: 'Database (Postgres)', category: 'Core Infrastructure', status: dbErr ? 'down' : 'healthy', latencyMs: dbMs },
      { name: 'Realtime',            category: 'Core Infrastructure', status: statusFor(remote?.realtime), latencyMs: remote?.realtime?.latencyMs, note: remote?.realtime?.error },
      { name: 'Storage',             category: 'Core Infrastructure', status: statusFor(remote?.storage),  latencyMs: remote?.storage?.latencyMs,  note: remote?.storage?.error },
      { name: 'Auth',                category: 'Core Infrastructure', status: statusFor(remote?.auth),      latencyMs: remote?.auth?.latencyMs,      note: remote?.auth?.error },
      { name: 'Edge Functions',      category: 'Compute',             status: remoteErr ? 'down' : 'healthy', latencyMs: edgeMs, note: remoteErr?.message },
      { name: 'OpenRouter AI',       category: 'AI Services',         status: statusFor(remote?.ai),        latencyMs: remote?.ai?.latencyMs,       note: remote?.ai?.error ?? 'openrouter.ai API' },
      { name: 'Stripe Webhooks',     category: 'Integrations',        status: 'not_monitored', note: 'No Stripe integration found in this codebase' },
      { name: 'Agora SDK',           category: 'Integrations',        status: 'not_monitored', note: 'No Agora integration found in this codebase' },
      { name: 'Next.js Dashboard',   category: 'Applications',        status: 'healthy', note: 'You are viewing this page right now' },
      { name: 'Admin Platform',      category: 'Applications',        status: 'healthy', note: 'This app' },
    ]

    setServices(results)
    setLastCheck(new Date())
    setChecking(false)
  }

  useEffect(() => { checkHealth() }, [])

  const categories = [...new Set(services.map((s) => s.category))]
  const monitored = services.filter((s) => s.status !== 'not_monitored')
  const allHealthy = monitored.every((s) => s.status === 'healthy')
  const anyDown = monitored.some((s) => s.status === 'down')

  const StatusIcon = ({ status }: { status: ServiceStatus }) => {
    if (status === 'healthy')       return <CheckCircle className="h-4 w-4"   style={{ color: 'var(--healthy)' }} />
    if (status === 'degraded')      return <AlertTriangle className="h-4 w-4" style={{ color: 'var(--warning)' }} />
    if (status === 'down')          return <XCircle className="h-4 w-4"       style={{ color: 'var(--critical)' }} />
    if (status === 'not_monitored') return <HelpCircle className="h-4 w-4"    style={{ color: 'var(--text-dim)' }} />
    return <Clock className="h-4 w-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>System Health</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Live infrastructure status{lastCheck ? ` · checked ${new Date(lastCheck).toLocaleTimeString()}` : ''}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={checkHealth} disabled={checking}>
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Recheck
        </button>
      </div>

      {/* Overall status banner */}
      <div
        className="rounded-xl px-5 py-4 flex items-center gap-3"
        style={{
          background: anyDown ? 'color-mix(in oklch, var(--critical) 8%, transparent)' : allHealthy ? 'color-mix(in oklch, var(--healthy) 8%, transparent)' : 'color-mix(in oklch, var(--warning) 8%, transparent)',
          border: `1px solid ${anyDown ? 'color-mix(in oklch, var(--critical) 25%, transparent)' : allHealthy ? 'color-mix(in oklch, var(--healthy) 25%, transparent)' : 'color-mix(in oklch, var(--warning) 25%, transparent)'}`,
        }}
      >
        {anyDown ? <XCircle className="h-5 w-5" style={{ color: 'var(--critical)' }} />
          : allHealthy ? <CheckCircle className="h-5 w-5" style={{ color: 'var(--healthy)' }} />
          : <AlertTriangle className="h-5 w-5" style={{ color: 'var(--warning)' }} />}
        <div>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>
            {anyDown ? 'Platform Incident Detected' : allHealthy ? 'All Monitored Systems Operational' : 'Partial Degradation'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {monitored.filter((s) => s.status === 'healthy').length} of {monitored.length} monitored services healthy
            {services.length > monitored.length ? ` · ${services.length - monitored.length} not monitored` : ''}
          </p>
        </div>
      </div>

      {/* Services by category */}
      {categories.map((cat) => (
        <div key={cat} className="admin-card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{cat}</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {services.filter((s) => s.category === cat).map((svc) => (
              <div key={svc.name} className="flex items-center gap-4 px-5 py-3.5">
                <StatusIcon status={svc.status} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{svc.name}</p>
                  {svc.note && <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{svc.note}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  {svc.latencyMs !== undefined && (
                    <span style={{ color: svc.latencyMs > 500 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {svc.latencyMs}ms
                    </span>
                  )}
                  <span className={`badge ${svc.status === 'healthy' ? 'badge-healthy' : svc.status === 'degraded' ? 'badge-warning' : svc.status === 'down' ? 'badge-critical' : 'badge-muted'}`}>
                    {svc.status === 'checking' ? 'checking…' : svc.status === 'not_monitored' ? 'not monitored' : svc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
