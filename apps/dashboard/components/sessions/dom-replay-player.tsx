'use client'

import { useEffect, useRef, useState } from 'react'
import 'rrweb-player/dist/style.css'
import type { eventWithTime } from 'rrweb'
import { Card, CardHead } from '@/components/kit'
import { Video } from 'lucide-react'
import { mergeRecordingEvents, replayPlayerProps } from '@/lib/recording-events'

// deno-lint-ignore no-explicit-any
type PlayerInstance = { goto: (timeOffset: number, play?: boolean) => void; getReplayer: () => { getMetaData: () => { startTime: number } } }

export function DomReplayPlayer({ sessionId, seekToIso }: { sessionId: string; seekToIso?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'none' | 'ready' | 'error'>('loading')
  const playerRef = useRef<PlayerInstance | null>(null)
  const recordingStartMsRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/session-recording-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ session_id: sessionId }),
        })
        if (!res.ok) {
          if (!cancelled) setState('error')
          return
        }
        const data = await res.json()
        if (cancelled) return

        if (!data.ok || !data.recording || data.recording.kind !== 'dom' || data.recording.chunks.length === 0) {
          setState('none')
          return
        }

        let events: eventWithTime[]
        try {
          const sortedChunks = [...data.recording.chunks].sort(
            (a: { sequence?: number }, b: { sequence?: number }) => (a.sequence ?? 0) - (b.sequence ?? 0),
          )
          const eventsRaw = await Promise.all(
            sortedChunks.map((c: { url: string }) => fetch(c.url).then((r) => {
              if (!r.ok) throw new Error(`chunk ${c.url} failed (${r.status})`)
              return r.json()
            })),
          )
          if (cancelled) return
          events = mergeRecordingEvents(eventsRaw)
        } catch {
          if (!cancelled) setState('error')
          return
        }

        if (events.length === 0) {
          setState('none')
          return
        }

        // rrweb-player renders itself into the DOM directly — dynamically
        // imported since it touches window/document at module load time.
        const firstTs = events.map((e) => e.timestamp).find((t): t is number => typeof t === 'number')
        recordingStartMsRef.current = firstTs ?? null

        const { default: RrwebPlayer } = await import('rrweb-player')
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = ''
        const width = containerRef.current.clientWidth || 800
        playerRef.current = new RrwebPlayer({
          target: containerRef.current,
          props: replayPlayerProps(events, width, 500),
        }) as unknown as PlayerInstance
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    }

    load()
    return () => { cancelled = true }
  }, [sessionId])

  // Jump to a specific moment when a timeline thumbnail is clicked — reuses
  // the same already-loaded player/events, no re-fetch.
  useEffect(() => {
    if (!seekToIso || state !== 'ready' || !playerRef.current || recordingStartMsRef.current == null) return
    const offsetMs = Math.max(0, new Date(seekToIso).getTime() - recordingStartMsRef.current)
    playerRef.current.goto(offsetMs, false)
    document.getElementById('replay-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [seekToIso, state])

  if (state === 'none') return null

  return (
    <Card>
      <div id="replay-player" />
      <CardHead title="Screen recording" desc="Real DOM-reconstructed playback — not a video, not pixels; sensitive input values are masked" icon={<Video className="h-4 w-4" />} />
      <div className="px-5 pb-5">
        {state === 'loading' && <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading recording…</div>}
        {state === 'error' && <p className="text-sm text-critical">Failed to load recording.</p>}
        <div ref={containerRef} className={state === 'ready' ? 'overflow-hidden rounded-lg' : 'hidden'} />
      </div>
    </Card>
  )
}
