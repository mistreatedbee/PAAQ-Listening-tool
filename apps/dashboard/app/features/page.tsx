import { Blocks, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PageHeader, Card, CardHead, ProgressRing, Meter, ToneBadge } from '@/components/kit'
import { features, type Feature, type Tone } from '@/lib/data'

function healthTone(h: number): Tone {
  if (h >= 90) return 'healthy'
  if (h >= 75) return 'intel'
  if (h >= 65) return 'warning'
  return 'critical'
}

function TrendIcon({ trend }: { trend: Feature['trend'] }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-healthy" />
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-critical" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

export default function FeaturesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Blocks className="h-5 w-5" />}
        title="Feature Health"
        desc="Every feature scored on success, completion and satisfaction — with an AI recommendation to improve each one."
        actions={<ToneBadge tone="intel" dot>6 features tracked</ToneBadge>}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {features.map((f) => {
          const tone = healthTone(f.health)
          return (
            <Card key={f.name} className="flex flex-col">
              <div className="flex items-start justify-between gap-4 px-5 pt-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{f.name}</h3>
                    <TrendIcon trend={f.trend} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{f.usage}</p>
                </div>
                <ProgressRing value={f.health} tone={tone} label="health" />
              </div>

              <div className="mt-4 space-y-3 px-5">
                {[
                  { label: 'Success rate', value: f.success },
                  { label: 'Completion', value: f.completion },
                  { label: 'Satisfaction', value: f.satisfaction },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-mono tabular-nums text-foreground">{m.value}%</span>
                    </div>
                    <div className="mt-1">
                      <Meter value={m.value} tone={healthTone(m.value)} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-border/60 px-5 py-3.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ai">AI recommendation</p>
                <p className="mt-1 text-xs text-muted-foreground">{f.recommendation}</p>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
