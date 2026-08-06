'use client'

import { useState } from 'react'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import type { Tone } from '@/lib/data'
import { Clock, Bug, MousePointerClick, FileText, Video, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReplayMomentModal } from './replay-moment-modal'
import type { SessionRecordingState } from '@/lib/use-session-recording'

export type SessionEvent = {
  id: string
  event_name: string
  event_category: string | null
  screen_name: string | null
  properties: Record<string, unknown> | null
  timestamp: string
}

export type SessionError = {
  id: string
  error_type: string
  message: string
  severity: string
  screen: string | null
  created_at: string
}

type TimelineItem =
  | { kind: 'event'; id: string; timestamp: string; data: SessionEvent }
  | { kind: 'error'; id: string; timestamp: string; data: SessionError }

const severityTone: Record<string, Tone> = {
  fatal: 'critical', error: 'critical', warning: 'warning', info: 'intel',
}

function isFormFieldError(e: SessionEvent): boolean {
  return e.event_name === '$form_field' && e.properties?.hadError === true
}

function isIncompleteField(e: SessionEvent): boolean {
  return e.event_name === '$form_field' && e.properties?.completed === false
}

// Friction signals worth a "watch this moment" replay — real problems, not
// every ordinary click/hover. $rage_click/$dead_click are the SDK's own
// existing friction detectors; $form_abandon fires when a touched form was
// left without submitting — a real drop-off signal, not inferred.
const FRICTION_EVENTS = new Set(['$rage_click', '$dead_click', '$form_abandon'])
function isFrictionEvent(e: SessionEvent): boolean {
  return FRICTION_EVENTS.has(e.event_name) || isFormFieldError(e) || isIncompleteField(e)
}

function describeEvent(e: SessionEvent): string {
  if (e.event_name === '$page_view' || e.event_name === '$screen') {
    const page = (e.properties?.page ?? e.properties?.name ?? e.screen_name) as string | undefined
    return `Viewed ${page ?? 'page'}`
  }
  if (e.event_name === '$identify') return 'User identified'
  if (e.event_name === '$form_field') {
    const field = (e.properties?.fieldName as string | undefined) ?? 'field'
    return isFormFieldError(e) ? `Form field error — ${field}` : `Form field — ${field}`
  }
  return e.event_name.replace(/^\$/, '').replace(/_/g, ' ')
}

/** The page/screen a non-navigation event happened on — from its own
 * properties/screen_name if the SDK sent one (most behavior events do,
 * e.g. $click/$scroll_depth include `page`), else falls back to whatever
 * page was last viewed before it, so every row can show real context
 * instead of only $page_view rows. */
function pageOf(e: SessionEvent): string | undefined {
  const own = (e.properties?.page ?? e.properties?.name ?? e.screen_name) as string | undefined
  return own ?? undefined
}

