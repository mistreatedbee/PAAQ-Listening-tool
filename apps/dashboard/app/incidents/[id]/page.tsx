'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge, ProgressRing } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneBg, toneText } from '@/lib/tones'
import { ArrowLeft, Wrench, Ticket, Bell, CheckCircle2, Sparkles, ListChecks, Terminal, Clock } from 'lucide-react'
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

function ActionBtn({ icon, label, primary }: { icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button className={cn(
      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
      primary ? 'bg-ai text-ai-foreground hover:opacity-90' : 'border border-border/70 bg-card/60 text-foreground hover:bg-accent',
    )}>
      {icon}{label}
    </button>
  )
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [inc, setInc] = useState<DbIncident | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('incidents').select('id, title, description, ai_summary, severity, status, created_at').eq('id', id).single()
      .then(({ data }) => {
        setInc(data as DbIncident | null)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
  }
  if (!inc) {
    return (
      <div className="space-y-4">
        <Link href="/incidents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All incidents
        </Link>
        <p className="text-muted-foreground">Incident not found.</p>
      </div>
    )
  }

  const tone = severityTone(inc.severity)
  const sTone = STATUS_TONE[inc.status] ?? 'intel'
  const started = new Date(inc.created_at).toLocaleString()

  return (
    <div className="space-y-6">
      <Link href="/incidents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All incidents
      </Link>

      <PageHeader
        title={inc.title}
        desc={`${inc.id.slice(0, 8)}… · ${inc.severity} · ${inc.status} · ${started}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionBtn icon={<Wrench className="h-4 w-4" />} label="Generate fix" primary />
            <ActionBtn icon={<Ticket className="h-4 w-4" />} label="Jira ticket" />
            <ActionBtn icon={<Bell className="h-4 w-4" />} label="Notify" />
            <ActionBtn icon={<CheckCircle2 className="h-4 w-4" />} label="Resolve" />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Severity</p>
          <div className="mt-2"><ToneBadge tone={tone}>{inc.severity}</ToneBadge></div>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className={cn('mt-2 text-sm font-semibold', toneText[sTone])}>{inc.status}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Opened</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{started}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-ai/25 bg-ai/[0.04]">
            <CardHead
              title="AI Summary"
              desc="Autonomous analysis"
              icon={<Sparkles className="h-4 w-4 text-ai" />}
            />
            <div className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-foreground">
                {inc.ai_summary ?? inc.description ?? 'No AI analysis available yet.'}
              </p>
              {inc.description && inc.ai_summary && (
                <div className="mt-4 rounded-lg border border-ai/20 bg-ai/[0.06] p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ai">
                    <ListChecks className="h-3.5 w-3.5" /> Description
                  </p>
                  <p className="mt-1.5 text-sm text-foreground">{inc.description}</p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Timeline" desc="Key events" />
            <div className="px-5 pb-5">
              <ol className="relative border-l border-border/60 pl-5">
                <li className="relative mb-5 last:mb-0">
                  <span className={cn('absolute -left-[27px] mt-0.5 h-3 w-3 rounded-full ring-4 ring-background', toneBg[sTone])} />
                  <p className="font-mono text-[11px] text-muted-foreground">{started}</p>
                  <p className="mt-0.5 text-sm text-foreground">Incident opened — {inc.severity} severity</p>
                </li>
                {inc.status !== 'open' && (
                  <li className="relative last:mb-0">
                    <span className={cn('absolute -left-[27px] mt-0.5 h-3 w-3 rounded-full ring-4 ring-background', toneBg[sTone])} />
                    <p className="font-mono text-[11px] text-muted-foreground">Current</p>
                    <p className="mt-0.5 text-sm text-foreground">Status updated to {inc.status}</p>
                  </li>
                )}
              </ol>
            </div>
          </Card>

          <Card>
            <CardHead title="Raw details" icon={<Terminal className="h-4 w-4" />} />
            <div className="px-5 pb-5">
              <div className="rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs">
                {[
                  { k: 'id', v: inc.id },
                  { k: 'title', v: inc.title },
                  { k: 'severity', v: inc.severity },
                  { k: 'status', v: inc.status },
                  { k: 'created_at', v: started },
                ].map((l) => (
                  <div key={l.k} className="flex gap-3 py-0.5">
                    <span className="w-28 shrink-0 text-muted-foreground">{l.k}</span>
                    <span className="break-all text-foreground/90">{l.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="flex flex-col items-center p-6">
            <ProgressRing value={inc.status === 'resolved' ? 100 : inc.status === 'monitoring' ? 75 : 60} tone="ai" size={96} stroke={7} label="confidence" />
            <p className="mt-3 text-center text-sm font-medium text-foreground">AI diagnostic certainty</p>
            <p className="mt-1 text-center text-xs text-muted-foreground">Based on available signals</p>
          </Card>

          <Card>
            <CardHead title="Quick info" />
            <div className="space-y-3 px-5 pb-5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Opened {started}</span>
              </div>
              <div className="flex items-center gap-2">
                <ToneBadge tone={tone}>{inc.severity}</ToneBadge>
                <ToneBadge tone={STATUS_TONE[inc.status] ?? 'intel'}>{inc.status}</ToneBadge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
