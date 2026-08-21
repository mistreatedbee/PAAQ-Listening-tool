'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card } from '@/components/kit'
import { Radio, ArrowLeft, PlaySquare } from 'lucide-react'
import { SessionOverviewCard, type SessionRow, type SessionUser } from '@/components/sessions/session-overview-card'
import { InteractionTimeline, type SessionEvent, type SessionError } from '@/components/sessions/interaction-timeline'
import { PageBreakdown, type SessionPage } from '@/components/sessions/page-breakdown'
import { NavigationMap } from '@/components/sessions/navigation-map'
import { AiSummaryPanel, type SessionAiSummary } from '@/components/sessions/ai-summary-panel'
import { TimelineScrubber } from '@/components/sessions/timeline-scrubber'
import { FormAnalyticsPanel, type FormFieldStat } from '@/components/sessions/form-analytics-panel'
import { DomReplayPlayer } from '@/components/sessions/dom-replay-player'
import { ScreenshotReplayPlayer } from '@/components/sessions/screenshot-replay-player'
import { useSessionRecording } from '@/lib/use-session-recording'

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [session, setSession] = useState<SessionRow | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [isReturning, setIsReturning] = useState<boolean | null>(null)
  const [lifetimeSessionCount, setLifetimeSessionCount] = useState<number | null>(null)
  const [environment, setEnvironment] = useState<string | null>(null)
  const [pages, setPages] = useState<SessionPage[]>([])
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [errors, setErrors] = useState<SessionError[]>([])
  const [summary, setSummary] = useState<SessionAiSummary | null>(null)
  const [formFields, setFormFields] = useState<FormFieldStat[]>([])
  const [loading, setLoading] = useState(true)
  const [scrubTime, setScrubTime] = useState<string | null>(null)
  const recording = useSessionRecording(session?.id ?? null)

  useEffect(() => {
    if (!id) return
    const sb = createClient()

    const load = async () => {
      const { data: sessionRow } = await sb
        .from('sessions')
        .select('id, project_id, user_id, started_at, ended_at, duration, status, outcome, platform, browser_name, browser_version, os_name, os_version, device_type, device_model, screen_width, screen_height, viewport_width, viewport_height, timezone, locale, connection_type, app_version, entry_url, referrer, active_seconds, idle_seconds, time_to_first_interaction_ms, page_count, interaction_count, rage_click_count, dead_click_count, form_abandon_count')
        .eq('id', id)
        .maybeSingle()

      if (!sessionRow) { setLoading(false); return }
      setSession(sessionRow as SessionRow)

      const [{ data: project }, { data: pageRows }, { data: eventRows }, { data: errorRows }, { data: summaryRow }, { data: formFieldRows }] = await Promise.all([
        sb.from('tenant_projects').select('environment').eq('id', sessionRow.project_id).maybeSingle(),
        sb.from('session_pages').select('id, sequence, page_path, entered_at, exited_at, duration_ms, interaction_count, error_count, scroll_depth_pct').eq('session_id', id).order('sequence', { ascending: true }),
        sb.from('events').select('id, event_name, event_category, screen_name, properties, timestamp').eq('session_id', id).order('timestamp', { ascending: true }),
        sb.from('errors').select('id, error_type, message, severity, screen, created_at, context').eq('session_id', id).order('created_at', { ascending: true }),
        sb.from('session_ai_summaries').select('narrative, confidence, generated_at, friction_score, satisfaction_score, drop_off_probability, conversion_probability, engagement_score, complexity_score').eq('session_id', id).maybeSingle(),
        sb.from('form_field_stats').select('id, page_path, form_name, field_name, time_spent_ms, backspace_count, had_error, completed').eq('session_id', id).order('created_at', { ascending: true }),
      ])

      setEnvironment(project?.environment ?? null)
      setPages((pageRows ?? []) as SessionPage[])
      setEvents((eventRows ?? []) as SessionEvent[])
      setErrors((errorRows ?? []) as SessionError[])
      setSummary(summaryRow as SessionAiSummary | null)
      setFormFields((formFieldRows ?? []) as FormFieldStat[])

      if (sessionRow.user_id) {
        const [{ data: userRow }, { count }] = await Promise.all([
          sb.from('users').select('id, external_user_id, email, created_at').eq('id', sessionRow.user_id).maybeSingle(),
          sb.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', sessionRow.user_id),
        ])
        setUser(userRow as SessionUser | null)
        setLifetimeSessionCount(count ?? null)
        setIsReturning((count ?? 0) > 1)
      }

      setLoading(false)
    }

    load()

    const channel = sb
      .channel(`session-detail:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `session_id=eq.${id}` },
        (payload) => setEvents((prev) => [...prev, payload.new as SessionEvent]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'errors', filter: `session_id=eq.${id}` },
        (payload) => setErrors((prev) => [...prev, payload.new as SessionError]))
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-3 py-32 text-center">
        <PlaySquare className="h-8 w-8 text-muted-foreground opacity-20" />
        <p className="text-sm text-muted-foreground">Session not found.</p>
        <button onClick={() => router.push('/session-replay')} className="text-xs text-intel hover:underline">
          Back to Sessions
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PlaySquare className="h-5 w-5" />}
        title={`Session · ${session.id.slice(0, 8)}`}
        desc={`${new Date(session.started_at).toLocaleString()}${session.status === 'active' ? ' · still active' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {session.status === 'active' && (
              <span className="flex items-center gap-1.5 rounded-full border border-healthy/25 bg-healthy/10 px-2.5 py-1 text-[10px] font-semibold text-healthy">
                <Radio className="h-3 w-3 animate-pulse" /> LIVE
              </span>
            )}
            <button
              onClick={() => router.push('/session-replay')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>
        }
      />

      <SessionOverviewCard
        session={session}
        user={user}
        isReturning={isReturning}
        lifetimeSessionCount={lifetimeSessionCount}
        environment={environment}
      />

      {/* `session.platform` describes the host framework (react/vue/nextjs/
          flutter/...), never literally 'web' — branching the replay player
          on it meant DomReplayPlayer never rendered for any real web SDK
          session, only ScreenshotReplayPlayer, which then found the wrong
          recording kind and rendered nothing. The real signal for which
          player to use is the recording's own kind, already loaded above. */}
      {recording.kind === 'screenshots' ? (
        <ScreenshotReplayPlayer sessionId={session.id} />
      ) : (
        <DomReplayPlayer sessionId={session.id} />
      )}

      {events.length > 0 && (
        <TimelineScrubber startedAt={session.started_at} endedAt={session.ended_at} onTimeChange={setScrubTime} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <InteractionTimeline events={events} errors={errors} cutoffTime={scrubTime} recording={recording} />
        <div className="space-y-4">
          <NavigationMap pages={pages} />
          <AiSummaryPanel sessionId={session.id} summary={summary} onGenerated={setSummary} />
        </div>
      </div>

      <PageBreakdown pages={pages} errors={errors} />

      <FormAnalyticsPanel fields={formFields} />

      {errors.length === 0 && events.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No interaction data captured for this session yet — it may have ended before any events were sent.
          </p>
        </Card>
      )}
    </div>
  )
}
