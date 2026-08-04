/**
 * Deletes session recordings (DOM/screenshot chunks + their Storage
 * objects) older than the retention window, so the session-recordings
 * bucket doesn't grow unbounded. Recording metadata + files are the only
 * things removed — the underlying sessions/events/errors/AI summaries are
 * untouched.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withRetryResult } from '../_shared/retry.ts'

const RETENTION_DAYS = 7
const STORAGE_REMOVE_BATCH_SIZE = 100

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

async function runCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: recordings, error } = await withRetryResult(() =>
    supabase.from('session_recordings')
      .select('id')
      .lt('created_at', cutoff)
      .limit(500), // one sweep per run is plenty; the next scheduled run picks up the rest
  )

  if (error || !recordings) {
    console.error('session-recording-cleanup-cron: failed to load recordings', error)
    return
  }

  if (recordings.length === 0) {
    console.log('session-recording-cleanup-cron: nothing to clean up')
    return
  }

  let deletedRecordings = 0
  let deletedFiles = 0

  for (const { id: recordingId } of recordings) {
    try {
      const { data: chunks } = await supabase
        .from('session_recording_chunks')
        .select('storage_path')
        .eq('recording_id', recordingId)

      const paths = (chunks ?? []).map((c) => c.storage_path)
      for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH_SIZE) {
        const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH_SIZE)
        const { error: removeError } = await supabase.storage.from('session-recordings').remove(batch)
        if (removeError) {
          console.error(`session-recording-cleanup-cron: storage remove failed for recording ${recordingId}`, removeError)
          continue
        }
        deletedFiles += batch.length
      }

      // Cascades to session_recording_chunks via ON DELETE CASCADE.
      const { error: deleteError } = await supabase.from('session_recordings').delete().eq('id', recordingId)
      if (deleteError) {
        console.error(`session-recording-cleanup-cron: failed to delete recording ${recordingId}`, deleteError)
        continue
      }
      deletedRecordings++
    } catch (err) {
      console.error(`session-recording-cleanup-cron: error cleaning up recording ${recordingId}`, err)
    }
  }

  console.log(`session-recording-cleanup-cron: deleted ${deletedRecordings} recordings, ${deletedFiles} files`)
}

// Once a day — recordings don't need faster cleanup than that.
Deno.cron('session-recording-cleanup', '0 3 * * *', runCleanup)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (!checkInternalSecret(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...cors() },
    })
  }
  await runCleanup()
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
