'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { InsightCard } from '@/components/insight-card'
import { Sparkles } from 'lucide-react'
import type { Insight, Tone } from '@/lib/data'

type DbInsight = {
  id: string
  category: string
  title: string
  description: string | null
  confidence: number | null
  recommendation: string | null
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

export function HomeInsights() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('ai_insights')
      .select('id, category, title, description, confidence, recommendation')
      .order('created_at', { ascending: false })
      .limit(2)
      .then(({ data }) => {
        setInsights(((data ?? []) as DbInsight[]).map(toInsight))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-border/60 bg-card/60" />
        ))}
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Sparkles className="h-6 w-6 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">No insights yet. They appear automatically once your app is integrated with the PAAQ SDK.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {insights.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}
    </div>
  )
}
