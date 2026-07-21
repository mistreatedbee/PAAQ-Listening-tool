import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader, Card, CardHead, ToneBadge, Confidence, ProgressRing } from '@/components/kit'
import { incidents } from '@/lib/data'
import { cn } from '@/lib/utils'
import { toneBg, toneText } from '@/lib/tones'
import {
  ArrowLeft,
  Wrench,
  Ticket,
  Bell,
  UserPlus,
  CheckCircle2,
  Sparkles,
  ListChecks,
  Terminal,
} from 'lucide-react'

const statusTone = {
  Investigating: 'critical',
  Identified: 'warning',
  Monitoring: 'intel',
  Resolved: 'healthy',
} as const

const logLines = [
  { t: '09:12:04', lvl: 'INFO', msg: 'deploy #1482 promoted to production (storage-svc)', tone: 'intel' as const },
  { t: '09:13:41', lvl: 'WARN', msg: 'upload latency p95 = 1180ms (threshold 800ms)', tone: 'warning' as const },
  { t: '09:14:02', lvl: 'ERROR', msg: 'TimeoutException: upload exceeded 30000ms', tone: 'critical' as const },
  { t: '09:14:55', lvl: 'ERROR', msg: 'virus-scan step blocking request thread (34s avg)', tone: 'critical' as const },
  { t: '09:18:20', lvl: 'AI', msg: 'incident agent correlated errors with deploy #1482', tone: 'ai' as const },
]

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inc = incidents.find((i) => i.id === id)
  if (!inc) notFound()

  return (
    <div className="space-y-6">
      <Link href="/incidents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All incidents
      </Link>

      <PageHeader
        title={inc.title}
        desc={`${inc.id} · ${inc.service} · started ${inc.started}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionBtn icon={<Wrench className="h-4 w-4" />} label="Generate fix" primary />
            <ActionBtn icon={<Ticket className="h-4 w-4" />} label="Jira ticket" />
            <ActionBtn icon={<Bell className="h-4 w-4" />} label="Notify" />
            <ActionBtn icon={<UserPlus className="h-4 w-4" />} label="Assign" />
            <ActionBtn icon={<CheckCircle2 className="h-4 w-4" />} label="Resolve" />
          </div>
        }
      />

      {/* summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
          <div className="mt-2"><ToneBadge tone={inc.severity}>{inc.priority}</ToneBadge></div>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p className={cn('mt-2 text-sm font-semibold', toneText[statusTone[inc.status]])}>{inc.status}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Affected</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{inc.affected}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Business impact</p>
          <p className={cn('mt-2 text-sm font-semibold', toneText[inc.severity])}>{inc.impact}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* left: investigation */}
        <div className="space-y-4 lg:col-span-2">
          {/* AI conclusion */}
          <Card className="border-ai/25 bg-ai/[0.04]">
            <CardHead
              title="AI Conclusion"
              desc="Autonomous root cause analysis"
              icon={<Sparkles className="h-4 w-4 text-ai" />}
              action={<Confidence value={inc.confidence} />}
            />
            <div className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-foreground">{inc.rootCause}</p>
              <div className="mt-4 rounded-lg border border-ai/20 bg-ai/[0.06] p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ai">
                  <ListChecks className="h-3.5 w-3.5" /> Recommended fix
                </p>
                <p className="mt-1.5 text-sm text-foreground">{inc.suggestedFix}</p>
                <p className="mt-2 text-xs text-muted-foreground">Estimated resolution time: ~12 minutes</p>
              </div>
            </div>
          </Card>

          {/* timeline */}
          <Card>
            <CardHead title="Incident Timeline" desc="Correlated events across services" />
            <div className="px-5 pb-5">
              <ol className="relative border-l border-border/60 pl-5">
                {inc.timeline.map((t, i) => (
                  <li key={i} className="relative mb-5 last:mb-0">
                    <span className={cn('absolute -left-[27px] mt-0.5 h-3 w-3 rounded-full ring-4 ring-background', toneBg[t.tone])} />
                    <p className="font-mono text-[11px] text-muted-foreground">{t.time}</p>
                    <p className="mt-0.5 text-sm text-foreground">{t.label}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          {/* logs */}
          <Card>
            <CardHead title="Correlated Logs" desc="Filtered to the causal window" icon={<Terminal className="h-4 w-4" />} />
            <div className="px-5 pb-5">
              <div className="scrollbar-thin overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs">
                {logLines.map((l, i) => (
                  <div key={i} className="flex gap-3 whitespace-nowrap py-0.5">
                    <span className="text-muted-foreground">{l.t}</span>
                    <span className={cn('w-12 font-semibold', toneText[l.tone])}>{l.lvl}</span>
                    <span className="text-foreground/90">{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* right: meta */}
        <div className="space-y-4">
          <Card className="flex flex-col items-center p-6">
            <ProgressRing value={inc.confidence} tone="ai" size={96} stroke={7} label="confidence" />
            <p className="mt-3 text-center text-sm font-medium text-foreground">AI diagnostic certainty</p>
            <p className="mt-1 text-center text-xs text-muted-foreground">Based on 4 correlated signals</p>
          </Card>

          <Card>
            <CardHead title="Deployment correlation" />
            <div className="px-5 pb-5 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-critical/25 bg-critical/[0.06] px-3 py-2.5">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">deploy #1482</p>
                  <p className="font-medium text-foreground">storage-svc</p>
                </div>
                <ToneBadge tone="critical">99% linked</ToneBadge>
              </div>
              <button className="mt-3 w-full rounded-lg border border-border/70 bg-card/60 py-2 text-xs font-medium text-foreground hover:bg-accent">
                Roll back deploy #1482
              </button>
            </div>
          </Card>

          <Card>
            <CardHead title="Assignment" />
            <div className="flex items-center gap-3 px-5 pb-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-intel to-ai text-xs font-semibold text-white">
                {inc.assignee.split(' ').map((n) => n[0]).join('')}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{inc.assignee}</p>
                <p className="text-xs text-muted-foreground">On-call engineer</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, primary }: { icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        primary
          ? 'bg-ai text-ai-foreground hover:opacity-90'
          : 'border border-border/70 bg-card/60 text-foreground hover:bg-accent',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export function generateStaticParams() {
  return incidents.map((i) => ({ id: i.id }))
}
