'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageOff, Loader2, Play } from 'lucide-react'
import type { SessionRecordingState } from '@/lib/use-session-recording'

// One shared cache per session for generated thumbnails, keyed by a coarse
// timestamp bucket (nearest second) — real image data, generated once and
// reused if several rows land in the same second, not fabricated per row.
const thumbCache = new Map<string, string>()

function rrwebEventTimestamp(e: unknown): number | null {
  if (e && typeof e === 'object' && typeof (e as Record<string, unknown>).timestamp === 'number') {
    return (e as Record<string, unknown>).timestamp as number
  }
  return null
}

/** Renders a real static thumbnail for one moment in a session's recording —
 * for `kind:'dom'` sessions this replays the actual captured rrweb events
 * into an off-screen player seeked to the target time and rasterizes the
 * real reconstructed DOM with html2canvas; for `kind:'screenshots'`
 * sessions it just shows the nearest genuinely-captured screenshot chunk.
 * Never fabricates a placeholder image — renders nothing (icon fallback)
 * when there's no real recording to draw from. */
export function ReplayThumbnail({
  recording,
  targetIso,
  onOpen,
}: {
  recording: SessionRecordingState
  targetIso: string
  onOpen?: (targetIso: string) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const containerRef = useRef<HTMLButtonElement | null>(null)
  const visibleRef = useRef(false)

  useEffect(() => {
    if (recording.kind === 'loading') return

    if (recording.kind === 'screenshots') {
      const targetMs = new Date(targetIso).getTime()
      const nearest = recording.chunks.reduce<typeof recording.chunks[number] | null>((best, c) => {
        const diff = Math.abs(new Date(c.capturedAt).getTime() - targetMs)
        const bestDiff = best ? Math.abs(new Date(best.capturedAt).getTime() - targetMs) : Infinity
        return diff < bestDiff ? c : best
      }, null)
      if (nearest) { setSrc(nearest.url); setStatus('ready') } else setStatus('unavailable')
      return
    }

    if (recording.kind === 'none') { setStatus('unavailable'); return }

    // kind === 'dom' — only generate once this row has actually scrolled
    // into view (IntersectionObserver below), to bound how many real
    // rasterizations happen per session view.
  }, [recording, targetIso])

  useEffect(() => {
    if (recording.kind !== 'dom' || !containerRef.current) return
    const el = containerRef.current
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !visibleRef.current) {
        visibleRef.current = true
        void generateDomThumbnail()
      }
    }, { threshold: 0.2 })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, targetIso])

  async function generateDomThumbnail() {
    if (recording.kind !== 'dom') return
    const cacheKey = `${targetIso.slice(0, 19)}`
    const cached = thumbCache.get(cacheKey)
    if (cached) { setSrc(cached); setStatus('ready'); return }

    setStatus('loading')
    const events = recording.events
    const firstMs = events.map(rrwebEventTimestamp).find((t): t is number => t != null)
    const targetMs = new Date(targetIso).getTime()
    if (firstMs == null) { setStatus('unavailable'); return }
    const offsetMs = Math.max(0, targetMs - firstMs)

    // Off-screen (not display:none — rrweb/html2canvas need real layout to
    // render into) host for a throwaway replayer instance.
    const host = document.createElement('div')
    host.style.position = 'fixed'
    host.style.top = '-10000px'
    host.style.left = '-10000px'
    host.style.width = '400px'
    host.style.height = '250px'
    document.body.appendChild(host)

    try {
      const [{ Replayer }, html2canvas] = await Promise.all([
        import('rrweb'),
        import('html2canvas').then((m) => m.default),
      ])
      // deno-lint-ignore no-explicit-any
      const replayer = new Replayer(events as any, { root: host, skipInactive: true, showWarning: false, mouseTail: false })
      replayer.pause(offsetMs)
      // Let the reconstructed iframe finish laying out before capturing.
      await new Promise((r) => setTimeout(r, 120))

      const iframe = host.querySelector('iframe')
      const doc = iframe?.contentDocument
      if (!doc?.body) { setStatus('unavailable'); return }

      const canvas = await html2canvas(doc.body, { logging: false, useCORS: true, backgroundColor: '#ffffff', width: 400, height: 250 })
      const dataUrl = canvas.toDataURL('image/png')
      thumbCache.set(cacheKey, dataUrl)
      setSrc(dataUrl)
      setStatus('ready')
    } catch {
      setStatus('unavailable')
    } finally {
      host.remove()
    }
  }

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={() => onOpen?.(targetIso)}
      className="group relative flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30"
      title="Watch this moment in the replay"
    >
      {status === 'ready' && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover object-top" />
      ) : status === 'loading' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <ImageOff className="h-3.5 w-3.5 text-muted-foreground/40" />
      )}
      {status === 'ready' && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
          <Play className="h-3.5 w-3.5 text-white" />
        </span>
      )}
    </button>
  )
}
