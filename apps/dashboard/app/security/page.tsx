'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Shield, TriangleAlert } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, StatusDot } from '@/components/kit'
import type { Tone } from '@/lib/data'

type DbAnomaly = {
  id: string
  type: string
  severity: string
  detected_pattern: string | null
  confidence: number
  created_at: string
}

type DbError = {
  id: string
  message: string
  severity: string
  status: string
  created_at: string
}

function severityTone(s: string): Tone {
  if (s === 'fatal' || s === 'error' || s === 'critical') return 'critical'
  if (s === 'warning') return 'warning'
  return 'intel'
}

export default function SecurityPage() {
  const { app } = useConnectedApp()
  const [anomalies, setAnomalies] = useState<DbAnomaly[]>([])
  const [errors, setErrors] = useState<DbError[]>([])
  const [counts, setCounts] = useState({ total: 0, open: 0, critical: 0, warning: 0, resolved: 0, anomalies: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    Promise.all([
      sb.from('anomaly_events').select('id, type, severity, detected_pattern, confidence, created_at').eq('project_id', app.id).order('created_at', { ascending: false }).limit(20),
      sb.from('anomaly_events').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('errors').select('id, message, severity, status, created_at').eq('project_id', app.id).order('created_at', { ascending: false }).limit(10),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'open'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).in('severity', ['fatal', 'error']).eq('status', 'open'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('severity', 'warning'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'resolved'),
    ]).then(([{ data: anomalyData }, { count: anomalyCount }, { data: errorData }, { count: total }, { count: open }, { count: critical }, { count: warning }, { count: resolved }]) => {
      setAnomalies((anomalyData ?? []) as DbAnomaly[])
      setErrors((errorData ?? []) as DbError[])
      setCounts({
        total: total ?? 0,
        open: open ?? 0,
        critical: critical ?? 0,
        warning: warning ?? 0,
        resolved: resolved ?? 0,
        anomalies: anomalyCount ?? 0,
      })
      setLoading(false)
    })
  }, [app.id])

  const stats = [
    { label: 'Anomalies detected', value: String(counts.anomalies), tone: (counts.anomalies > 0 ? 'warning' : 'healthy') as Tone },
    { label: 'Open errors', value: String(counts.open), tone: (counts.open > 0 ? 'critical' : 'healthy') as Tone },
    { label: 'Critical / Fatal', value: String(counts.critical), tone: (counts.critical > 0 ? 'critical' : 'healthy') as Tone },
    { label: 'Warnings', value: String(counts.warning), tone: (counts.warning > 0 ? 'warning' : 'healthy') as Tone },
    { label: 'Resolved errors', value: String(counts.resolved), tone: 'healthy' as Tone },
    {
      label: 'Open rate',
      value: counts.total > 0 ? `${((counts.open / counts.total) * 100).toFixed(1)}%` : '0%',
      tone: 'intel' as Tone,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Shield className="h-5 w-5" />}
        title="Security Center"
        desc="Anomaly detection driven by the Security Agent, plus supporting error context."
        actions={
          counts.anomalies > 0
            ? <ToneBadge tone="warning" dot>{counts.anomalies} anomalies</ToneBadge>
            : <ToneBadge tone="healthy" dot>All clear</ToneBadge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</span>
              <StatusDot tone={s.tone} />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHead title="Detected Anomalies" desc="Unusual patterns flagged by AI analysis — error spikes, abandonment surges, and more." />
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : anomalies.length === 0 ? (
          <div className="p-10 text-center">
            <TriangleAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              No anomalies detected yet. Run an AI analysis from AI Insights to check for anomalous patterns.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {anomalies.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ToneBadge tone={severityTone(a.severity)}>{a.severity}</ToneBadge>
                    <span className="text-sm font-medium text-foreground">{a.type}</span>
                  </div>
                  {a.detected_pattern && (
                    <p className="mt-1 text-xs text-muted-foreground">{a.detected_pattern}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">{Math.round(a.confidence * 100)}% confidence</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Error Timeline" desc="Recent errors detected, newest first." />
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : errors.length === 0 ? (
          <div className="p-10 text-center">
            <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">No errors detected yet. Errors appear here automatically once your app is integrated with the PAAQ SDK.</p>
          </div>
        ) : (
          <div className="relative px-5 pb-5">
            <div className="absolute left-[26px] top-0 bottom-5 w-px bg-border" />
            <div className="flex flex-col gap-5">
              {errors.map((ev) => {
                const tone = severityTone(ev.severity)
                return (
                  <div key={ev.id} className="relative flex gap-4 pl-4">
                    <div className="relative z-10 mt-1">
                      <StatusDot tone={tone} pulse={ev.status === 'open'} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{ev.message}</p>
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(ev.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{ev.severity} · {ev.status}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
