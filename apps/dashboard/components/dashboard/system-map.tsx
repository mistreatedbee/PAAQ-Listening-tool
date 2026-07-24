'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, ToneBadge, Meter } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText, toneSoft, toneBg } from '@/lib/tones'
import { Globe, Server, Database, BookOpen, Users, Activity, type LucideIcon } from 'lucide-react'
import type { Tone } from '@/lib/data'

type SystemLayer = {
  id: string
  label: string
  sub: string
  Icon: LucideIcon
  status: 'active' | 'learning' | 'offline'
  coverage: number
  metric: string
  detail: string
  tone: Tone
}

function statusTone(s: SystemLayer['status']): Tone {
  if (s === 'active')   return 'healthy'
  if (s === 'learning') return 'ai'
  return 'intel'
}

export function SystemMap() {
  const { app } = useConnectedApp()
  const [layers, setLayers] = useState<SystemLayer[]>([])
  const [selected, setSelected] = useState<SystemLayer | null>(null)
  const [overallHealth, setOverallHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    Promise.all([
      sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('project_id', app.id),
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved').eq('project_id', app.id),
      sb.from('knowledge_nodes').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('performance_metrics').select('value').eq('metric_type', 'response_time').order('created_at', { ascending: false }).limit(20),
    ]).then(([events, sessions, errors, incidents, knowledge, perf]) => {
      const ev  = events.count ?? 0
      const ses = sessions.count ?? 0
      const er  = errors.count ?? 0
      const inc = incidents.count ?? 0
      const kn  = knowledge.count ?? 0

      const perfVals = (perf.data ?? []).map((r) => r.value as number)
      const avgRt = perfVals.length > 0
        ? Math.round(perfVals.reduce((a, b) => a + b, 0) / perfVals.length)
        : 0

      const fe = app.sdkStatus.frontend === 'connected'
      const be = app.sdkStatus.backend  === 'connected'
      const db = app.sdkStatus.database === 'connected'

      const userCoverage = fe && ev > 0 ? Math.min(100, Math.round((ev / 500) * 100)) : 0
      const apiCoverage  = be ? Math.min(100, Math.round((kn / 30) * 100)) : 0
      const dbCoverage   = db ? 75 : 0
      const knCoverage   = Math.min(100, Math.round((kn / 100) * 100))

      const connectedLayers: SystemLayer[] = [
        {
          id: 'web',
          label: 'Web Application',
          sub: fe ? `${ev.toLocaleString()} interactions captured` : 'SDK not connected',
          Icon: Globe,
          status: fe ? (ev > 0 ? 'active' : 'learning') : 'offline',
          coverage: userCoverage,
          metric: fe ? (ev > 0 ? `${ev.toLocaleString()} events` : 'Awaiting data') : 'Offline',
          detail: fe
            ? ev > 0
              ? `AI has captured ${ev.toLocaleString()} user interactions across ${ses} sessions. Navigation patterns, feature usage, and user workflows are being continuously mapped.`
              : 'Web SDK is connected. AI agents are exploring the application structure and waiting for user interactions to begin mapping workflows.'
            : 'Connect the PAAQ Web SDK to enable user journey intelligence, feature discovery, and interaction analysis.',
          tone: fe ? (ev > 0 ? 'healthy' : 'ai') : 'intel',
        },
        {
          id: 'backend',
          label: 'Backend Services',
          sub: be ? (avgRt > 0 ? `${avgRt}ms avg response` : 'APIs monitored') : 'SDK not connected',
          Icon: Server,
          status: be ? 'active' : 'offline',
          coverage: apiCoverage,
          metric: be ? (avgRt > 0 ? `${avgRt}ms` : 'Monitoring') : 'Offline',
          detail: be
            ? avgRt > 0
              ? `Backend APIs are actively monitored. Average response time: ${avgRt}ms. AI is mapping endpoints, request patterns, and service dependencies.`
              : 'Server SDK connected. AI is discovering API endpoints, schemas, and backend service dependencies.'
            : 'Connect the PAAQ Server SDK to monitor API performance, map backend services, and detect workflow bottlenecks.',
          tone: be ? (avgRt > 500 ? 'warning' : 'healthy') : 'intel',
        },
        {
          id: 'database',
          label: 'Data Layer',
          sub: db ? 'Connector active' : 'Not connected',
          Icon: Database,
          status: db ? 'active' : 'offline',
          coverage: dbCoverage,
          metric: db ? (inc > 0 ? `${inc} risk${inc !== 1 ? 's' : ''}` : 'Healthy') : 'Offline',
          detail: db
            ? `Database connector is active. AI is monitoring data patterns, query performance, and access anomalies. ${inc > 0 ? `${inc} active risk${inc !== 1 ? 's' : ''} detected.` : 'No active risks detected.'}`
            : 'Connect the database connector to enable data intelligence, performance monitoring, and security signal detection.',
          tone: db ? (inc > 0 ? 'warning' : 'healthy') : 'intel',
        },
        {
          id: 'users',
          label: 'User Behaviour',
          sub: ses > 0 ? `${ses.toLocaleString()} sessions recorded` : 'No sessions yet',
          Icon: Users,
          status: ses > 0 ? 'active' : 'learning',
          coverage: Math.min(100, Math.round((ses / 50) * 100)),
          metric: ses > 0 ? `${ses.toLocaleString()} sessions` : 'Learning',
          detail: ses > 0
            ? `${ses.toLocaleString()} user sessions have been recorded and analysed. AI is identifying journey patterns, drop-off points, frustration signals, and workflow gaps.`
            : 'AI agents are waiting for user sessions to begin mapping behaviour patterns and identifying workflow opportunities.',
          tone: ses > 0 ? 'healthy' : 'ai',
        },
        {
          id: 'knowledge',
          label: 'Knowledge Base',
          sub: `${kn} entities discovered`,
          Icon: BookOpen,
          status: kn > 0 ? 'active' : 'learning',
          coverage: knCoverage,
          metric: kn > 0 ? `${kn} entities` : 'Building',
          detail: kn > 0
            ? `${kn} knowledge entities have been discovered and indexed. AI agents continuously expand understanding of features, APIs, workflows, and business processes.`
            : 'AI Knowledge Discovery Agent is beginning to explore and index organisational knowledge. This grows automatically as agents learn.',
          tone: kn > 0 ? 'ai' : 'intel',
        },
        {
          id: 'errors',
          label: 'Error Tracking',
          sub: er > 0 ? `${er} issues detected` : 'No issues detected',
          Icon: Activity,
          status: er > 0 ? (er > 5 ? 'offline' : 'learning') : 'active',
          coverage: er === 0 ? 100 : Math.max(0, 100 - Math.min(100, er * 5)),
          metric: er > 0 ? `${er} issue${er !== 1 ? 's' : ''}` : 'Healthy',
          detail: er > 0
            ? `${er} workflow issue${er !== 1 ? 's' : ''} currently detected. AI is analysing error patterns to identify root causes, affected workflows, and recommended fixes.`
            : 'All monitored workflows are operating normally. AI continues to learn workflow patterns to detect future disruptions early.',
          tone: er > 0 ? (er > 5 ? 'critical' : 'warning') : 'healthy',
        },
      ]

      const hasIssues = inc > 0 || er > 5
      const hasWarning = er > 0
      setOverallHealth(hasIssues ? 'critical' : hasWarning ? 'warning' : 'healthy')
      setLayers(connectedLayers)

      const firstBad = connectedLayers.find((l) => l.tone === 'critical' || l.tone === 'warning')
      setSelected(firstBad ?? connectedLayers[0])
      setLoading(false)
    })
  }, [app.id])

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHead title="Connected Systems" desc="AI learning progress across your organisation's digital ecosystem" />
        <div className="px-5 pb-5">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border/60 bg-card/60" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHead
        title="Connected Systems"
        desc="AI learning progress across your organisation's digital ecosystem"
        action={
          <ToneBadge tone={overallHealth} dot>
            {overallHealth === 'critical' ? 'Issues detected' : overallHealth === 'warning' ? 'Watch' : 'Operating normally'}
          </ToneBadge>
        }
      />
      <div className="px-5 pb-5">
        {/* System layer grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {layers.map((layer) => {
            const tone = statusTone(layer.status)
            const sel = selected?.id === layer.id
            const Icon = layer.Icon
            return (
              <button
                key={layer.id}
                onClick={() => setSelected(layer)}
                className={cn(
                  'group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all',
                  sel
                    ? 'border-intel/40 bg-intel/8 ring-1 ring-intel/20'
                    : 'border-border/60 bg-card/60 hover:border-border hover:bg-accent/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg border',
                    toneSoft[layer.tone],
                  )}>
                    <Icon className={cn('h-3.5 w-3.5', toneText[layer.tone])} />
                  </div>
                  {/* Coverage ring indicator */}
                  <div className="relative flex items-center justify-center">
                    <svg width="20" height="20" className="-rotate-90">
                      <circle cx="10" cy="10" r="7" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                      <circle
                        cx="10" cy="10" r="7"
                        fill="none"
                        stroke={`var(--${layer.tone === 'ai' ? 'ai' : layer.tone === 'healthy' ? 'healthy' : layer.tone === 'warning' ? 'warning' : layer.tone === 'critical' ? 'critical' : 'intel'})`}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 7}`}
                        strokeDashoffset={`${2 * Math.PI * 7 * (1 - layer.coverage / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-foreground leading-tight">{layer.label}</p>
                  <p className={cn('mt-0.5 text-[10px] font-semibold tabular-nums', toneText[layer.tone])}>
                    {layer.metric}
                  </p>
                </div>
                {/* Coverage bar */}
                <div className="space-y-0.5">
                  <Meter value={layer.coverage} tone={layer.tone} />
                  <p className="text-[9px] text-muted-foreground/60">{layer.coverage}% learned</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="mt-3 rounded-xl border border-border/60 bg-background/30 p-4 animate-rise">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={cn('h-2 w-2 rounded-full', toneBg[selected.tone])} />
                <h4 className="text-sm font-semibold text-foreground">{selected.label}</h4>
                <ToneBadge tone={selected.tone}>
                  {selected.status === 'active' ? 'Active' : selected.status === 'learning' ? 'Learning' : 'Offline'}
                </ToneBadge>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{selected.coverage}% AI coverage</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.detail}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Learning progress</span>
                <span className={cn('text-[10px] font-semibold tabular-nums', toneText[selected.tone])}>{selected.coverage}%</span>
              </div>
              <Meter value={selected.coverage} tone={selected.tone} />
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
