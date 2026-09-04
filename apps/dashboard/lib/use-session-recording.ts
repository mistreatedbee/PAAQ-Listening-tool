'use client'

import { useEffect, useState } from 'react'
import { mergeRecordingEvents } from '@/lib/recording-events'

export type ScreenshotChunk = { sequence: number; capturedAt: string; url: string }

export type SessionRecordingState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'dom'; events: unknown[] }
  | { kind: 'screenshots'; chunks: ScreenshotChunk[] }

// Module-level cache so the full replay player and every thumbnail in the
// interaction timeline share one fetch/parse of the recording instead of
// each re-downloading and re-JSON-parsing the same chunks.
const cache = new Map<string, Promise<SessionRecordingState>>()

async function fetchRecording(sessionId: string): Promise<SessionRecordingState> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/session-recording-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ session_id: sessionId }),
    })
    const data = await res.json()
    if (!data.ok || !data.recording || data.recording.chunks.length === 0) return { kind: 'none' }

    if (data.recording.kind === 'dom') {
      const sortedChunks = [...data.recording.chunks].sort(
        (a: { sequence?: number }, b: { sequence?: number }) => (a.sequence ?? 0) - (b.sequence ?? 0),
      )
      const chunkArrays = await Promise.all(
        sortedChunks.map((c: { url: string }) => fetch(c.url).then((r) => r.json())),
      )
      const events = mergeRecordingEvents(chunkArrays)
      return events.length > 0 ? { kind: 'dom', events } : { kind: 'none' }
    }
    if (data.recording.kind === 'screenshots') {
      return { kind: 'screenshots', chunks: data.recording.chunks as ScreenshotChunk[] }
    }
    return { kind: 'none' }
  } catch {
    return { kind: 'none' }
  }
}

/** Real recording data (rrweb DOM events, or real screenshot chunks) for a
 * session — shared across the full replay player and per-row thumbnails. */
export function useSessionRecording(sessionId: string | null): SessionRecordingState {
  const [state, setState] = useState<SessionRecordingState>({ kind: 'loading' })

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    if (!cache.has(sessionId)) cache.set(sessionId, fetchRecording(sessionId))
    cache.get(sessionId)!.then((result) => { if (!cancelled) setState(result) })
    return () => { cancelled = true }
  }, [sessionId])

  return state
}
