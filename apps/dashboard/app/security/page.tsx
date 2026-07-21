'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Shield } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, StatusDot } from '@/components/kit'
import type { Tone } from '@/lib/data'

type DbError = {
  id: string
  message: string
  severity: string
  status: string
  created_at: string
}

function severityTone(s: string): Tone {
  if (s === 'fatal' || s === 'error') return 'critical'
  if (s === 'warning') return 'warning'
  return 'intel'
}

export default function SecurityPage() {
  const [errors, setErrors] = useState<DbError[]>([])
  const [counts, setCounts] = useState({ total: 0, open: 0, critical: 0, warning: 0, resolved: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('errors').select('id, message, severity, status, created_at').order('created_at', { ascending: false }).limit(10),
      sb.from('errors').select('*', { count: 'exact', head: true }),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('errors').select('*', { count: 'exact', head: true }).in('severity', ['fatal', 'error']).eq('status', 'open'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('severity', 'warning'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    ]).then(([{ data }, { count: total }, { count: open }, { count: critical }, { count: warning }, { count: resolved }]) => {
      setErrors((data ?? []) as DbError[])
      setCounts({
        total: total ?? 0,
        open: open ?? 0,
        critical: critical ?? 0,
        warning: warning ?? 0,
        resolved: resolved ?? 0,
      })
      setLoading(false)
    })
  }, [])

  const stats = [
    { label: 'Total errors', value: String(counts.total), tone: 'intel' as Tone },
    { label: 'Open', value: String(counts.open), tone: (counts.open > 0 ? 'critical' : 'healthy') as Tone },
    { label: 'Critical / Fatal', value: String(counts.critical), tone: (counts.critical > 0 ? 'critical' : 'healthy') as Tone },
    { label: 'Warnings', value: String(counts.warning), tone: (counts.warning > 0 ? 'warning' : 'healthy') as Tone },
    { label: 'Resolved', value: String(counts.resolved), tone: 'healthy' as Tone },
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
        desc="Anomaly detection, threat monitoring and automated response driven by the Security Agent."
        actions={
          counts.critical > 0
            ? <ToneBadge tone="critical" dot>Critical issues: {counts.critical}</ToneBadge>
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
