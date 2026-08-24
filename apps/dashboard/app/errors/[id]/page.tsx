'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText, toneBg } from '@/lib/tones'
import { ArrowLeft, Bug, Terminal, CheckCircle2, EyeOff, Sparkles, Wrench, Loader2, User, Video } from 'lucide-react'
import { GenerateFix } from '@/components/dashboard/generate-fix'
import { FixExecution } from '@/components/dashboard/fix-execution'
import { ReplayMomentModal, type PrecedingItem } from '@/components/sessions/replay-moment-modal'
import { useSessionRecording } from '@/lib/use-session-recording'
import type { Tone } from '@/lib/data'

type DbError = {
  id: string
  project_id: string
  session_id: string | null
  error_type: string
  message: string
  severity: string
  status: string
  screen: string | null
  stack_trace: string | null
  context: Record<string, unknown> | null
  created_at: string
}

type EvidenceUser = { external_user_id: string | null; email: string | null }

const severityTone: Record<string, Tone> = {
  fatal: 'critical', error: 'critical', warning: 'warning', info: 'intel',
}
const statusTone: Record<string, Tone> = {
  open: 'critical', resolved: 'healthy', ignored: 'intel',
}

/** Mirrors interaction-timeline.tsx's describeEvent — kept local since this
 * page only needs a one-line label for the "leading up to this" strip, not
 * the full row-rendering logic. */
function describeEventName(name: string, properties: Record<string, unknown> | null): string {
  if (name === '$page_view' || name === '$screen') {
    const page = (properties?.page ?? properties?.name) as string | undefined
    return `Viewed ${page ?? 'page'}`
  }
  if (name === '$identify') return 'User identified'
  if (name === '$form_field') {
    const field = (properties?.fieldName as string | undefined) ?? 'field'
    return properties?.hadError === true ? `Form field error — ${field}` : `Form field — ${field}`
  }
  if (name === '$click' || name === '$rage_click' || name === '$dead_click' || name === '$double_click') {
    const label = (properties?.targetLabel ?? properties?.targetSelector) as string | undefined
    const verb = name === '$rage_click' ? 'Rage-clicked' : name === '$dead_click' ? 'Dead-clicked' : name === '$double_click' ? 'Double-clicked' : 'Clicked'
    return label ? `${verb} “${label}”` : verb
  }
  return name.replace(/^\$/, '').replace(/_/g, ' ')
}

