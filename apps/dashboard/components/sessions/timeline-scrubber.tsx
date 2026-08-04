'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/kit'
import { Play, Pause, RotateCcw } from 'lucide-react'

const SPEEDS = [1, 2, 4] as const

/**
 * A VCR-style scrubber over the session's real captured timeline — no video,
 * no DOM recording. Playing it advances a "current time" cursor between
 * startedAt/endedAt; the parent uses onTimeChange to progressively
 * reveal/highlight the already-fetched interaction timeline as it plays.
 */
export function TimelineScrubber({
  startedAt,
  endedAt,
  onTimeChange,
}: {
  startedAt: string
  endedAt: string | null
  onTimeChange: (currentTime: string) => void
}) {
  const startMs = new Date(startedAt).getTime()
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now()
  const totalMs = Math.max(1, endMs - startMs)

  const [playing, setPlaying] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(0)
  const [progress, setProgress] = useState(0) // 0-1
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)

  useEffect(() => {
    onTimeChange(new Date(startMs + progress * totalMs).toISOString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    if (!playing) return
    lastTickRef.current = performance.now()

    const tick = (now: number) => {
      const deltaMs = now - lastTickRef.current
      lastTickRef.current = now
      setProgress((prev) => {
        const next = prev + (deltaMs * SPEEDS[speedIndex]) / totalMs
        if (next >= 1) {
          setPlaying(false)
          return 1
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, speedIndex, totalMs])

  const currentLabel = new Date(startMs + progress * totalMs).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (progress >= 1) setProgress(0)
            setPlaying((p) => !p)
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background hover:opacity-90"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
        </button>
        <button
          onClick={() => { setProgress(0); setPlaying(false) }}
          title="Restart"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-accent"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => { setPlaying(false); setProgress(Number(e.target.value)) }}
          className="h-1.5 flex-1 accent-foreground"
        />

        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{currentLabel}</span>

        <button
          onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
          className="w-10 shrink-0 rounded-md border border-border/60 px-1.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
        >
          {SPEEDS[speedIndex]}×
        </button>
      </div>
    </Card>
  )
}
