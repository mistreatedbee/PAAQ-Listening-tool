import Link from 'next/link'
import { PageHeader, Card, ToneBadge, Confidence, StatusDot } from '@/components/kit'
import { incidents } from '@/lib/data'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { AlertTriangle, Users, Clock, ArrowRight, Plus } from 'lucide-react'

const statusTone = {
  Investigating: 'critical',
  Identified: 'warning',
  Monitoring: 'intel',
  Resolved: 'healthy',
} as const

export default function IncidentsPage() {
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
          { l: 'Open', v: '3', t: 'text-critical' },
          { l: 'P1 critical', v: '1', t: 'text-critical' },
          { l: 'Mean time to detect', v: '4m', t: 'text-healthy' },
          { l: 'Mean time to resolve', v: '38m', t: 'text-intel' },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.l}</p>
            <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight', s.t)}>{s.v}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {incidents.map((inc) => (
          <Card key={inc.id} className="p-4 transition-colors hover:border-border">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{inc.id}</span>
                  <ToneBadge tone={inc.severity}>{inc.priority}</ToneBadge>
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <StatusDot tone={statusTone[inc.status]} pulse={inc.status !== 'Resolved'} />
                    <span className={toneText[statusTone[inc.status]]}>{inc.status}</span>
                  </span>
                </div>
                <Link href={`/incidents/${inc.id}`}>
                  <h3 className="mt-2 text-pretty text-base font-semibold text-foreground hover:text-intel">{inc.title}</h3>
                </Link>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{inc.aiSummary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Confidence value={inc.confidence} />
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    <Users className="h-3 w-3" /> {inc.affected}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {inc.started}
                  </span>
                  <ToneBadge tone={inc.severity}>{inc.impact}</ToneBadge>
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
        ))}
      </div>
    </div>
  )
}
