import { Rocket } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, ProgressRing } from '@/components/kit'
import { deployments, type Tone } from '@/lib/data'

const statusTone: Record<string, Tone> = {
  success: 'healthy',
  degraded: 'warning',
  'rolled-back': 'critical',
}

function Delta({ value, invert }: { value: number; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0
  return (
    <span className={good ? 'text-healthy' : 'text-critical'}>
      {value >= 0 ? '+' : ''}
      {value}
    </span>
  )
}

export default function DeploymentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Rocket className="h-5 w-5" />}
        title="Deployment Intelligence"
        desc="Every release scored for health impact. AI correlates deploys with error and latency changes to catch regressions instantly."
        actions={<ToneBadge tone="intel" dot>14 deploys today</ToneBadge>}
      />

      <Card className="border-critical/30 bg-critical/5">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ToneBadge tone="critical" dot>Regression detected</ToneBadge>
              <span className="font-mono text-xs text-muted-foreground">deploy #1482 · storage-svc</span>
            </div>
            <p className="mt-2 max-w-xl text-pretty text-sm text-foreground">
              This deploy increased errors by 540% and latency by 980ms. AI recommends an immediate rollback — it is the
              primary cause of incident INC-1042.
            </p>
          </div>
          <button className="shrink-0 rounded-lg bg-critical px-4 py-2 text-sm font-medium text-critical-foreground transition hover:opacity-90">
            Roll back #1482
          </button>
        </div>
      </Card>

      <Card>
        <CardHead title="Recent Deployments" desc="Health-scored release history across all services." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Deploy</th>
                <th className="px-5 py-2.5 font-medium">Service</th>
                <th className="px-5 py-2.5 font-medium">Author</th>
                <th className="px-5 py-2.5 font-medium">Errors Δ</th>
                <th className="px-5 py-2.5 font-medium">Latency Δ</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {deployments.map((d) => (
                <tr key={d.id} className="transition hover:bg-muted/40">
                  <td className="px-5 py-3.5 font-mono text-foreground">{d.id}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{d.service}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{d.author}</td>
                  <td className="px-5 py-3.5 tabular-nums">
                    <Delta value={d.errorsDelta} invert />
                  </td>
                  <td className="px-5 py-3.5 tabular-nums">
                    <Delta value={d.latencyDelta} invert />
                    <span className="text-muted-foreground">ms</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <ToneBadge tone={statusTone[d.status]}>{d.status}</ToneBadge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      <ProgressRing value={d.healthScore} tone={statusTone[d.status]} size={40} stroke={4} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
