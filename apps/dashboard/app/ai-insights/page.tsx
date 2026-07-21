'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card } from '@/components/kit'
import { InsightCard } from '@/components/insight-card'
import { Sparkles, RefreshCw } from 'lucide-react'
import type { Insight, Tone } from '@/lib/data'

type DbInsight = {
  id: string
  category: string
  title: string
  description: string | null
  confidence: number | null
  recommendation: string | null
  created_at: string
}

function categoryTone(c: string): Tone {
  if (c === 'error' || c === 'security') return 'critical'
  if (c === 'warning' || c === 'performance') return 'warning'
  if (c === 'growth' || c === 'success') return 'healthy'
  return 'intel'
}

function toInsight(i: DbInsight): Insight {
  const actions: string[] = i.recommendation ? [i.recommendation, 'Investigate'] : ['Investigate']
  return {
    id: i.id,
    title: i.title,
    summary: i.description ?? '',
    confidence: Math.round((i.confidence ?? 0.8) * 100),
    impact: i.category.charAt(0).toUpperCase() + i.category.slice(1),
    affected: '—',
    severity: categoryTone(i.category),
    actions,
  }
}

export default function AIInsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [raw, setRaw] = useState<DbInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const sb = createClient()
    sb.from('ai_insights')
      .select('id, category, title, description, confidence, recommendation, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as DbInsight[]
        setRaw(rows)
        setInsights(rows.map(toInsight))
        setLoading(false)
      })
  }, [])

  const critical = raw.filter((r) => r.category === 'error' || r.category === 'security').length
  const avgConf = raw.length
    ? Math.round(raw.reduce((a, r) => a + (r.confidence ?? 0.8), 0) / raw.length * 100)
    : 0

  const stats = [
    { label: 'Total insights', value: String(raw.length) },
    { label: 'Critical', value: String(critical), tone: 'text-critical' },
    { label: 'Avg confidence', value: raw.length ? `${avgConf}%` : '—', tone: 'text-ai' },
    { label: 'Categories', value: String(new Set(raw.map((r) => r.category)).size) },
  ]

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}
      <PageHeader
        icon={<Sparkles className="h-5 w-5 text-ai" />}
        title="AI Insights"
        desc="The heart of the platform. Autonomous analysis of what is happening, why, who is affected and what to do next."
        actions={
          <button
            onClick={() => showToast('Insights are generated automatically — refresh to see latest analysis')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90"
          >
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : insights.length === 0 ? (
        <Card className="p-10 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No AI insights yet. Insights are generated automatically once your app starts sending data via the PAAQ SDK.</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {insights.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}
    </div>
  )
}
