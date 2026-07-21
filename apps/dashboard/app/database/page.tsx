import { Database } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function DatabasePage() {
  return (
    <ModuleScaffold
      icon={Database}
      title="Database Health"
      desc="Query performance, replication and connection health with AI query optimisation and capacity forecasting."
      stats={[
        { label: 'Query p95', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Pool Usage', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Cache Hit', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Slow Queries', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
      ]}
      capabilities={[
        'Primary and replica health monitoring',
        'Slow-query detection and explain plans',
        'AI-suggested index and query rewrites',
        'Connection pool saturation alerts',
        'Replication lag tracking',
        'Storage and capacity forecasting',
      ]}
      aiNote="No data yet. Connect your database monitoring integration and AI analysis will appear here automatically."
    />
  )
}
