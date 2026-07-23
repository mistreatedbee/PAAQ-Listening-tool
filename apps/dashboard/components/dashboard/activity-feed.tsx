'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneBg, toneText } from '@/lib/tones'
import { Radio } from 'lucide-react'
import type { Tone } from '@/lib/data'

type FeedItem = {
  id: string
  time: string
  title: string
  meta: string
  severity: Tone
  category: string
}

const CATEGORIES = ['All', 'navigation', 'feature', 'auth', 'error', 'custom']

function categoryTone(cat: string | null): Tone {
  switch (cat) {
    case 'error': return 'critical'
    case 'auth': return 'warning'
    case 'feature': return 'healthy'
    case 'navigation': return 'intel'
    default: return 'intel'
  }
}

function toFeedItem(e: Record<string, unknown>): FeedItem {
  return {
    id: e.id as string,
    time: new Date(e.timestamp as string).toLocaleTimeString(),
    title: e.event_name as string,
    meta: [e.screen_name, e.event_category].filter(Boolean).join(' · '),
    severity: categoryTone(e.event_category as string | null),
    category: (e.event_category as string) ?? 'custom',
  }
}

export function ActivityFeed() {
  const { app } = useConnectedApp()
  const [items, setItems] = useState<FeedItem[]>([])
  const [filter, setFilter] = useState('All')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    sb.from('events')
      .select('id, event_name, screen_name, event_category, timestamp')
      .eq('project_id', app.id)
      .order('timestamp', { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (data) setItems(data.map(toFeedItem))
      })

    const channel = sb
      .channel(`activity-feed-${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `project_id=eq.${app.id}` }, (payload) => {
        setItems((prev) => [toFeedItem(payload.new as Record<string, unknown>), ...prev].slice(0, 60))
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    return () => { sb.removeChannel(channel) }
  }, [app.id])

  const filtered = filter === 'All' ? items : items.filter((e) => e.category === filter)

  return (
    <Card className="flex h-full flex-col">
      <CardHead
        title="Real-Time Activity"
        desc="Events captured by the PAAQ SDK"
        icon={<Radio className="h-4 w-4" />}
        action={
          <span className={cn('flex items-center gap-1.5 text-[11px] font-medium', connected ? 'text-healthy' : 'text-muted-foreground')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-healthy animate-pulse-dot' : 'bg-muted-foreground')} />
            {connected ? 'Live' : 'Connecting…'}
          </span>
        }
      />
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto px-5 pb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              filter === c
                ? 'border-intel/40 bg-intel/15 text-intel'
                : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground',
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Radio className="h-8 w-8 opacity-20" />
            <p className="text-sm text-center px-4">
              {items.length === 0
                ? 'No events yet. Send events from your Flutter app.'
                : 'No events in this category.'}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((e) => (
              <li key={e.id} className="animate-rise">
                <div className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/40">
                  <div className="flex flex-col items-center">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneBg[e.severity])} />
                    <span className="mt-1 w-px flex-1 bg-border/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm font-medium', toneText[e.severity])}>{e.title}</p>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{e.time}</span>
                    </div>
                    {e.meta && <p className="mt-0.5 text-xs text-muted-foreground">{e.meta}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
