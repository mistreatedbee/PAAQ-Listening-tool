import { Server } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function InfrastructurePage() {
  return (
    <ModuleScaffold
      icon={Server}
      title="Infrastructure"
      desc="Compute, network and storage health across all regions, with AI-driven capacity forecasting and auto-scaling visibility."
      stats={[
        { label: 'CPU Utilisation', value: '58%', tone: 'intel', spark: [40, 44, 52, 48, 60, 58, 62, 58] },
        { label: 'Memory', value: '71%', tone: 'warning', spark: [55, 58, 62, 64, 68, 70, 72, 71] },
        { label: 'Network', value: '4.2 Gb/s', tone: 'intel', spark: [3, 3.4, 3.6, 3.8, 4, 4.1, 4.2, 4.2] },
        { label: 'Capacity (days)', value: '18', tone: 'warning', spark: [30, 28, 26, 24, 22, 20, 19, 18] },
      ]}
      capabilities={[
        'Multi-region compute and memory monitoring',
        'Network throughput and saturation tracking',
        'Auto-scaling event history and triggers',
        'Storage utilisation and I/O performance',
        'AI capacity forecasting and scale-up planning',
        'Instance health and availability zone coverage',
      ]}
      aiNote="At current growth rate, storage capacity will be exhausted in 18 days. The worker memory pool is also trending upward — a leak in the background worker fleet is the likely cause. Scale-up planning should begin this week."
    />
  )
}
