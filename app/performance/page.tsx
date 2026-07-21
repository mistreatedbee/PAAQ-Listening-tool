import { PageHeader, Card, CardHead, AreaChart, ToneBadge } from '@/components/kit'
import { performanceMetrics } from '@/lib/data'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { Gauge, Sparkles } from 'lucide-react'

export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Gauge className="h-5 w-5 text-intel" />}
        title="Performance Monitoring"
        desc="Interactive resource and latency charts with AI capacity forecasting and recommendations."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {performanceMetrics.map((m) => (
          <Card key={m.label}>
            <CardHead
              title={m.label}
              action={<span className={cn('text-lg font-semibold tabular-nums', toneText[m.tone])}>{m.value}</span>}
            />
            <div className="px-5">
              <AreaChart data={m.series} tone={m.tone} height={130} labels={['6h', '4h', '2h', 'now']} />
            </div>
            <div className="mx-5 mb-5 mt-3 flex items-start gap-2 rounded-lg border border-ai/20 bg-ai/[0.05] p-3">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-ai">AI: </span>
                {m.rec}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHead
          title="Predicted Capacity"
          desc="AI forecast across compute, storage and database"
          action={<ToneBadge tone="warning" dot>Scale-up advised</ToneBadge>}
        />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
          {[
            { l: 'Compute', v: '32 days', t: 'intel' as const, s: [50, 46, 42, 38, 35, 34, 33, 32] },
            { l: 'Storage', v: '18 days', t: 'warning' as const, s: [40, 36, 30, 26, 22, 20, 19, 18] },
            { l: 'Database', v: '54 days', t: 'healthy' as const, s: [70, 68, 64, 62, 58, 56, 55, 54] },
          ].map((c) => (
            <div key={c.l} className="rounded-lg border border-border/60 bg-background/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.l} headroom</p>
              <p className={cn('mt-1 text-xl font-semibold', toneText[c.t])}>{c.v}</p>
              <div className="mt-2">
                <AreaChart data={c.s} tone={c.t} height={54} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
