import { Shield } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, StatusDot } from '@/components/kit'
import { securityStats, securityEvents } from '@/lib/data'

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Shield className="h-5 w-5" />}
        title="Security Center"
        desc="Anomaly detection, threat monitoring and automated response driven by the Security Agent."
        actions={<ToneBadge tone="warning" dot>Threat level: Elevated</ToneBadge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {securityStats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</span>
              <StatusDot tone={s.tone} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHead title="Security Event Timeline" desc="Automated detections and responses, newest first." />
          <div className="relative px-5 pb-5">
            <div className="absolute left-[26px] top-0 bottom-5 w-px bg-border" />
            <div className="flex flex-col gap-5">
              {securityEvents.map((ev) => (
                <div key={ev.time} className="relative flex gap-4 pl-4">
                  <div className="relative z-10 mt-1">
                    <StatusDot tone={ev.tone} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{ev.label}</p>
                      <span className="font-mono text-xs text-muted-foreground">{ev.time}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ev.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="border-ai/30 bg-ai/5">
          <CardHead title="Security Agent" desc="Autonomous threat response" />
          <div className="space-y-3 px-5 pb-5 text-sm">
            <p className="text-muted-foreground">
              A credential-stuffing campaign targeting high-value accounts was detected and contained automatically.
            </p>
            <div className="rounded-lg border border-border/70 bg-card/60 p-3">
              <p className="text-xs font-medium text-foreground">Actions taken</p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>Rate-limited 118 source IPs</li>
                <li>Enforced MFA on 3 flagged accounts</li>
                <li>Escalated to on-call security engineer</li>
              </ul>
            </div>
            <ToneBadge tone="ai" dot>92% confidence · contained</ToneBadge>
          </div>
        </Card>
      </div>
    </div>
  )
}
