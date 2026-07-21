'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card } from '@/components/kit'
import { InsightCard } from '@/components/insight-card'
import { Sparkles, RefreshCw } from 'lucide-react'
import type { Insight, Tone } from '@/lib/data'

type DbInsight = {
  id: string
  title: string
  summary: string | null
  confidence: number | null
  impact: string | null
  affected_count: number | null
  severity: string | null
  actions: string[] | null
}

function severityTone(s: string | null): Tone {
  if (s === 'fatal' || s === 'error') return 'critical'
  if (s === 'warning') return 'warning'
  if (s === 'healthy') return 'healthy'
  return 'intel'
}

function toInsight(i: DbInsight): Insight {
  return {
    id: i.id,
    title: i.title,
    summary: i.summary ?? '',
    confidence: Math.round(i.confidence ?? 80),
    impact: i.impact ?? 'Unknown impact',
    affected: i.affected_count ? `${i.affected_count.toLocaleString()} users` : '—',
    severity: severityTone(i.severity),
    actions: i.actions?.length ? i.actions : ['Investigate'],
  }
}

export default function AIInsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [counts, setCounts] = useState({ total: 0, critical: 0, avgConf: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('ai_insights')
      .select('id, title, summary, confidence, impact, affected_count, severity, actions')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as DbInsight[]
        const mapped = rows.map(toInsight)
        const critical = rows.filter((r) => r.severity === 'fatal' || r.severity === 'error').length
        const avgConf = rows.length
          ? Math.round(rows.reduce((a, r) => a + (r.confidence ?? 80), 0) / rows.length)
          : 0
        setInsights(mapped)
        setCounts({ total: rows.length, critical, avgConf })
        setLoading(false)
      })
  }, [])

  const stats = [
    { label: 'Active insights', value: String(counts.total) },
    { label: 'Critical', value: String(counts.critical), tone: 'text-critical' },
    { label: 'Avg confidence', value: counts.avgConf ? `${counts.avgConf}%` : '—', tone: 'text-ai' },
    { label: 'Users impacted', value: insights.reduce((a, i) => a + (i.affected === '—' ? 0 : parseInt(i.affected.replace(/\D/g, '')) || 0), 0).toLocaleString() },
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : insights.length === 0 ? (
        <Card className="p-10 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No AI insights yet. Run database/seed.sql to add demo data.</p>
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
