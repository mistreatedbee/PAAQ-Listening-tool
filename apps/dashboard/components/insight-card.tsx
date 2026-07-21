import type { Insight } from '@/lib/data'
import { Card, Confidence, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneBg } from '@/lib/tones'
import { Sparkles, Users, TrendingUp, ArrowRight } from 'lucide-react'

export function InsightCard({ insight, compact }: { insight: Insight; compact?: boolean }) {
  return (
    <Card className="flex flex-col p-4 transition-colors hover:border-border">
      <div className="flex items-start gap-3">
        <span className={cn('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', 'bg-ai/12 text-ai')}>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-pretty text-sm font-semibold leading-snug text-foreground">{insight.title}</h3>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{insight.summary}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Confidence value={insight.confidence} />
        <ToneBadge tone={insight.severity} dot>
          {insight.impact}
        </ToneBadge>
        {insight.affected !== '—' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" /> {insight.affected}
          </span>
        )}
      </div>

      {!compact && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          {insight.actions.map((a, i) => (
            <button
              key={a}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                i === 0
                  ? 'bg-ai text-ai-foreground hover:opacity-90'
                  : 'border border-border/70 bg-card/60 text-foreground hover:bg-accent',
              )}
            >
              {i === 0 && <TrendingUp className="h-3.5 w-3.5" />}
              {a}
            </button>
          ))}
          <button className="ml-auto flex items-center gap-1 text-xs font-medium text-intel hover:underline">
            Details <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </Card>
  )
}
