'use client'

import { useEffect, useRef, useState } from 'react'
import 'rrweb-player/dist/style.css'
import { X, Loader2, Video, Camera, AlertTriangle } from 'lucide-react'
import type { SessionRecordingState } from '@/lib/use-session-recording'

type RrwebEvent = { type?: number; timestamp?: number }

// rrweb event type codes — Meta (4) always precedes FullSnapshot (2) at
// recording start and at every periodic checkout; a player needs one of
// these as its base DOM state to render anything at all.
const RRWEB_META = 4
const RRWEB_FULL_SNAPSHOT = 2

const PRE_ROLL_MS = 15_000
const POST_ROLL_MS = 5_000

export type PrecedingItem = { time: string; label: string; isError: boolean }

/**
 * Clips a full session's rrweb events down to a real, short window around
 * `targetMs` (15s before / 5s after, matching how this is meant to be used
 * — "what led up to this and what happened right after," not the whole
 * session). rrweb can only start rendering from a real FullSnapshot, so the
 * clip starts at the latest one at-or-before the window rather than exactly
 * PRE_ROLL_MS early — on a recording with sparse snapshots that can be
 * earlier than 15s, but it's always real and always far short of the full
 * session, and gets tighter as the SDK's snapshot cadence shortens.
 */
function clipDomEvents(events: RrwebEvent[], targetMs: number): RrwebEvent[] | null {
  const windowStart = targetMs - PRE_ROLL_MS
  const windowEnd = targetMs + POST_ROLL_MS

  let snapshotIdx = -1
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.type === RRWEB_FULL_SNAPSHOT && typeof e.timestamp === 'number' && e.timestamp <= windowStart) snapshotIdx = i
  }
  if (snapshotIdx === -1) {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      if (e.type === RRWEB_FULL_SNAPSHOT && typeof e.timestamp === 'number' && e.timestamp <= targetMs) snapshotIdx = i
    }
  }
  if (snapshotIdx === -1) snapshotIdx = events.findIndex((e) => e.type === RRWEB_FULL_SNAPSHOT)
  if (snapshotIdx === -1) return null

  const startIdx = snapshotIdx > 0 && events[snapshotIdx - 1].type === RRWEB_META ? snapshotIdx - 1 : snapshotIdx
  const clipped = events.slice(startIdx).filter((e) => typeof e.timestamp !== 'number' || e.timestamp <= windowEnd)
  return clipped.length > 0 ? clipped : null
}

/** Self-contained lightbox opened from a timeline row: shows the real
 * screen state at that exact moment immediately (a paused frame — a real
 * screenshot for screenshot-kind recordings, a real reconstructed DOM frame
 * for DOM recordings), with a short ~20s clip around it to actually watch —
 * never the whole session — plus the real events that led up to it. */
export function ReplayMomentModal({
  recording,
  targetIso,
  precedingItems,
  currentLabel,
  onClose,
}: {
  recording: SessionRecordingState
  targetIso: string
  precedingItems?: PrecedingItem[]
  currentLabel?: string
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function mount() {
      if (recording.kind === 'loading') return
      if (recording.kind === 'none') { setState('unavailable'); return }

      if (recording.kind === 'screenshots') {
        const targetMs = new Date(targetIso).getTime()
        const nearest = recording.chunks.reduce<typeof recording.chunks[number] | null>((best, c) => {
          const diff = Math.abs(new Date(c.capturedAt).getTime() - targetMs)
          const bestDiff = best ? Math.abs(new Date(best.capturedAt).getTime() - targetMs) : Infinity
          return diff < bestDiff ? c : best
        }, null)
        if (nearest) { setScreenshotUrl(nearest.url); setState('ready') } else setState('unavailable')
        return
      }

      // kind === 'dom'
      const targetMs = new Date(targetIso).getTime()
      const clipped = clipDomEvents(recording.events as RrwebEvent[], targetMs)
      if (!clipped) { setState('unavailable'); return }
      const clipStartMs = clipped[0].timestamp as number
      const offsetMs = Math.max(0, targetMs - clipStartMs)

      try {
        const { default: RrwebPlayer } = await import('rrweb-player')
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = ''
        const width = Math.min(900, typeof window !== 'undefined' ? window.innerWidth - 80 : 900)
        // deno-lint-ignore no-explicit-any
        const player = new RrwebPlayer({
          target: containerRef.current,
          // deno-lint-ignore no-explicit-any
          props: { events: clipped as any, width, height: 480, autoPlay: false },
          // deno-lint-ignore no-explicit-any
        }) as any
        // Seeks to the real moment and pauses there — that paused frame IS
        // the screenshot; the player's own controls below it play the ~20s
        // clip (15s before, 5s after) start to finish.
        player.goto(offsetMs, false)
        if (!cancelled) setState('ready')
      } catch {
        if (!cancelled) setState('unavailable')
      }
    }

    mount()
    return () => { cancelled = true }
  }, [recording, targetIso])

  const isScreenshot = recording.kind === 'screenshots'
  const time = new Date(targetIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[85vh] max-w-[calc(100vw-2rem)] gap-4 overflow-auto rounded-2xl border border-border/70 bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:opacity-90"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            {isScreenshot ? <Camera className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
            {isScreenshot ? `Screenshot near ${time}` : `Recording at ${time}`}
          </div>
          {!isScreenshot && (
            <p className="mb-3 text-[11px] text-muted-foreground">
              The frame below is the real screen state at this moment — press play to watch 15s before through 5s after.
            </p>
          )}
          {currentLabel && (
            <p className="mb-3 text-xs font-medium text-foreground">{currentLabel}</p>
          )}

          {state === 'loading' && (
            <div className="flex h-64 w-96 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {state === 'unavailable' && (
            <div className="flex h-40 w-96 items-center justify-center text-center text-sm text-muted-foreground">
              No recording data is available for this moment.
            </div>
          )}

          {recording.kind === 'screenshots' && state === 'ready' && screenshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={screenshotUrl} alt="" className="max-h-[60vh] rounded-lg" />
          )}

          <div ref={containerRef} className={recording.kind === 'dom' && state === 'ready' ? 'overflow-hidden rounded-lg' : 'hidden'} />
        </div>

        {precedingItems && precedingItems.length > 0 && (
          <div className="w-56 shrink-0 border-l border-border/50 pl-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leading up to this</p>
            <ol className="space-y-2">
              {precedingItems.map((p, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  {p.isError && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-critical" />}
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground">{p.time}</span>
                    <p className={p.isError ? 'text-critical' : 'text-foreground'}>{p.label}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
