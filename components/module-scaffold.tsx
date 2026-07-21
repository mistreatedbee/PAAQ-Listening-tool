import type { LucideIcon } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { PageHeader, Card, ToneBadge, Sparkline } from '@/components/kit'
import type { Tone } from '@/lib/data'

type Stat = { label: string; value: string; tone: Tone; spark: number[] }

export function ModuleScaffold({
  icon: Icon,
  title,
  desc,
  stats,
  capabilities,
  aiNote,
}: {
  icon: LucideIcon
  title: string
  desc: string
  stats: Stat[]
  capabilities: string[]
  aiNote: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={<Icon className="h-5 w-5" />} title={title} desc={desc} actions={<ToneBadge tone="ai" dot>AI-monitored</ToneBadge>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</span>
              <Sparkline data={s.spark} tone={s.tone} width={72} height={28} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <h3 className="text-sm font-semibold text-foreground">Capabilities</h3>
          <p className="mt-1 text-xs text-muted-foreground">What this module continuously analyses.</p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {capabilities.map((c) => (
              <li key={c} className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-card/60 p-3 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-intel" />
                {c}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-ai/30 bg-ai/5 p-5">
          <div className="flex items-center gap-2 text-ai">
            <Sparkles className="h-4 w-4" />
            <h3 className="text-sm font-semibold">AI Assessment</h3>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{aiNote}</p>
          <div className="mt-4">
            <ToneBadge tone="ai" dot>Continuously updated</ToneBadge>
          </div>
        </Card>
      </div>
    </div>
  )
}
