import { PageHeader, Card, CardHead, AreaChart } from '@/components/kit'
import { SystemMap } from '@/components/dashboard/system-map'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { Radio } from 'lucide-react'

const liveMetrics = [
  { label: 'Requests / min', value: '96,420', tone: 'intel' as const, series: [80, 84, 88, 90, 92, 95, 94, 96] },
  { label: 'Active sessions', value: '18,412', tone: 'healthy' as const, series: [12, 13, 14, 15, 16, 17, 18, 18] },
  { label: 'Errors / min', value: '412', tone: 'warning' as const, series: [120, 180, 220, 260, 320, 360, 400, 412] },
]

export default function LiveMonitoringPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Radio className="h-5 w-5 text-healthy" />}
        title="Live Monitoring"
        desc="Real-time view of traffic, service health and every event flowing through the platform."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg border border-healthy/30 bg-healthy/10 px-3 py-1.5 text-sm font-medium text-healthy">
            <span className="h-2 w-2 rounded-full bg-healthy animate-pulse-dot" /> Streaming live
          </span>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {liveMetrics.map((m) => (
          <Card key={m.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{m.value}</p>
            <div className="mt-2">
              <AreaChart data={m.series} tone={m.tone} height={60} />
            </div>
          </Card>
        ))}
      </div>

      <SystemMap />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHead title="Throughput" desc="Requests across all regions · last 60 minutes" />
          <div className="px-5 pb-5">
            <AreaChart
              data={[62, 70, 66, 78, 82, 76, 88, 92, 86, 95, 90, 96]}
              tone="intel"
              height={200}
              labels={['-60m', '-45m', '-30m', '-15m', 'now']}
            />
          </div>
        </Card>
        <div className="min-h-[420px]">
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
