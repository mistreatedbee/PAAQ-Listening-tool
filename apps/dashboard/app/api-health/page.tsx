import { Activity } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function ApiHealthPage() {
  return (
    <ModuleScaffold
      icon={Activity}
      title="API Health"
      desc="Endpoint availability, latency distribution and error budgets across all services, with AI anomaly detection and SLO tracking."
      stats={[
        { label: 'Availability', value: '99.8%', tone: 'healthy', spark: [99.6, 99.7, 99.8, 99.9, 99.8, 99.7, 99.8, 99.8] },
        { label: 'p95 Latency', value: '186ms', tone: 'healthy', spark: [220, 210, 205, 200, 195, 190, 188, 186] },
        { label: 'Error Budget', value: '32%', tone: 'warning', spark: [80, 72, 64, 58, 50, 42, 36, 32] },
        { label: 'Endpoints', value: '214', tone: 'intel', spark: [200, 204, 206, 208, 210, 212, 213, 214] },
      ]}
      capabilities={[
        'Per-endpoint latency percentiles (p50, p95, p99)',
        'Error rate tracking and budget burn alerts',
        'SLO compliance monitoring across all services',
        'Dependency graph and upstream impact analysis',
        'AI anomaly detection on traffic patterns',
        'Rate limiting and abuse pattern visibility',
      ]}
      aiNote="The /v2/verify endpoint is the primary error budget consumer this cycle — responsible for 68% of burn rate at current volume. Freezing risky deploys to that service is recommended until the issue is resolved."
    />
  )
}
