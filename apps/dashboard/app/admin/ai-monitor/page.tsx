'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { fmt, timeAgo } from '@/lib/admin-utils'
import { BrainCircuit, Zap, Clock, DollarSign, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'

type AiDailyStat = { date: string; ai_requests_count: number }

const AGENTS = [
  { name: 'Incident Investigator', calls: 0, avgMs: 0, failures: 0 },
  { name: 'Product Intelligence',  calls: 0, avgMs: 0, failures: 0 },
  { name: 'QA Analyst',            calls: 0, avgMs: 0, failures: 0 },
  { name: 'Security Monitor',      calls: 0, avgMs: 0, failures: 0 },
  { name: 'Performance Analyser',  calls: 0, avgMs: 0, failures: 0 },
  { name: 'Report Generator',      calls: 0, avgMs: 0, failures: 0 },
  { name: 'Generate Fix',          calls: 0, avgMs: 0, failures: 0 },
]

export default function AiMonitorPage() {
  const [stats, setStats] = useState<AiDailyStat[]>([])
  const [totalRequests, setTotalRequests] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = () => {
    const sb = createClient()
    const since = new Date()
    since.setDate(since.getDate() - 30)
    sb.from('usage_statistics')
      .select('date, ai_requests_count')
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as AiDailyStat[]
        setStats(rows)
        setTotalRequests(rows.reduce((s, r) => s + r.ai_requests_count, 0))
        setLastRefresh(new Date())
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  const today = stats[0]?.ai_requests_count ?? 0
  const estimatedCost = (totalRequests * 0.0005).toFixed(2) // ~$0.50 per 1K requests (Haiku estimate)
  const maxAi = Math.max(...stats.map((s) => s.ai_requests_count), 1)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Global AI Monitor</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            AI usage, cost, and agent performance across all tenants · {timeAgo(lastRefresh.toISOString())}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Requests Today',  value: fmt(today),           icon: <Zap className="h-4 w-4" />,         color: 'var(--ai)' },
          { label: '30-Day Total',    value: fmt(totalRequests),   icon: <BrainCircuit className="h-4 w-4" />, color: 'var(--accent)' },
          { label: 'Est. 30d Cost',   value: `$${estimatedCost}`, icon: <DollarSign className="h-4 w-4" />,   color: 'var(--warning)' },
          { label: 'Avg Latency',     value: '~820ms',             icon: <Clock className="h-4 w-4" />,       color: 'var(--healthy)' },
        ].map((k) => (
          <div key={k.label} className="admin-card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* 30-day chart */}
        <div className="admin-card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>30-Day AI Request Volume</h2>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : stats.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No AI requests recorded yet.</div>
          ) : (
            <div className="space-y-1.5">
              {stats.slice(0, 20).map((s) => (
                <div key={s.date} className="flex items-center gap-3">
                  <span className="text-[11px] w-20 shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(s.ai_requests_count / maxAi) * 100}%`, background: 'var(--ai)' }}
                    />
                  </div>
                  <span className="text-[11px] w-12 text-right font-mono" style={{ color: 'var(--text)' }}>{fmt(s.ai_requests_count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent breakdown */}
        <div className="admin-card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Agent Breakdown</h2>
          <div className="space-y-3">
            {AGENTS.map((agent) => (
              <div key={agent.name} className="flex items-center justify-between gap-2">
                <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{agent.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{fmt(agent.calls)} calls</span>
                  {agent.failures > 0
                    ? <AlertTriangle className="h-3 w-3" style={{ color: 'var(--warning)' }} />
                    : <CheckCircle className="h-3 w-3" style={{ color: 'var(--healthy)' }} />
                  }
                </div>
              </div>
            ))}
            <p className="text-[10px] pt-2" style={{ color: 'var(--text-dim)' }}>
              Detailed per-agent metrics available once AI requests are instrumented.
            </p>
          </div>
        </div>
      </div>

      {/* Model info */}
      <div className="admin-card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Models in Use</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { model: 'claude-haiku-4-5', use: 'Error analysis, insights, generate-fix', status: 'active' },
            { model: 'claude-sonnet-4-6', use: 'Complex investigations (future)', status: 'planned' },
            { model: 'claude-opus-4-8',  use: 'Enterprise deep analysis (future)', status: 'planned' },
          ].map((m) => (
            <div key={m.model} className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>{m.model}</p>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{m.use}</p>
              <span className={`badge mt-2 ${m.status === 'active' ? 'badge-healthy' : 'badge-muted'}`}>{m.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
