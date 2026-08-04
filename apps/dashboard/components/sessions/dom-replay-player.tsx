'use client'

import { useEffect, useRef, useState } from 'react'
import 'rrweb-player/dist/style.css'
import { Card, CardHead } from '@/components/kit'
import { Video } from 'lucide-react'

export function DomReplayPlayer({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'none' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/session-recording-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const data = await res.json()
        if (cancelled) return

        if (!data.ok || !data.recording || data.recording.kind !== 'dom' || data.recording.chunks.length === 0) {
          setState('none')
          return
        }

        const chunkArrays = await Promise.all(
          data.recording.chunks.map((c: { url: string }) => fetch(c.url).then((r) => r.json())),
        )
        if (cancelled) return
        const events = chunkArrays.flat()

        if (events.length === 0) {
          setState('none')
          return
        }

        // rrweb-player renders itself into the DOM directly — dynamically
        // imported since it touches window/document at module load time.
        const { default: RrwebPlayer } = await import('rrweb-player')
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = ''
        new RrwebPlayer({
          target: containerRef.current,
          props: { events, width: containerRef.current.clientWidth || 800, height: 500, autoPlay: false },
        })
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    }

    load()
    return () => { cancelled = true }
  }, [sessionId])

  if (state === 'none') return null

  return (
    <Card>
      <CardHead title="Screen recording" desc="Real DOM-reconstructed playback — not a video, not pixels; sensitive input values are masked" icon={<Video className="h-4 w-4" />} />
      <div className="px-5 pb-5">
        {state === 'loading' && <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading recording…</div>}
        {state === 'error' && <p className="text-sm text-critical">Failed to load recording.</p>}
        <div ref={containerRef} className={state === 'ready' ? 'overflow-hidden rounded-lg' : 'hidden'} />
      </div>
    </Card>
  )
}
