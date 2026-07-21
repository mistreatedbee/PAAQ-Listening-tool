import { Bot } from 'lucide-react'
import { PageHeader, Card, ToneBadge, StatusDot, Confidence } from '@/components/kit'
import { agents, type Agent, type Tone } from '@/lib/data'
import { toneBg } from '@/lib/tones'
import { cn } from '@/lib/utils'

const statusTone: Record<Agent['status'], Tone> = {
  active: 'healthy',
  idle: 'intel',
  paused: 'warning',
}

export default function AiAgentsPage() {
  const active = agents.filter((a) => a.status === 'active').length
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="AI Agent Fleet"
        desc="Autonomous agents continuously watch, investigate and act across the platform. Each reports its current task and confidence."
        actions={<ToneBadge tone="ai" dot>{`${active} of ${agents.length} active`}</ToneBadge>}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <Card key={a.name} className="flex flex-col p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-ai/25 bg-ai/10 text-ai">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{a.name}</h3>
                  <p className="text-xs text-muted-foreground">{a.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot tone={statusTone[a.status]} pulse={a.status === 'active'} />
                <span className="text-[11px] capitalize text-muted-foreground">{a.status}</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border/70 bg-card/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current task</p>
              <p className="mt-1 text-sm text-foreground">{a.task}</p>
            </div>

            <ul className="mt-3 flex-1 space-y-1.5">
              {a.actions.map((act) => (
                <li key={act} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className={cn('mt-1.5 h-1 w-1 shrink-0 rounded-full', toneBg[a.tone])} />
                  {act}
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <Confidence value={a.confidence} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
