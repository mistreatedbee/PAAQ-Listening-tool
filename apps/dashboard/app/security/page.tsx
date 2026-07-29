'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Shield, TriangleAlert, Radio, CheckCircle2, Lock, AlertCircle } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, StatusDot } from '@/components/kit'
import { cn } from '@/lib/utils'
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
  error_type: string | null
  created_at: string
}

function severityTone(s: string): Tone {
  if (s === 'fatal' || s === 'error' || s === 'critical') return 'critical'
  if (s === 'warning') return 'warning'
  return 'intel'
}

function computeHealthScore(params: {
  totalErrors: number
  openErrors: number
  criticalErrors: number
  anomalies: number
  resolvedErrors: number
}): { score: number; label: string; tone: Tone } {
  const { totalErrors, openErrors, criticalErrors, anomalies, resolvedErrors } = params

  if (totalErrors === 0 && anomalies === 0) return { score: 100, label: 'No issues detected', tone: 'healthy' }

  let score = 100

  // Critical / fatal errors: -15 each, capped at -60
  score -= Math.min(criticalErrors * 15, 60)

  // Open errors: -5 each, capped at -25
  score -= Math.min(openErrors * 5, 25)

  // Anomalies: -10 each, capped at -20
  score -= Math.min(anomalies * 10, 20)

  // Resolved errors add back small amount (shows active remediation)
  score += Math.min(resolvedErrors * 2, 10)

  score = Math.max(0, Math.min(100, Math.round(score)))

  const label = score >= 90 ? 'Excellent'
    : score >= 75 ? 'Good'
    : score >= 50 ? 'Fair'
    : score >= 25 ? 'Needs attention'
    : 'Critical'

  const tone: Tone = score >= 75 ? 'healthy' : score >= 50 ? 'warning' : 'critical'

  return { score, label, tone }
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// Classify errors that look security-related
function isSecurityError(e: DbError) {
  const combined = `${e.error_type ?? ''} ${e.message}`.toLowerCase()
  return /auth|login|permission|unauthori|forbid|token|credential|password|session|csrf|cors|ssl|tls|cert|secret|rate.?limit|block/.test(combined)
}

export default function SecurityPage() {
  const { app } = useConnectedApp()
  const [anomalies, setAnomalies] = useState<DbAnomaly[]>([])
  const [errors, setErrors] = useState<DbError[]>([])
  const [securityErrors, setSecurityErrors] = useState<DbError[]>([])
  const [counts, setCounts] = useState({ total: 0, open: 0, critical: 0, warning: 0, resolved: 0, anomalies: 0 })
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    const load = async () => {
      const [
        { data: aData, count: aCount },
        { data: eData, count: total },
        { count: open },
        { count: critical },
        { count: warning },
        { count: resolved },
      ] = await Promise.all([
        sb.from('anomaly_events').select('id, type, severity, detected_pattern, confidence, created_at', { count: 'exact' }).eq('project_id', app.id).order('created_at', { ascending: false }).limit(20),
        sb.from('errors').select('id, message, severity, status, error_type, created_at', { count: 'exact' }).eq('project_id', app.id).order('created_at', { ascending: false }).limit(50),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'open'),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).in('severity', ['fatal', 'error']).eq('status', 'open'),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('severity', 'warning'),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'resolved'),
      ])

      const allErrors = (eData ?? []) as DbError[]
      setAnomalies((aData ?? []) as DbAnomaly[])
      setErrors(allErrors.slice(0, 10))
      setSecurityErrors(allErrors.filter(isSecurityError).slice(0, 10))
      setCounts({ total: total ?? 0, open: open ?? 0, critical: critical ?? 0, warning: warning ?? 0, resolved: resolved ?? 0, anomalies: aCount ?? 0 })
      setLoading(false)
    }

    load()

    const channel = sb
      .channel(`security-live:${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anomaly_events', filter: `project_id=eq.${app.id}` },
        (payload) => {
          setAnomalies((prev) => [payload.new as DbAnomaly, ...prev].slice(0, 20))
          setCounts((prev) => ({ ...prev, anomalies: prev.anomalies + 1 }))
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'errors', filter: `project_id=eq.${app.id}` },
        () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'errors', filter: `project_id=eq.${app.id}` },
        () => load())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => { sb.removeChannel(channel) }
  }, [app.id])

  const health = computeHealthScore({
    totalErrors: counts.total,
    openErrors: counts.open,
    criticalErrors: counts.critical,
    anomalies: counts.anomalies,
    resolvedErrors: counts.resolved,
  })

  const stats: { label: string; value: string; tone: Tone }[] = [
    { label: 'Open errors',      value: String(counts.open),     tone: counts.open > 0 ? 'critical' : 'healthy' },
    { label: 'Critical / Fatal', value: String(counts.critical), tone: counts.critical > 0 ? 'critical' : 'healthy' },
    { label: 'Warnings',         value: String(counts.warning),  tone: counts.warning > 0 ? 'warning' : 'healthy' },
    { label: 'Resolved',         value: String(counts.resolved), tone: 'healthy' },
    { label: 'Anomalies',        value: String(counts.anomalies), tone: counts.anomalies > 0 ? 'warning' : 'healthy' },
    {
      label: 'Security events',
      value: String(securityErrors.length),
      tone: securityErrors.length > 0 ? 'warning' : 'healthy',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Shield className="h-5 w-5" />}
        title="Security Centre"
        desc="Anomaly detection, security-related errors, and real-time threat monitoring."
        actions={
          <div className="flex items-center gap-2">
            {live && (
              <span className="flex items-center gap-1.5 rounded-full border border-healthy/25 bg-healthy/10 px-2.5 py-1 text-[10px] font-semibold text-healthy">
                <Radio className="h-3 w-3 animate-pulse" /> LIVE
              </span>
            )}
            <ToneBadge tone={health.tone} dot>{health.label}</ToneBadge>
          </div>
        }
      />

      {/* Health Score */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Score ring */}
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-border/40" />
                <circle
                  cx="40" cy="40" r="34" fill="none" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - health.score / 100)}`}
                  className={cn(
                    'transition-all duration-700',
                    health.tone === 'healthy' ? 'stroke-healthy' : health.tone === 'warning' ? 'stroke-warning' : 'stroke-critical',
                  )}
                />
              </svg>
              <span className={cn('text-xl font-bold tabular-nums', health.tone === 'healthy' ? 'text-healthy' : health.tone === 'warning' ? 'text-warning' : 'text-critical')}>
                {loading ? '–' : health.score}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Security Health Score</p>
              <p className="text-xs text-muted-foreground mt-0.5">{health.label}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Based on open errors, critical incidents, and anomalies
              </p>
            </div>
          </div>

          {/* Quick verdict */}
          <div className="flex flex-col gap-1.5">
            {[
              { ok: counts.critical === 0,   label: 'No critical/fatal errors' },
              { ok: counts.anomalies === 0,  label: 'No anomalies detected' },
              { ok: securityErrors.length === 0, label: 'No security-related errors' },
              { ok: counts.open === 0,        label: 'All errors resolved' },
            ].map((check) => (
              <div key={check.label} className="flex items-center gap-2">
                {check.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-healthy shrink-0" />
                  : <AlertCircle   className="h-3.5 w-3.5 text-warning shrink-0" />
                }
                <span className={cn('text-xs', check.ok ? 'text-muted-foreground' : 'text-foreground font-medium')}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{loading ? '–' : s.value}</span>
              <StatusDot tone={s.tone} />
            </div>
          </Card>
        ))}
      </div>

      {/* Security-related errors */}
      {securityErrors.length > 0 && (
        <Card>
          <CardHead
            title="Security-Related Errors"
            desc="Auth failures, permission errors, rate limiting, and credential issues detected by AI."
          />
          <div className="divide-y divide-border/50">
            {securityErrors.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-5 py-3.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ToneBadge tone={severityTone(e.severity)}>{e.severity}</ToneBadge>
                    {e.error_type && <span className="text-[10px] text-muted-foreground">{e.error_type}</span>}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-sm text-foreground">{e.message}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(e.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Anomalies */}
      <Card>
        <CardHead title="Detected Anomalies" desc="Unusual patterns flagged by AI analysis — error spikes, abandonment surges, and more." />
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : anomalies.length === 0 ? (
          <div className="p-10 text-center">
            <TriangleAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              No anomalies detected. Run AI Analysis from the User Journey page to check for unusual patterns.
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
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Error timeline */}
      <Card>
        <CardHead title="Recent Error Timeline" desc="Latest errors — auth, performance, and runtime failures." />
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : errors.length === 0 ? (
          <div className="p-10 text-center">
            <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">No errors detected — your application looks clean.</p>
          </div>
        ) : (
          <div className="relative px-5 pb-5">
            <div className="absolute left-[26px] top-0 bottom-5 w-px bg-border" />
            <div className="flex flex-col gap-4">
              {errors.map((ev) => {
                const tone = severityTone(ev.severity)
                const isSec = isSecurityError(ev)
                return (
                  <div key={ev.id} className="relative flex gap-4 pl-4">
                    <div className="relative z-10 mt-1">
                      <StatusDot tone={tone} pulse={ev.status === 'open'} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground">{ev.message}</p>
                          {isSec && <Lock className="h-3 w-3 text-warning shrink-0" />}
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{timeAgo(ev.created_at)}</span>
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
