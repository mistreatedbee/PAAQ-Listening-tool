'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, ToneBadge, StatusDot } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { AlertTriangle, Clock, ArrowRight, Plus } from 'lucide-react'
import type { Tone } from '@/lib/data'

type DbIncident = {
  id: string
  title: string
  description: string | null
  ai_summary: string | null
  severity: string
  status: string
  created_at: string
}

function severityTone(s: string): Tone {
  if (s === 'critical' || s === 'high') return 'critical'
  if (s === 'medium') return 'warning'
  return 'intel'
}

const STATUS_TONE: Record<string, Tone> = {
  open: 'critical', investigating: 'critical', identified: 'warning',
  monitoring: 'intel', resolved: 'healthy',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', investigating: 'Investigating', identified: 'Identified',
  monitoring: 'Monitoring', resolved: 'Resolved',
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<DbIncident[]>([])
  const [counts, setCounts] = useState({ open: 0, critical: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('incidents')
        .select('id, title, description, ai_summary, severity, status, created_at')
        .order('created_at', { ascending: false }),
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
      sb.from('incidents').select('*', { count: 'exact', head: true }).eq('severity', 'critical').neq('status', 'resolved'),
    ]).then(([{ data }, { count: open }, { count: critical }]) => {
      setIncidents((data ?? []) as DbIncident[])
      setCounts({ open: open ?? 0, critical: critical ?? 0 })
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<AlertTriangle className="h-5 w-5 text-critical" />}
        title="Incident Management"
        desc="Active incidents with AI-generated root cause, business impact and one-click resolution actions."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Declare incident
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Open', v: String(counts.open), t: 'text-critical' },
          { l: 'Critical', v: String(counts.critical), t: 'text-critical' },
          { l: 'Mean detect', v: '4m', t: 'text-healthy' },
          { l: 'Mean resolve', v: '38m', t: 'text-intel' },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.l}</p>
            <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight', s.t)}>{s.v}</p>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : incidents.length === 0 ? (
        <Card className="p-10 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No incidents yet. Run database/seed.sql to add demo data.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const tone = severityTone(inc.severity)
            const sTone = STATUS_TONE[inc.status] ?? 'intel'
            const sLabel = STATUS_LABEL[inc.status] ?? inc.status
            return (
              <Card key={inc.id} className="p-4 transition-colors hover:border-border">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{inc.id.slice(0, 8)}…</span>
                      <ToneBadge tone={tone}>{inc.severity}</ToneBadge>
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <StatusDot tone={sTone} pulse={inc.status !== 'resolved'} />
                        <span className={toneText[sTone]}>{sLabel}</span>
                      </span>
                    </div>
                    <Link href={`/incidents/${inc.id}`}>
                      <h3 className="mt-2 text-pretty text-base font-semibold text-foreground hover:text-intel">{inc.title}</h3>
                    </Link>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {inc.ai_summary ?? inc.description ?? 'No summary available.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {new Date(inc.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 lg:w-56 lg:flex-col">
                    <Link
                      href={`/incidents/${inc.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-xs font-medium text-ai-foreground hover:opacity-90"
                    >
                      Investigate <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button className="inline-flex flex-1 items-center justify-center rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
                      Generate fix
                    </button>
                    <button className="inline-flex flex-1 items-center justify-center rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
                      Notify team
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
