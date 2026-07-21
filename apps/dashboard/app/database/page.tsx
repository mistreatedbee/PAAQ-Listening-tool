import { Database } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function DatabasePage() {
  return (
    <ModuleScaffold
      icon={Database}
      title="Database Health"
      desc="Query performance, replication and connection health with AI query optimisation and capacity forecasting."
      stats={[
        { label: 'Query p95', value: '11ms', tone: 'healthy', spark: [14, 13, 12, 12, 11, 11, 12, 11] },
        { label: 'Pool Usage', value: '62%', tone: 'intel', spark: [50, 54, 56, 58, 60, 61, 62, 62] },
        { label: 'Cache Hit', value: '96%', tone: 'healthy', spark: [92, 93, 94, 95, 95, 96, 96, 96] },
        { label: 'Slow Queries', value: '4', tone: 'warning', spark: [1, 2, 2, 3, 3, 4, 4, 4] },
      ]}
      capabilities={[
        'Primary and replica health monitoring',
        'Slow-query detection and explain plans',
        'AI-suggested index and query rewrites',
        'Connection pool saturation alerts',
        'Replication lag tracking',
        'Storage and capacity forecasting',
      ]}
      aiNote="The auth service connection pool is running hot at 96% under EU peak, contributing to elevated auth latency (INC-1041). Recommended action: expand the pool from 40 to 80 connections."
    />
  )
}