export default function ErrorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [error, setError] = useState<DbError | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [canMerge, setCanMerge] = useState(false)
  const [startingFix, setStartingFix] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  const [executing, setExecuting] = useState<{ recommendationId: string; title: string } | null>(null)
  const [evidenceUser, setEvidenceUser] = useState<EvidenceUser | null>(null)
  const [precedingEvents, setPrecedingEvents] = useState<PrecedingItem[]>([])
  const [contextLoaded, setContextLoaded] = useState(false)
  const [showReplay, setShowReplay] = useState(false)
  // Deferred until the user actually clicks "View replay" — a session's DOM
  // recording can be several MB across many chunks (real snapshots run
  // 100-700KB each), and fetching/parsing all of that unconditionally on
  // every error page load, just in case someone clicks replay, was real,
  // unnecessary main-thread and network pressure on a page that opens with
  // an AI call already in flight.
  const recording = useSessionRecording(showReplay ? error?.session_id ?? null : null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const sb = createClient()
    sb.from('errors')
      .select('id, project_id, session_id, error_type, message, severity, status, screen, stack_trace, context, created_at')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setError(data as DbError | null)
        setLoading(false)
      })
  }, [id])

  // Real evidence for the AI diagnosis and the "leading up to this" strip —
  // the affected user's identity and the real events captured on this
  // session immediately before the error, not inferred from the message.
  useEffect(() => {
    if (!error?.session_id) { setContextLoaded(true); return }
    const sb = createClient()
    Promise.all([
      sb.from('sessions').select('user_id').eq('id', error.session_id).maybeSingle(),
      sb.from('events').select('event_name, properties, timestamp')
        .eq('session_id', error.session_id)
        .lt('timestamp', error.created_at)
        .order('timestamp', { ascending: false })
        .limit(8),
    ]).then(async ([{ data: session }, { data: eventRows }]) => {
      if (session?.user_id) {
        const { data: userRow } = await sb.from('users').select('external_user_id, email').eq('id', session.user_id).maybeSingle()
        setEvidenceUser(userRow as EvidenceUser | null)
      }
      const ordered = (eventRows ?? []).slice().reverse()
      setPrecedingEvents(ordered.map((e) => ({
        time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        label: describeEventName(e.event_name, e.properties as Record<string, unknown> | null),
        isError: false,
      })))
      setContextLoaded(true)
    })
  }, [error?.session_id, error?.created_at])

  useEffect(() => {
    if (!error?.project_id) return
    fetch('/api/tenant/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: error.project_id }),
    })
      .then((r) => r.json())
      .then((data) => setCanMerge(data.role === 'owner' || data.role === 'admin'))
      .catch(() => {})
  }, [error?.project_id])

  async function handleFixWithAgent() {
    if (!error) return
    setStartingFix(true)
    setFixError(null)
    try {
      const res = await fetch('/api/fix/from-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: error.project_id, errorId: error.id }),
      })
      const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response from fix service' }))
      if (!res.ok || !data?.ok) {
        setFixError(data?.error ?? `Fix service unavailable (HTTP ${res.status})`)
        return
      }
      setExecuting({ recommendationId: data.recommendationId, title: data.title })
    } catch {
      setFixError('Failed to start the fix agent: network or unexpected error')
    } finally {
      setStartingFix(false)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!error || error.status === newStatus) return
    setUpdating(true)
    try {
      const sb = createClient()
      const { error: dbErr } = await sb.from('errors').update({ status: newStatus }).eq('id', id)
      if (dbErr) {
        showToast(`Update failed: ${dbErr.message}`)
        return
      }
      setError({ ...error, status: newStatus })
      showToast(`Error marked as ${newStatus}`)
    } catch {
      showToast('Update failed: network or unexpected error')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
  }

  if (!error) {
    return (
      <div className="space-y-4">
        <Link href="/errors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All errors
        </Link>
        <p className="text-muted-foreground">Error not found.</p>
      </div>
    )
  }

  const sevTone = severityTone[error.severity] ?? 'intel'
  const sTone = statusTone[error.status] ?? 'intel'
  const created = new Date(error.created_at).toLocaleString()

  return (
    <div className="space-y-6">
      {showReplay && recording && (
        <ReplayMomentModal
          recording={recording}
          targetIso={error.created_at}
          precedingItems={precedingEvents}
          currentLabel={`${error.error_type}: ${error.message}`}
          playFromIso={(error.context?.lastClick as { at?: string } | undefined)?.at}
          lastActionLabel={
            (error.context?.lastClick as { targetLabel?: string } | undefined)?.targetLabel
              ? `Clicked “${(error.context!.lastClick as { targetLabel: string }).targetLabel}”`
              : precedingEvents.filter((p) => /^((Rage-|Dead-|Double-)?[Cc]licked)/.test(p.label)).at(-1)?.label
          }
          onClose={() => setShowReplay(false)}
        />
      )}

      {executing && (
        <FixExecution
          projectId={error.project_id}
          recommendationId={executing.recommendationId}
          title={executing.title}
          canMerge={canMerge}
          onClose={() => setExecuting(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <Link href="/errors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All errors
      </Link>

      <PageHeader
        icon={<Bug className="h-5 w-5 text-critical" />}
        title={error.message}
        desc={`${error.error_type} · ${created}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={sevTone}>{error.severity}</ToneBadge>
            <ToneBadge tone={sTone}>{error.status}</ToneBadge>
            {error.status !== 'resolved' && (
              <button
                onClick={() => handleUpdateStatus('resolved')}
                disabled={updating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-healthy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {updating ? 'Updating…' : 'Mark resolved'}
              </button>
            )}
            {error.status === 'open' && (
              <button
                onClick={() => handleUpdateStatus('ignored')}
                disabled={updating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Ignore
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Severity', value: error.severity, tone: sevTone },
          { label: 'Status', value: error.status, tone: sTone },
          { label: 'Type', value: error.error_type, tone: 'intel' as Tone },
          { label: 'Screen', value: error.screen ?? '—', tone: 'intel' as Tone },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={cn('mt-2 text-sm font-semibold', toneText[s.tone])}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* AI Fix — shown for open/unresolved errors */}
      {error.status !== 'resolved' && (
        <Card>
          <CardHead
            title="Generate Fix"
            desc="Quick diagnosis, or hand it to the same real fix agent used for recommendations — explores the repo, proposes a plan for your approval, then opens a real PR"
            icon={<Sparkles className="h-4 w-4 text-ai" />}
          />
          <div className="space-y-4 px-5 pb-5">
            {(evidenceUser || error.session_id) && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
                {evidenceUser && (
                  <span className="flex items-center gap-1.5 text-foreground">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {evidenceUser.email ?? evidenceUser.external_user_id ?? 'Anonymous'}
                  </span>
                )}
                {error.session_id && (
                  <Link href={`/sessions/${error.session_id}`} className="flex items-center gap-1.5 text-intel hover:underline">
                    <Video className="h-3.5 w-3.5" /> View session
                  </Link>
                )}
                {error.session_id && (
                  <button onClick={() => setShowReplay(true)} className="flex items-center gap-1.5 text-intel hover:underline">
                    <Video className="h-3.5 w-3.5" /> View replay at this moment
                  </button>
                )}
              </div>
            )}

            <GenerateFix
              autoRun={contextLoaded}
              payload={{
                errorId: error.id,
                message: error.message,
                errorType: error.error_type,
                severity: error.severity,
                screen: error.screen,
                stackTrace: error.stack_trace,
                context: error.context,
                precedingEvents,
                userIdentity: evidenceUser ? { email: evidenceUser.email, externalUserId: evidenceUser.external_user_id } : null,
              }}
            />

            <div className="border-t border-border/50 pt-4">
              <button
                onClick={handleFixWithAgent}
                disabled={startingFix}
                className="inline-flex items-center gap-2 rounded-lg border border-ai/30 bg-ai px-3.5 py-2 text-sm font-semibold text-ai-foreground transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startingFix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                Fix with AI Agent
              </button>
              <p className="mt-1.5 text-xs text-muted-foreground">Real repo exploration, a plan you approve, then a real branch and PR — same pipeline as Recommendations.</p>
              {fixError && <p className="mt-1.5 text-xs text-critical">{fixError}</p>}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHead title="Error Message" icon={<Bug className="h-4 w-4" />} />
            <div className="px-5 pb-5">
              <div className="rounded-lg border border-border/60 bg-background/60 p-4 font-mono text-sm break-all text-foreground/90">
                {error.message}
              </div>
            </div>
          </Card>

          {error.stack_trace && (
            <Card>
              <CardHead title="Stack Trace" icon={<Terminal className="h-4 w-4" />} />
              <div className="px-5 pb-5">
                <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-4 font-mono text-xs text-foreground/80 whitespace-pre-wrap break-all">
                  {error.stack_trace}
                </pre>
              </div>
            </Card>
          )}

          {error.context && Object.keys(error.context).length > 0 && (
            <Card>
              <CardHead title="Context" desc="Additional metadata captured at the time of the error" />
              <div className="px-5 pb-5">
                <div className="rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs">
                  {Object.entries(error.context).map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-0.5">
                      <span className="w-32 shrink-0 text-muted-foreground">{k}</span>
                      <span className="break-all text-foreground/90">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHead title="Details" />
            <div className="space-y-3 px-5 pb-5">
              {[
                { label: 'ID', value: error.id },
                { label: 'Type', value: error.error_type },
                { label: 'Severity', value: error.severity },
                { label: 'Status', value: error.status },
                { label: 'Screen', value: error.screen ?? '—' },
                { label: 'Captured', value: created },
              ].map((r) => (
                <div key={r.label} className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className="text-right text-xs font-medium text-foreground break-all max-w-[60%]">{r.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Status" />
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', toneBg[sTone], error.status === 'open' && 'animate-pulse-dot')} />
                <span className={cn('text-sm font-medium', toneText[sTone])}>{error.status}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
