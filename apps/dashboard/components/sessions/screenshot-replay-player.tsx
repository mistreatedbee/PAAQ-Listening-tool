'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardHead } from '@/components/kit'
import { Video, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'

type Chunk = { sequence: number; capturedAt: string; url: string }

const SLIDE_INTERVAL_MS = 1500

export function ScreenshotReplayPlayer({ sessionId, seekToIso }: { sessionId: string; seekToIso?: string | null }) {
  const [state, setState] = useState<'loading' | 'none' | 'ready' | 'error'>('loading')
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/session-recording-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (!data.ok || !data.recording || data.recording.kind !== 'screenshots' || data.recording.chunks.length === 0) {
          setState('none')
          return
        }
        setChunks(data.recording.chunks)
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('error') })

    return () => { cancelled = true }
  }, [sessionId])

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setIndex((i) => {
        if (i >= chunks.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, SLIDE_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, chunks.length])

  useEffect(() => {
    if (!seekToIso || state !== 'ready' || chunks.length === 0) return
    const targetMs = new Date(seekToIso).getTime()
    let nearestIdx = 0
    let nearestDiff = Infinity
    chunks.forEach((c, i) => {
      const diff = Math.abs(new Date(c.capturedAt).getTime() - targetMs)
      if (diff < nearestDiff) { nearestDiff = diff; nearestIdx = i }
    })
    setPlaying(false)
    setIndex(nearestIdx)
    document.getElementById('replay-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [seekToIso, state, chunks])

  if (state === 'none') return null

  const current = chunks[index]

  return (
    <Card>
      <div id="replay-player" />
      <CardHead title="Screen recording" desc="Periodic real screenshots captured during the session" icon={<Video className="h-4 w-4" />} />
      <div className="px-5 pb-5">
        {state === 'loading' && <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading recording…</div>}
        {state === 'error' && <p className="text-sm text-critical">Failed to load recording.</p>}
        {state === 'ready' && current && (
          <div>
            <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url} alt={`Screenshot ${index + 1} of ${chunks.length}`} className="w-full object-contain" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (index >= chunks.length - 1) setIndex(0)
                  setPlaying((p) => !p)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background hover:opacity-90"
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
              </button>
              <button
                onClick={() => setIndex((i) => Math.min(chunks.length - 1, i + 1))}
                disabled={index === chunks.length - 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={chunks.length - 1}
                step={1}
                value={index}
                onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)) }}
                className="h-1.5 flex-1 accent-foreground"
              />
              <span className="w-32 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {new Date(current.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
