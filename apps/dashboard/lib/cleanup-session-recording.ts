/** Fire-and-forget replay cleanup when an error no longer needs session evidence. */
export function cleanupSessionRecording(sessionId: string | null | undefined): void {
  if (!sessionId) return
  void fetch('/api/session-recording/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  }).catch(() => {})
}
