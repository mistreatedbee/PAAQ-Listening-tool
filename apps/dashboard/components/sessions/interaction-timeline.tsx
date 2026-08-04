import { Card, CardHead, ToneBadge } from '@/components/kit'
import type { Tone } from '@/lib/data'
import { Clock, Bug, MousePointerClick, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

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

function describeEvent(e: SessionEvent): string {
  if (e.event_name === '$page_view' || e.event_name === '$screen') {
    const page = (e.properties?.page ?? e.properties?.name ?? e.screen_name) as string | undefined
    return `Viewed ${page ?? 'page'}`
  }
  if (e.event_name === '$identify') return 'User identified'
  return e.event_name.replace(/^\$/, '').replace(/_/g, ' ')
}

export function InteractionTimeline({
  events,
  errors,
  cutoffTime,
}: {
  events: SessionEvent[]
  errors: SessionError[]
  cutoffTime: string | null
}) {
  const items: TimelineItem[] = [
    ...events.map((e): TimelineItem => ({ kind: 'event', id: e.id, timestamp: e.timestamp, data: e })),
    ...errors.map((e): TimelineItem => ({ kind: 'error', id: e.id, timestamp: e.created_at, data: e })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const cutoffMs = cutoffTime ? new Date(cutoffTime).getTime() : null

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
              return (
                <li
                  key={`${item.kind}-${item.id}-${i}`}
                  className={cn(
                    'flex items-start gap-3 border-l-2 py-2 pl-3 transition-opacity',
                    item.kind === 'error' ? 'border-critical/40' : 'border-border/50',
                    isFuture && 'opacity-25',
                  )}
                >
                  <span className="mt-0.5 w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="mt-0.5 shrink-0">
                    {item.kind === 'error'
                      ? <Bug className="h-3.5 w-3.5 text-critical" />
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
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{item.data.message}</p>
                      </>
                    ) : (
                      <p className="text-sm text-foreground">{describeEvent(item.data)}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </Card>
  )
}
