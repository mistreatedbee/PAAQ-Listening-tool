'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { ArrowRight, Lightbulb, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

type Recommendation = {
  id: string
  title: string
  description: string | null
  priority: string | null
  status: string | null
  created_at: string
}

function priorityTone(p: string | null): Tone {
  if (p === 'critical' || p === 'high') return 'critical'
  if (p === 'medium') return 'warning'
  return 'intel'
}

export function HomeRecommendations() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('recommendations')
        .select('id, title, description, priority, status, created_at')
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(4),
      sb.from('recommendations').select('*', { count: 'exact', head: true }).neq('status', 'dismissed'),
    ]).then(([{ data }, { count }]) => {
      setRecs((data ?? []) as Recommendation[])
      setTotal(count ?? 0)
      setLoading(false)
    })
  }, [])

  return (
    <Card className="flex flex-col">
      <CardHead
        title="AI Recommendations"
        desc="Top actions surfaced by PAAQ AI agents"
        icon={<Sparkles className="h-4 w-4 text-ai" />}
        action={
          <Link href="/recommendations" className="flex items-center gap-1 text-xs font-medium text-intel hover:underline">
            All {total > 0 ? `(${total})` : ''} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="flex-1 space-y-2 px-5 pb-5">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border/40 bg-card/60" />
          ))
        ) : recs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Lightbulb className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No recommendations yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              Run an investigation to generate AI recommendations
            </p>
          </div>
        ) : (
          recs.map((r) => {
            const tone = priorityTone(r.priority)
            return (
              <div
                key={r.id}
                className="rounded-lg border border-border/50 bg-background/30 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-ai" />
                  <ToneBadge tone={tone}>{r.priority ?? 'info'}</ToneBadge>
                  <span className="ml-auto font-mono text-[9px] font-semibold tracking-widest text-muted-foreground/50">AI</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-foreground">{r.title}</p>
                {r.description && (
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{r.description}</p>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
