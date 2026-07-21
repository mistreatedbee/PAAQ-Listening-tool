import { PageHeader, Card } from '@/components/kit'
import { InsightCard } from '@/components/insight-card'
import { insights } from '@/lib/data'
import { Sparkles, RefreshCw } from 'lucide-react'

export default function AIInsightsPage() {
  const stats = [
    { label: 'Active insights', value: '7' },
    { label: 'Critical', value: '2', tone: 'text-critical' },
    { label: 'Avg confidence', value: '91%', tone: 'text-ai' },
    { label: 'Users impacted', value: '28.5k' },
  ]
  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Sparkles className="h-5 w-5 text-ai" />}
        title="AI Insights"
        desc="The heart of the platform. Autonomous analysis of what is happening, why, who is affected and what to do next."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90">
            <RefreshCw className="h-4 w-4" /> Regenerate insights
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${s.tone ?? 'text-foreground'}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {insights.map((i) => (
          <InsightCard key={i.id} insight={i} />
        ))}
      </div>
    </div>
  )
}
