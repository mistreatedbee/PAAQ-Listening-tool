'use client'

import { useEffect, useRef, useState } from 'react'
import 'rrweb-player/dist/style.css'
import { X, Loader2, Video, Camera } from 'lucide-react'
import type { SessionRecordingState } from '@/lib/use-session-recording'

type RrwebEvent = { type?: number; timestamp?: number }

// rrweb event type codes we care about here — DomContentLoaded/Load (0/1)
// and IncrementalSnapshot (3) aren't referenced directly, only Meta and
// FullSnapshot, which are the two a player needs as its starting point.
const RRWEB_META = 4
const RRWEB_FULL_SNAPSHOT = 2

const PRE_ROLL_MS = 5_000
const POST_ROLL_MS = 10_000

/**
 * Clips a full session's rrweb events down to a short real window around
 * `targetMs` — never hands the player the whole session. rrweb can only
 * start rendering from a real FullSnapshot (it's the base DOM state
 * everything after it diffs against), so the clip has to start at the
 * latest snapshot at-or-before the window, not exactly at `targetMs -
 * PRE_ROLL_MS` — on recordings with sparse snapshots that can be more than
 * a few seconds early, but it's always bounded and always far short of
 * "the whole session," and gets tighter automatically as the SDK's
 * snapshot cadence (checkoutEveryNms) shortens.
 */
function clipDomEvents(events: RrwebEvent[], targetMs: number): RrwebEvent[] | null {
  const windowStart = targetMs - PRE_ROLL_MS
  const windowEnd = targetMs + POST_ROLL_MS

  let snapshotIdx = -1
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.type === RRWEB_FULL_SNAPSHOT && typeof e.timestamp === 'number' && e.timestamp <= windowStart) {
      snapshotIdx = i
    }
  }
  // No snapshot before the window — fall back to the latest snapshot at or
  // before the target itself, then to the very first snapshot in the
  // recording, so a moment early in the session still gets a real clip
  // instead of nothing.
  if (snapshotIdx === -1) {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      if (e.type === RRWEB_FULL_SNAPSHOT && typeof e.timestamp === 'number' && e.timestamp <= targetMs) snapshotIdx = i
    }
  }
  if (snapshotIdx === -1) {
    snapshotIdx = events.findIndex((e) => e.type === RRWEB_FULL_SNAPSHOT)
  }
  if (snapshotIdx === -1) return null

  const startIdx = snapshotIdx > 0 && events[snapshotIdx - 1].type === RRWEB_META ? snapshotIdx - 1 : snapshotIdx
  const clipped = events.slice(startIdx).filter((e) => typeof e.timestamp !== 'number' || e.timestamp <= windowEnd)
  return clipped.length > 0 ? clipped : null
}

/** Self-contained lightbox that opens directly in response to a timeline
 * row's click and immediately shows a real, short clip from that moment —
 * a screenshot when the recording is screenshots, a real short video clip
 * (never the whole session) when it's a DOM recording. Reuses the recording
 * data already loaded by useSessionRecording (passed in), so no extra fetch
 * happens here. */
export function ReplayMomentModal({
  recording,
  targetIso,
  onClose,
}: {
  recording: SessionRecordingState
  targetIso: string
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
          props: { events: clipped as any, width, height: 560, autoPlay: false },
          // deno-lint-ignore no-explicit-any
        }) as any
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
        className="relative max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-auto rounded-2xl border border-border/70 bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:opacity-90"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {isScreenshot ? <Camera className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
          {isScreenshot ? `Screenshot near ${time}` : `Video at ${time}`}
        </p>

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
          <img src={screenshotUrl} alt="" className="max-h-[70vh] rounded-lg" />
        )}

        <div ref={containerRef} className={recording.kind === 'dom' && state === 'ready' ? 'overflow-hidden rounded-lg' : 'hidden'} />
      </div>
    </div>
  )
}
