import { Settings } from 'lucide-react'
import { PageHeader, Card, CardHead } from '@/components/kit'
import { ToneBadge } from '@/components/kit'

const sections = [
  {
    title: 'Alerting & Thresholds',
    desc: 'Configure when and how the platform surfaces incidents and notifications.',
    items: ['Error rate threshold', 'Latency SLO targets', 'Notification channels', 'On-call schedule'],
  },
  {
    title: 'AI Agent Configuration',
    desc: 'Control which agents are active and what actions they can take autonomously.',
    items: ['Agent permissions', 'Autonomous action scope', 'Confidence thresholds', 'Escalation rules'],
  },
  {
    title: 'Integrations',
    desc: 'Connect the platform to your existing toolchain.',
    items: ['Slack & Teams', 'Jira & Linear', 'PagerDuty', 'GitHub & CI/CD'],
  },
  {
    title: 'Data & Retention',
    desc: 'Manage data ingestion, sampling rates and retention policies.',
    items: ['Session sampling rate', 'Log retention period', 'Data residency region', 'Export & backups'],
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings className="h-5 w-5" />}
        title="Settings"
        desc="Configure alerting, AI agent behaviour, integrations and data retention policies."
        actions={<ToneBadge tone="healthy" dot>All systems connected</ToneBadge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHead title={s.title} desc={s.desc} />
            <ul className="space-y-1 px-5 pb-5">
              {s.items.map((item) => (
                <li
                  key={item}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 text-sm"
                >
                  <span className="text-foreground">{item}</span>
                  <button className="text-xs font-medium text-intel hover:underline">Configure</button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
