import { Server } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function InfrastructurePage() {
  return (
    <ModuleScaffold
      icon={Server}
      title="Infrastructure"
      desc="Compute, network and storage health across all regions, with AI-driven capacity forecasting and auto-scaling visibility."
      stats={[
        { label: 'CPU Utilisation', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Memory', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Network', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Capacity (days)', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
      ]}
      capabilities={[
        'Multi-region compute and memory monitoring',
        'Network throughput and saturation tracking',
        'Auto-scaling event history and triggers',
        'Storage utilisation and I/O performance',
        'AI capacity forecasting and scale-up planning',
        'Instance health and availability zone coverage',
      ]}
      aiNote="No data yet. Connect your infrastructure monitoring integration and AI capacity forecasting will appear here automatically."
    />
  )
}
