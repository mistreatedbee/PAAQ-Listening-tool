/**
 * Deletes replay data for a single session — called when an error is marked
 * resolved/ignored so Storage is freed once the issue no longer needs replay.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { deleteRecordingForSession } from '../_shared/session-recording-cleanup.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...cors() },
    })
  }
  if (!checkInternalSecret(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...cors() },
    })
  }

  const body = await req.json().catch(() => ({}))
  const sessionId = body.session_id as string | undefined
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'session_id is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...cors() },
    })
  }

  const result = await deleteRecordingForSession(supabase, sessionId)
  return new Response(JSON.stringify({ ok: result.ok, deletedFiles: result.deletedFiles }), {
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-internal-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
