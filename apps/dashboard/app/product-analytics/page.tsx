'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { BarChart3, RefreshCw, Sparkles } from 'lucide-react'
import type { Tone } from '@/lib/data'

type RawEvent = {
  event_name: string
  event_category: string | null
  screen_name: string | null
  user_id: string | null
  session_id: string | null
  timestamp: string
}

type Bar = { name: string; count: number; pct: number }

function aggregate(items: string[]): Bar[] {
  const counts: Record<string, number> = {}
  for (const v of items) counts[v] = (counts[v] ?? 0) + 1
  const max = Math.max(1, ...Object.values(counts))
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }))
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TONE_FOR_CAT: Record<string, Tone> = {
  navigation: 'intel',
  error: 'critical',
  auth: 'warning',
  feature: 'healthy',
}

export default function ProductAnalyticsPage() {
  const [events, setEvents] = useState<RawEvent[]>([])
  const [sessionCount, setSessionCount] = useState(0)
  const [userCount, setUserCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const load = async () => {
    const sb = createClient()
    const [{ data }, { count: sc }, { count: uc }] = await Promise.all([
      sb.from('events')
        .select('event_name, event_category, screen_name, user_id, session_id, timestamp')
        .order('timestamp', { ascending: false })
        .limit(2000),
      sb.from('sessions').select('*', { count: 'exact', head: true }),
      sb.from('users').select('*', { count: 'exact', head: true }),
    ])
    setEvents((data ?? []) as RawEvent[])
    setSessionCount(sc ?? 0)
    setUserCount(uc ?? 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const runAnalysis = async () => {
    setAnalysing(true)
    showToast('Running AI analysis on product data…')
    const sb = createClient()
    const { error } = await sb.functions.invoke('analyze')
    if (error) showToast('Analysis failed — check ANTHROPIC_API_KEY is set')
    else showToast('Analysis complete — Feature Health and User Journey pages updated')
    setAnalysing(false)
  }

  const now = Date.now()
  const ms1d = 86_400_000
  const ms7d = 7 * ms1d

  const weekEvents = events.filter((e) => now - new Date(e.timestamp).getTime() < ms7d)
  const dayEvents = events.filter((e) => now - new Date(e.timestamp).getTime() < ms1d)

  const wau = new Set(weekEvents.filter((e) => e.user_id).map((e) => e.user_id)).size
  const dau = new Set(dayEvents.filter((e) => e.user_id).map((e) => e.user_id)).size

  const topEvents = aggregate(events.map((e) => e.event_name)).slice(0, 10)
  const maxEventCount = Math.max(1, ...topEvents.map((e) => e.count))

  const topScreens = aggregate(
    events.filter((e) => e.screen_name).map((e) => e.screen_name as string),
  ).slice(0, 8)
  const maxScreenCount = Math.max(1, ...topScreens.map((s) => s.count))

  const categories = aggregate(
    events.map((e) => e.event_category ?? 'uncategorized'),
  )

  // Daily event volume — last 14 days
  const dailyMap: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    dailyMap[dayKey(new Date(now - i * ms1d).toISOString())] = 0
  }
  for (const e of events) {
    if (now - new Date(e.timestamp).getTime() < 14 * ms1d) {
      const k = dayKey(e.timestamp)
      if (k in dailyMap) dailyMap[k]++
    }
  }
  const daily = Object.entries(dailyMap)
  const maxDaily = Math.max(1, ...daily.map(([, c]) => c))

  const stats = [
    { label: 'Total Users', value: String(userCount), tone: 'intel' as Tone },
    { label: 'WAU', value: wau > 0 ? String(wau) : '—', tone: 'healthy' as Tone },
    { label: 'DAU', value: dau > 0 ? String(dau) : '—', tone: 'intel' as Tone },
    { label: 'Sessions', value: String(sessionCount), tone: 'intel' as Tone },
    { label: 'Events (7d)', value: String(weekEvents.length), tone: 'intel' as Tone },
    { label: 'Events (today)', value: String(dayEvents.length), tone: 'intel' as Tone },
  ]

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Product Analytics"
        desc="Funnels, retention and adoption analytics drawn directly from your live event stream."
        actions={
          <button
            onClick={runAnalysis}
            disabled={analysing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${analysing ? 'animate-spin' : ''}`} />
            {analysing ? 'Analysing…' : 'Run AI Analysis'}
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
      ) : events.length === 0 ? (
        <Card className="p-10 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">No events yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Send events from your app using the PAAQ SDK, then analytics will appear here automatically.
          </p>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums', toneText[s.tone])}>{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Daily volume chart */}
          <Card>
            <CardHead title="Daily Event Volume" desc="Last 14 days" />
            <div className="px-5 pb-5">
              <div className="flex h-28 items-end gap-1">
                {daily.map(([label, count]) => (
                  <div key={label} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-intel/60 transition-all hover:bg-intel"
                      style={{ height: `${Math.max(4, (count / maxDaily) * 96)}px` }}
                      title={`${count} events`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1">
                {daily.map(([label], i) => (
                  <div key={label} className="flex-1 text-center">
                    {(i === 0 || i === 6 || i === 13) && (
                      <span className="text-[9px] text-muted-foreground">{label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top events */}
            <Card>
              <CardHead title="Top Events" desc={`${topEvents.length} unique event types`} />
              <div className="space-y-2 px-5 pb-5">
                {topEvents.map((e) => (
                  <div key={e.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium text-foreground">{e.name}</span>
                      <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{e.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                      <div
                        className="h-full rounded-full bg-intel transition-all"
                        style={{ width: `${Math.round((e.count / maxEventCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top screens */}
            <Card>
              <CardHead title="Top Screens" desc={`${topScreens.length} unique screens`} />
              <div className="space-y-2 px-5 pb-5">
                {topScreens.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No screen_name on events yet — pass screen when calling Listening.track()
                  </p>
                ) : (
                  topScreens.map((s) => (
                    <div key={s.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium text-foreground">{s.name}</span>
                        <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{s.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                        <div
                          className="h-full rounded-full bg-ai/70 transition-all"
                          style={{ width: `${Math.round((s.count / maxScreenCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Event categories */}
          {categories.length > 0 && (
            <Card>
              <CardHead title="Event Categories" desc="Breakdown of all events by category" />
              <div className="flex flex-wrap gap-3 px-5 pb-5">
                {categories.map((c) => {
                  const tone = TONE_FOR_CAT[c.name] ?? 'intel'
                  return (
                    <div key={c.name} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
                      <div className={cn('h-2 w-2 rounded-full', {
                        'bg-intel': tone === 'intel',
                        'bg-healthy': tone === 'healthy',
                        'bg-warning': tone === 'warning',
                        'bg-critical': tone === 'critical',
                      })} />
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{c.count}</span>
                      <span className="text-[10px] text-muted-foreground opacity-60">{c.pct}%</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* AI note */}
          <Card className="flex items-start gap-3 border-ai/20 bg-ai/[0.04] p-5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ai" />
            <div>
              <p className="text-sm font-medium text-ai">AI Analysis available</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Click "Run AI Analysis" to compute feature health scores, reconstruct user journeys, detect anomalies,
                and generate AI insights — all from your live event data.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
