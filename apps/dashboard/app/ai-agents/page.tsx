'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import {
  Bot, AlertTriangle, Search, Users, Target, Layers, BarChart3,
  Shield, Zap, CheckCircle2, Clock, Loader2,
} from 'lucide-react'
import type { Tone } from '@/lib/data'

type AgentTask = {
  agent_name: string
  status: string
  duration_ms: number | null
  created_at: string
  completed_at: string | null
}

type AgentDef = {
  name: string
  label: string
  description: string
  icon: React.ReactNode
  specialty: string
}

const AGENT_DEFS: AgentDef[] = [
  {
    name: 'incident',
    label: 'Incident Agent',
    description: 'Builds investigation timelines, identifies affected services, and determines blast radius.',
    icon: <AlertTriangle className="h-5 w-5 text-critical" />,
    specialty: 'Incident response',
  },
  {
    name: 'root_cause',
    label: 'Root Cause Agent',
    description: 'Correlates errors, deployments, infrastructure changes, and user behavior to determine why something failed.',
    icon: <Search className="h-5 w-5 text-warning" />,
    specialty: 'Causal analysis',
  },
  {
    name: 'product',
    label: 'Product Analyst',
    description: 'Acts as a senior PM — analyses feature adoption, drop-off, journey completion and product health.',
    icon: <Users className="h-5 w-5 text-ai" />,
    specialty: 'Product intelligence',
  },
  {
    name: 'ux',
    label: 'UX Intelligence Agent',
    description: 'Detects friction points, rage clicks, excessive backtracking, and confusing flows.',
    icon: <Target className="h-5 w-5 text-intel" />,
    specialty: 'Experience analysis',
  },
  {
    name: 'qa',
    label: 'QA Intelligence Agent',
    description: 'Identifies regressions, newly introduced bugs, and previously resolved issues that have reappeared.',
    icon: <Layers className="h-5 w-5 text-intel" />,
    specialty: 'Quality assurance',
  },
  {
    name: 'performance',
    label: 'Performance Agent',
    description: 'Monitors API latency, rendering, memory, and CPU. Predicts degradation before it affects users.',
    icon: <BarChart3 className="h-5 w-5 text-healthy" />,
    specialty: 'Predictive monitoring',
  },
  {
    name: 'security',
    label: 'Security Agent',
    description: 'Watches for suspicious logins, permission abuse, API misuse, and data anomalies.',
    icon: <Shield className="h-5 w-5 text-warning" />,
    specialty: 'Threat detection',
  },
  {
    name: 'executive',
    label: 'Executive Agent',
    description: 'Translates technical events into plain-language business summaries for leadership.',
    icon: <Zap className="h-5 w-5 text-ai" />,
    specialty: 'Business reporting',
  },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AgentCenterPage() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('agent_tasks')
      .select('agent_name, status, duration_ms, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setTasks((data ?? []) as AgentTask[])
        setLoading(false)
      })
  }, [])

  // Latest task per agent
  const latestByAgent: Record<string, AgentTask> = {}
  for (const task of tasks) {
    if (!latestByAgent[task.agent_name]) {
      latestByAgent[task.agent_name] = task
    }
  }

  // Aggregate stats per agent
  const statsByAgent: Record<string, { total: number; avgMs: number | null }> = {}
  for (const task of tasks) {
    if (!statsByAgent[task.agent_name]) statsByAgent[task.agent_name] = { total: 0, avgMs: null }
    statsByAgent[task.agent_name].total++
  }
  for (const name of Object.keys(statsByAgent)) {
    const agentTasks = tasks.filter((t) => t.agent_name === name && t.duration_ms != null)
    if (agentTasks.length > 0) {
      statsByAgent[name].avgMs = Math.round(
        agentTasks.reduce((a, t) => a + (t.duration_ms ?? 0), 0) / agentTasks.length,
      )
    }
  }

  const totalRuns = tasks.length
  const activeAgents = Object.keys(latestByAgent).length
  const avgDuration = tasks.filter((t) => t.duration_ms != null).length
    ? Math.round(
        tasks.filter((t) => t.duration_ms != null).reduce((a, t) => a + (t.duration_ms ?? 0), 0) /
          tasks.filter((t) => t.duration_ms != null).length,
      )
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Bot className="h-5 w-5 text-ai" />}
        title="Agent Center"
        desc="8 specialist agents continuously investigate, analyse and report. Each is dispatched by the investigation orchestrator."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Registered agents', v: '8', t: 'text-foreground' },
          { l: 'Active agents', v: String(activeAgents), t: 'text-healthy' },
          { l: 'Total runs', v: String(totalRuns), t: 'text-ai' },
          { l: 'Avg run time', v: avgDuration != null ? `${(avgDuration / 1000).toFixed(1)}s` : '—', t: 'text-intel' },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.l}</p>
            <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight', s.t)}>{s.v}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {AGENT_DEFS.map((agent) => {
          const latest = latestByAgent[agent.name]
          const stats = statsByAgent[agent.name]
          const hasData = !!latest
          const isRunning = latest?.status === 'running'

          return (
            <Card key={agent.name} className={cn('p-5', isRunning && 'border-ai/30 bg-ai/[0.02]')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card/60">
                    {agent.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{agent.label}</p>
                    <p className="text-[10px] text-muted-foreground">{agent.specialty}</p>
                  </div>
                </div>
                {isRunning && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ai" />}
                {hasData && !isRunning && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-healthy" />}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{agent.description}</p>

              <div className="mt-4 space-y-1.5">
                {hasData ? (
                  <>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Status</span>
                      <ToneBadge tone={latest.status === 'complete' ? 'healthy' : latest.status === 'running' ? 'warning' : 'critical'}>
                        {latest.status}
                      </ToneBadge>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Last run</span>
                      <span className="text-foreground">{timeAgo(latest.created_at)}</span>
                    </div>
                    {stats && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Total runs</span>
                        <span className="font-semibold text-foreground">{stats.total}</span>
                      </div>
                    )}
                    {stats?.avgMs != null && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Avg time</span>
                        <span className="text-foreground">{(stats.avgMs / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Standby — trigger an investigation to activate</span>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {tasks.length > 0 && (
        <Card>
          <div className="border-b border-border/60 px-5 py-3">
            <p className="text-sm font-semibold text-foreground">Recent agent activity</p>
          </div>
          <ul className="divide-y divide-border/40">
            {tasks.slice(0, 12).map((task, i) => {
              const def = AGENT_DEFS.find((d) => d.name === task.agent_name)
              return (
                <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/60">
                    {def?.icon ?? <Bot className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">{def?.label ?? task.agent_name}</span>
                    {task.duration_ms != null && (
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {(task.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  <ToneBadge tone={task.status === 'complete' ? 'healthy' : task.status === 'running' ? 'warning' : 'critical'}>
                    {task.status}
                  </ToneBadge>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(task.created_at)}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
