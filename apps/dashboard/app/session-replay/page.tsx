'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { PlaySquare, Smartphone, Monitor, Tablet } from 'lucide-react'
import { PageHeader, Card, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

type SessionListRow = {
  id: string
  started_at: string
  duration: number | null
  status: string
  outcome: string | null
  platform: string | null
  device_type: string | null
  os_name: string | null
  browser_name: string | null
  page_count: number | null
  interaction_count: number | null
}

const outcomeTone: Record<string, Tone> = {
  completed: 'healthy',
  abandoned: 'warning',
  timed_out: 'warning',
  logged_out: 'intel',
  crashed: 'critical',
  force_closed: 'critical',
}

const deviceIcon: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
}

function fmtDuration(seconds: number | null) {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  return `${m}m ${seconds % 60}s`
}

type OutcomeFilter = 'all' | 'completed' | 'abandoned' | 'timed_out' | 'crashed'

export default function SessionReplayPage() {
  const { app } = useConnectedApp()
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    sb.from('sessions')
      .select('id, started_at, duration, status, outcome, platform, device_type, os_name, browser_name, page_count, interaction_count')
      .eq('project_id', app.id)
      .order('started_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setSessions((data ?? []) as SessionListRow[])
        setLoading(false)
      })
  }, [app.id])

  const platforms = [...new Set(sessions.map((s) => s.platform).filter(Boolean))] as string[]

  const filtered = sessions.filter((s) => {
    if (outcomeFilter !== 'all' && s.outcome !== outcomeFilter) return false
    if (platformFilter !== 'all' && s.platform !== platformFilter) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PlaySquare className="h-5 w-5" />}
        title="Session Replay"
        desc="Browse real captured sessions and replay their timeline — device, pages, events and errors, in order."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
          <div className="flex gap-1">
            {(['all', 'completed', 'abandoned', 'timed_out', 'crashed'] as OutcomeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setOutcomeFilter(f)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  outcomeFilter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f === 'all' ? 'All' : f.replace('_', ' ')}
              </button>
            ))}
          </div>
          {platforms.length > 1 && (
            <div className="ml-auto flex gap-1">
              <button
                onClick={() => setPlatformFilter('all')}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  platformFilter === 'all' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                All platforms
              </button>
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                    platformFilter === p ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <PlaySquare className="h-8 w-8 opacity-20" />
            <p className="text-sm">{sessions.length === 0 ? 'No sessions captured yet.' : 'No sessions match this filter.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((s) => {
              const Icon = deviceIcon[s.device_type ?? ''] ?? Monitor
              return (
                <button
                  key={s.id}
                  onClick={() => router.push(`/sessions/${s.id}`)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/20"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ToneBadge tone={outcomeTone[s.outcome ?? ''] ?? 'intel'}>{s.outcome ?? s.status}</ToneBadge>
                      <span className="text-xs text-muted-foreground">
                        {[s.platform, s.os_name, s.browser_name].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground">{new Date(s.started_at).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                    <span>{fmtDuration(s.duration)}</span>
                    <span>{s.page_count ?? 0} pages</span>
                    <span>{s.interaction_count ?? 0} events</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
