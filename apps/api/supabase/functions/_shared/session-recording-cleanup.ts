/**
 * Deletes session recording metadata + Storage objects for one or many
 * recordings. Sessions/events/errors are untouched — only replay blobs go.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const SESSION_RECORDING_BUCKET = 'session-recordings'
export const STORAGE_REMOVE_BATCH_SIZE = 100

/** Default age-based retention for recordings with no open errors. */
export const RECORDING_RETENTION_DAYS = 3

/** Ended sessions with no open errors can drop replay data after this grace period. */
export const RESOLVED_SESSION_GRACE_HOURS = 24

export type RecordingCleanupResult = {
  deletedRecordings: number
  deletedFiles: number
  skipped: number
}

export async function deleteRecordingById(
  supabase: SupabaseClient,
  recordingId: string,
): Promise<{ ok: boolean; deletedFiles: number }> {
  const { data: chunks } = await supabase
    .from('session_recording_chunks')
    .select('storage_path')
    .eq('recording_id', recordingId)

  const paths = (chunks ?? []).map((c) => c.storage_path).filter(Boolean)
  let deletedFiles = 0

  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH_SIZE)
    if (batch.length === 0) continue
    const { error: removeError } = await supabase.storage.from(SESSION_RECORDING_BUCKET).remove(batch)
    if (removeError) {
      console.error(`session-recording-cleanup: storage remove failed for recording ${recordingId}`, removeError)
      return { ok: false, deletedFiles }
    }
    deletedFiles += batch.length
  }

  const { error: deleteError } = await supabase.from('session_recordings').delete().eq('id', recordingId)
  if (deleteError) {
    console.error(`session-recording-cleanup: failed to delete recording ${recordingId}`, deleteError)
    return { ok: false, deletedFiles }
  }

  return { ok: true, deletedFiles }
}

export async function deleteRecordingForSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ ok: boolean; deletedFiles: number }> {
  const { data: recording } = await supabase
    .from('session_recordings')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!recording) return { ok: true, deletedFiles: 0 }
  return deleteRecordingById(supabase, recording.id)
}

/**
 * Removes replay data that is safe to drop:
 * - older than RECORDING_RETENTION_DAYS, or
 * - session has ended, no open errors remain, and grace period elapsed.
 */
export async function runSessionRecordingCleanup(
  supabase: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<RecordingCleanupResult> {
  const limit = opts.limit ?? 500
  const ageCutoff = new Date(Date.now() - RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const resolvedCutoff = new Date(Date.now() - RESOLVED_SESSION_GRACE_HOURS * 60 * 60 * 1000).toISOString()

  const { data: recordings, error } = await supabase
    .from('session_recordings')
    .select('id, session_id, created_at')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !recordings) {
    console.error('session-recording-cleanup: failed to load recordings', error)
    return { deletedRecordings: 0, deletedFiles: 0, skipped: 0 }
  }

  let deletedRecordings = 0
  let deletedFiles = 0
  let skipped = 0

  for (const recording of recordings) {
    try {
      let shouldDelete = recording.created_at < ageCutoff

      if (!shouldDelete) {
        const { data: session } = await supabase
          .from('sessions')
          .select('ended_at')
          .eq('id', recording.session_id)
          .maybeSingle()

        if (session?.ended_at && session.ended_at < resolvedCutoff) {
          const { count: openErrors } = await supabase
            .from('errors')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', recording.session_id)
            .eq('status', 'open')

          shouldDelete = (openErrors ?? 0) === 0
        }
      }

      if (!shouldDelete) {
        skipped++
        continue
      }

      const result = await deleteRecordingById(supabase, recording.id)
      if (result.ok) {
        deletedRecordings++
        deletedFiles += result.deletedFiles
      } else {
        skipped++
      }
    } catch (err) {
      console.error(`session-recording-cleanup: error cleaning up recording ${recording.id}`, err)
      skipped++
    }
  }

  return { deletedRecordings, deletedFiles, skipped }
}
