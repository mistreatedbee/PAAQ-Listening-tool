import { BarChart3 } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function ProductAnalyticsPage() {
  return (
    <ModuleScaffold
      icon={BarChart3}
      title="Product Analytics"
      desc="Funnels, retention and adoption analytics that explain themselves. Ask a question in plain language and get a chart with a written answer."
      stats={[
        { label: 'WAU', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Activation', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Feature Adoption', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'NPS', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
      ]}
      capabilities={[
        'Natural-language querying of product metrics',
        'Self-explaining funnels and retention curves',
        'Cohort comparison over time',
        'Automatic anomaly and trend callouts',
        'Feature adoption and stickiness tracking',
        'Export any chart to a report',
      ]}
      aiNote="No data yet. Once users are active in your app and the PAAQ SDK is sending events, product analytics will appear here automatically."
    />
  )
}
