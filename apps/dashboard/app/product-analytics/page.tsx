import { BarChart3 } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function ProductAnalyticsPage() {
  return (
    <ModuleScaffold
      icon={BarChart3}
      title="Product Analytics"
      desc="Funnels, retention and adoption analytics that explain themselves. Ask a question in plain language and get a chart with a written answer."
      stats={[
        { label: 'WAU', value: '312k', tone: 'healthy', spark: [26, 27, 28, 29, 30, 31, 31, 31] },
        { label: 'Activation', value: '61%', tone: 'warning', spark: [66, 65, 64, 63, 62, 61, 61, 61] },
        { label: 'Feature Adoption', value: '73%', tone: 'intel', spark: [68, 69, 70, 71, 72, 72, 73, 73] },
        { label: 'NPS', value: '48', tone: 'healthy', spark: [42, 43, 44, 45, 46, 47, 48, 48] },
      ]}
      capabilities={[
        'Natural-language querying of product metrics',
        'Self-explaining funnels and retention curves',
        'Cohort comparison over time',
        'Automatic anomaly and trend callouts',
        'Feature adoption and stickiness tracking',
        'Export any chart to a report',
      ]}
      aiNote="Activation dipped from 66% to 61% this week. The drop is fully explained by the onboarding upload regression — no other funnel step degraded."
    />
  )
}
