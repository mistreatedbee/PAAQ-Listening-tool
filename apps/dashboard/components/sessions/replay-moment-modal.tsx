'use client'

import { useEffect, useRef, useState } from 'react'
import 'rrweb-player/dist/style.css'
import { X, Loader2, Video } from 'lucide-react'
import type { SessionRecordingState } from '@/lib/use-session-recording'

type RrwebEvent = { timestamp?: number }

/** Self-contained lightbox that opens directly in response to a timeline
 * row's click and immediately shows a real frame from that moment — no
 * reliance on scrolling to / silently seeking a player elsewhere on the
 * page, which was easy to miss. Reuses the recording data already loaded
 * by useSessionRecording (passed in), so no extra fetch happens here. */
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
      const events = recording.events as RrwebEvent[]
      const firstMs = events.map((e) => e.timestamp).find((t): t is number => typeof t === 'number')
      if (firstMs == null) { setState('unavailable'); return }
      const offsetMs = Math.max(0, new Date(targetIso).getTime() - firstMs)

      try {
        const { default: RrwebPlayer } = await import('rrweb-player')
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = ''
        const width = Math.min(900, typeof window !== 'undefined' ? window.innerWidth - 80 : 900)
        // deno-lint-ignore no-explicit-any
        const player = new RrwebPlayer({
          target: containerRef.current,
          // deno-lint-ignore no-explicit-any
          props: { events: recording.events as any, width, height: 560, autoPlay: false },
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
          <Video className="h-3.5 w-3.5" />
          Replay at {new Date(targetIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