export function InteractionTimeline({
  events,
  errors,
  cutoffTime,
  recording,
}: {
  events: SessionEvent[]
  errors: SessionError[]
  cutoffTime: string | null
  recording?: SessionRecordingState
}) {
  const [openMomentIso, setOpenMomentIso] = useState<string | null>(null)

  const items: TimelineItem[] = [
    ...events.map((e): TimelineItem => ({ kind: 'event', id: e.id, timestamp: e.timestamp, data: e })),
    ...errors.map((e): TimelineItem => ({ kind: 'error', id: e.id, timestamp: e.created_at, data: e })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Walk the sorted items once, tracking which page was most recently
  // viewed, so every row (not just $page_view rows) can show real page
  // context — falling back to the last known page when a row doesn't carry
  // its own (errors always carry `screen`; most behavior events carry
  // `properties.page`).
  let runningPage: string | undefined
  const pageContext = new Map<string, string | undefined>()
  for (const item of items) {
    const key = `${item.kind}-${item.id}`
    if (item.kind === 'error') {
      pageContext.set(key, item.data.screen ?? runningPage)
      continue
    }
    if (item.data.event_name === '$page_view' || item.data.event_name === '$screen') {
      runningPage = pageOf(item.data) ?? runningPage
      pageContext.set(key, runningPage)
    } else {
      pageContext.set(key, pageOf(item.data) ?? runningPage)
    }
  }

  const cutoffMs = cutoffTime ? new Date(cutoffTime).getTime() : null
  const hasRecording = !!recording && recording.kind !== 'none'

  return (
    <Card>
      <CardHead title="Interaction timeline" desc="Every captured event and error, in order" icon={<Clock className="h-4 w-4" />} />
      <div className="max-h-[500px] overflow-y-auto scrollbar-thin px-5 pb-5">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No events captured for this session yet.</p>
        ) : (
          <ol className="space-y-0.5">
            {items.map((item, i) => {
              const isFuture = cutoffMs != null && new Date(item.timestamp).getTime() > cutoffMs
              const page = pageContext.get(`${item.kind}-${item.id}`)
              const isPageViewRow = item.kind === 'event' && (item.data.event_name === '$page_view' || item.data.event_name === '$screen')
              const isFieldError = item.kind === 'event' && isFormFieldError(item.data)
              const isErrorish = item.kind === 'error' || isFieldError
              const validationMessage = item.kind === 'event' ? (item.data.properties?.validationMessage as string | undefined) : undefined
              // Only offer a replay link on rows that represent a real
              // problem — errors and friction signals — not every ordinary
              // click/hover/page-view. Watching "what happened here" only
              // matters when something actually went wrong.
              const showWatchButton = hasRecording && (item.kind === 'error' || (item.kind === 'event' && isFrictionEvent(item.data)))
              return (
                <li
                  key={`${item.kind}-${item.id}-${i}`}
                  className={cn(
                    'flex items-start gap-3 border-l-2 py-2 pl-3 transition-opacity',
                    isErrorish ? 'border-critical/40' : 'border-border/50',
                    isFuture && 'opacity-25',
                  )}
                >
                  <span className="mt-0.5 w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="mt-0.5 shrink-0">
                    {item.kind === 'error'
                      ? <Bug className="h-3.5 w-3.5 text-critical" />
                      : isFieldError
                      ? <AlertTriangle className="h-3.5 w-3.5 text-critical" />
                      : item.data.event_name === '$page_view' || item.data.event_name === '$screen'
                      ? <FileText className="h-3.5 w-3.5 text-intel" />
                      : <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {item.kind === 'error' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <ToneBadge tone={severityTone[item.data.severity] ?? 'intel'}>{item.data.severity}</ToneBadge>
                          <span className="text-xs font-medium text-foreground">{item.data.error_type}</span>
                          {page && <span className="truncate font-mono text-[10px] text-muted-foreground/80">on {page}</span>}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{item.data.message}</p>
                      </>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm', isFieldError ? 'font-medium text-critical' : 'text-foreground')}>{describeEvent(item.data)}</p>
                          {/* Page-view rows already say the page in their own text */}
                          {page && !isPageViewRow && <span className="truncate font-mono text-[10px] text-muted-foreground/70">on {page}</span>}
                        </div>
                        {isFieldError && validationMessage && (
                          <p className="mt-0.5 truncate font-mono text-xs text-critical/80">{validationMessage}</p>
                        )}
                      </div>
                    )}
                  </div>
                  {showWatchButton && (
                    <button
                      onClick={() => setOpenMomentIso(item.timestamp)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-critical/30 bg-critical/5 text-critical hover:bg-critical/10 transition-colors"
                      title="Watch this moment in the replay"
                    >
                      <Video className="h-3 w-3" />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {openMomentIso && recording && (
        <ReplayMomentModal recording={recording} targetIso={openMomentIso} onClose={() => setOpenMomentIso(null)} />
      )}
    </Card>
  )
}
