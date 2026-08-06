/**
 * Accepts one recording chunk from an SDK — either a batch of rrweb DOM
 * events (web) or a single screenshot image (mobile) — and stores it in the
 * private `session-recordings` bucket. The client never talks to Storage
 * directly; this is the only write path.
 *
 * Query params: session_id, kind ('dom' | 'screenshots'), sequence (int),
 * captured_at (ISO string). Body: raw bytes (gzip JSON for 'dom', image
 * bytes for 'screenshots') — no JSON/base64 wrapping, to avoid bloating
 * payload size for what's already a comparatively heavy upload.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  // ── Auth — same SDK-token pattern as events/errors ──────────────────────
  const sdkToken   = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  const projectKey = req.headers.get('x-project-id') ?? ''

  if (!sdkToken.startsWith('sdk_live_') && !sdkToken.startsWith('sdk_test_')) {
    return respond({ error: 'Invalid SDK token format' }, 401)
  }

  const { data: tokenRow } = await supabase
    .from('access_tokens')
    .select('tenant_id, status, rotation_expires_at')
    .eq('token', sdkToken)
    .eq('token_type', 'sdk_token')
    .in('status', ['active', 'rotating'])
    .single()

  if (!tokenRow) return respond({ error: 'Invalid SDK token' }, 401)

  const { data: project } = await supabase
    .from('tenant_projects')
    .select('id, status')
    .eq('project_id_key', projectKey)
    .eq('tenant_id', tokenRow.tenant_id)
    .single()

  if (!project || project.status !== 'active') return respond({ error: 'Project not found or inactive' }, 401)
  // ─────────────────────────────────────────────────────────────────────────

  const url = new URL(req.url)
  const sessionId  = url.searchParams.get('session_id')
  const kind       = url.searchParams.get('kind')
  const sequence   = Number(url.searchParams.get('sequence') ?? 'NaN')
  const capturedAt = url.searchParams.get('captured_at') ?? new Date().toISOString()

  if (!sessionId || (kind !== 'dom' && kind !== 'screenshots') || Number.isNaN(sequence)) {
    return respond({ error: 'session_id, kind (dom|screenshots), and sequence are required' }, 400)
  }

  const body = await req.arrayBuffer()
  if (body.byteLength === 0) return respond({ error: 'Empty body' }, 400)
  // Generous cap so one runaway chunk can't fill the bucket — the SDKs
  // batch/compress well under this in normal operation.
  if (body.byteLength > 5 * 1024 * 1024) return respond({ error: 'Chunk too large (max 5MB)' }, 413)

  let { data: recording } = await supabase
    .from('session_recordings')
    .select('id, chunk_count')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!recording) {
    const { data: created, error } = await supabase
      .from('session_recordings')
      .insert({ project_id: project.id, session_id: sessionId, kind, started_at: capturedAt })
      .select('id, chunk_count')
      .single()
    if (error) {
      // 23505 = unique_violation on session_recordings_session_id_key — the
      // SDK deliberately flushes the first snapshot/meta chunk immediately
      // rather than waiting for the batch timer, so two chunks can genuinely
      // race to create this session's recording row at once. The loser here
      // isn't a real failure — the row now exists (created by the other
      // request), just re-fetch it instead of surfacing a raw 500 for what
      // is, from the SDK's point of view, a successful upload.
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('session_recordings')
          .select('id, chunk_count')
          .eq('session_id', sessionId)
          .maybeSingle()
        if (!existing) return respond({ error: error.message }, 500)
        recording = existing
      } else {
        return respond({ error: error.message }, 500)
      }
    } else {
      recording = created
    }
  }

  const ext = kind === 'screenshots' ? 'jpg' : 'json'
  const path = `${project.id}/${sessionId}/${String(sequence).padStart(6, '0')}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('session-recordings')
    .upload(path, body, {
      contentType: req.headers.get('content-type') ?? 'application/octet-stream',
      upsert: true,
    })
  if (uploadError) return respond({ error: uploadError.message }, 500)

  await supabase.from('session_recording_chunks').insert({
    recording_id: recording.id,
    project_id: project.id,
    sequence,
    storage_path: path,
    captured_at: capturedAt,
    byte_size: body.byteLength,
  })

  await supabase.from('session_recordings').update({
    chunk_count: (recording.chunk_count ?? 0) + 1,
    ended_at: capturedAt,
  }).eq('id', recording.id)

  return respond({ ok: true })
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-project-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
