/**
 * Returns a session's recording metadata plus short-lived signed URLs for
 * every chunk, so the dashboard player can fetch and stitch them together.
 * Same auth posture as analyze/session-summary (service-role, no stricter
 * check than the rest of this codebase's dashboard-facing AI/read
 * endpoints) — called with the anon key from the browser.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const SIGNED_URL_TTL_SECONDS = 300

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const body = await req.json().catch(() => ({}))
  const sessionId = body.session_id as string | undefined
  if (!sessionId) return respond({ error: 'session_id is required' }, 400)

  const { data: recording } = await supabase
    .from('session_recordings')
    .select('id, kind, chunk_count, started_at, ended_at')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!recording) return respond({ ok: true, recording: null })

  const { data: chunks } = await supabase
    .from('session_recording_chunks')
    .select('sequence, storage_path, captured_at, byte_size')
    .eq('recording_id', recording.id)
    .order('sequence', { ascending: true })

  const signedChunks = await Promise.all(
    (chunks ?? []).map(async (c) => {
      const { data: signed } = await supabase.storage
        .from('session-recordings')
        .createSignedUrl(c.storage_path, SIGNED_URL_TTL_SECONDS)
      return { sequence: c.sequence, capturedAt: c.captured_at, byteSize: c.byte_size, url: signed?.signedUrl ?? null }
    }),
  )

  return respond({
    ok: true,
    recording: {
      kind: recording.kind,
      chunkCount: recording.chunk_count,
      startedAt: recording.started_at,
      endedAt: recording.ended_at,
      chunks: signedChunks.filter((c) => c.url !== null),
    },
  })
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
