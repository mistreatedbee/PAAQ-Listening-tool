import { Bug } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, Meter } from '@/components/kit'
import { errorRows, type Tone } from '@/lib/data'

const statusTone: Record<string, Tone> = {
  new: 'ai',
  trending: 'critical',
  open: 'warning',
  resolved: 'healthy',
}

export default function ErrorsPage() {
  const total = errorRows.reduce((s, e) => s + e.count, 0)
  const max = Math.max(...errorRows.map((e) => e.count))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Bug className="h-5 w-5" />}
        title="Error Tracking"
        desc="AI-grouped errors ranked by impact, with automatic feature attribution and trend detection."
        actions={<ToneBadge tone="critical" dot>{`${total.toLocaleString()} events / 24h`}</ToneBadge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Unique Errors', value: '12', tone: 'warning' as Tone },
          { label: 'New Today', value: '1', tone: 'ai' as Tone },
          { label: 'Trending Up', value: '2', tone: 'critical' as Tone },
          { label: 'Resolved', value: '1', tone: 'healthy' as Tone },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</span>
              <ToneBadge tone={s.tone}>{s.tone === 'critical' ? 'attention' : 'tracked'}</ToneBadge>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHead title="Top Errors" desc="Grouped by signature and attributed to the impacted feature." />
        <div className="divide-y divide-border/60">
          {errorRows.map((e) => (
            <div key={e.message} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <ToneBadge tone={statusTone[e.status]}>{e.status}</ToneBadge>
                  <span className="text-[11px] text-muted-foreground">{e.type}</span>
                </div>
                <p className="mt-1.5 truncate font-mono text-sm text-foreground">{e.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Feature: {e.feature}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-40">
                  <div className="flex items-center justify-between text-xs">
                    <span className="tabular-nums text-foreground">{e.count.toLocaleString()}</span>
                    <span className={e.trend >= 0 ? 'text-critical' : 'text-healthy'}>
                      {e.trend >= 0 ? '+' : ''}
                      {e.trend}%
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Meter value={(e.count / max) * 100} tone={statusTone[e.status]} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
