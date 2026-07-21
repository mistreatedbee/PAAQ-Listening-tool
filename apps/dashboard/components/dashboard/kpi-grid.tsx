import { kpis } from '@/lib/data'
import { Sparkline } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

export function KpiGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {kpis.map((k) => {
        const up = k.delta > 0
        const flat = k.delta === 0
        // for error rate / incidents an increase is bad
        const negativeMetric = ['Open Incidents', 'Error Rate'].includes(k.label)
        const deltaTone = flat
          ? 'text-muted-foreground'
          : (up ? !negativeMetric : negativeMetric)
            ? 'text-healthy'
            : 'text-critical'
        return (
          <div
            key={k.label}
            className="group relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-3.5 transition-colors hover:border-border"
          >
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="flex items-baseline gap-1">
                <span className={cn('text-2xl font-semibold tabular-nums tracking-tight', toneText[k.tone])}>
                  {k.value}
                </span>
                {k.unit && <span className="text-xs text-muted-foreground">{k.unit}</span>}
              </p>
              <Sparkline data={k.spark} tone={k.tone} width={64} height={26} />
            </div>
            <div className={cn('mt-2 flex items-center gap-1 text-[11px] font-medium', deltaTone)}>
              {flat ? <Minus className="h-3 w-3" /> : up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {flat ? 'stable' : `${up ? '+' : ''}${k.delta}${k.unit === '%' ? 'pp' : ''}`}
              <span className="text-muted-foreground">vs 24h</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
