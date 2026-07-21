import { Activity } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function ApiHealthPage() {
  return (
    <ModuleScaffold
      icon={Activity}
      title="API Health"
      desc="Endpoint availability, latency distribution and error budgets across all services, with AI anomaly detection and SLO tracking."
      stats={[
        { label: 'Availability', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'p95 Latency', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Error Budget', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Endpoints', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
      ]}
      capabilities={[
        'Per-endpoint latency percentiles (p50, p95, p99)',
        'Error rate tracking and budget burn alerts',
        'SLO compliance monitoring across all services',
        'Dependency graph and upstream impact analysis',
        'AI anomaly detection on traffic patterns',
        'Rate limiting and abuse pattern visibility',
      ]}
      aiNote="No data yet. Once your app is integrated with the PAAQ SDK and API requests are flowing, AI analysis will appear here automatically."
    />
  )
}
