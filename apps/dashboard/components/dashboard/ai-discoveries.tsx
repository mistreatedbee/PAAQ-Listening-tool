'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Tone } from '@/lib/data'

type Discovery = {
  id: string
  title: string
  category: string
  description: string | null
  created_at: string
}

function categoryTone(cat: string): Tone {
  if (cat === 'error' || cat === 'security') return 'critical'
  if (cat === 'performance' || cat === 'warning') return 'warning'
  if (cat === 'success' || cat === 'growth') return 'healthy'
  return 'ai'
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function AiDiscoveries() {
  const { app } = useConnectedApp()
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    Promise.all([
      sb.from('ai_insights')
        .select('id, title, category, description, created_at')
        .eq('project_id', app.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(6),
      sb.from('ai_insights')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', app.id)
        .gte('created_at', today.toISOString()),
    ]).then(([{ data }, { count }]) => {
      setDiscoveries((data ?? []) as Discovery[])
      setTotal(count ?? 0)
      setLoading(false)
    })
  }, [app.id])

  return (
    <Card>
      <CardHead
        title="AI Discoveries Today"
        desc="What PAAQ Intelligence has learned about your application in the last 24 hours"
        icon={<Sparkles className="h-4 w-4 text-ai" />}
        action={
          <Link href="/ai-insights" className="flex items-center gap-1 text-xs font-medium text-intel hover:underline">
            All {total > 0 ? `(${total})` : ''} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="px-5 pb-5">
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg border border-border/40 bg-card/60" />
            ))}
          </div>
        ) : discoveries.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ai/10">
              <Sparkles className="h-6 w-6 text-ai/50" />
            </div>
            <p className="text-sm font-medium text-foreground">No discoveries yet today</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              AI agents will surface insights as they explore and learn your connected application.
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {discoveries.map((d) => {
              const tone = categoryTone(d.category)
              return (
                <div
                  key={d.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-background/30 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <ToneBadge tone={tone}>{d.category}</ToneBadge>
                    <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 tabular-nums">
                      {timeAgo(d.created_at)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{d.title}</p>
                  {d.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{d.description}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
