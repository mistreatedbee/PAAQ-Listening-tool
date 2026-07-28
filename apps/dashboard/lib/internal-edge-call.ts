/** Server-only helper: calls a dashboard-triggered edge function (repo-connector,
 * execute-fix) with the internal shared secret. Never import this from client code. */
export async function callInternalEdgeFunction(fn: 'repo-connector' | 'execute-fix', body: Record<string, unknown>) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.REPO_CONNECTOR_INTERNAL_SECRET ?? '',
    },
    body: JSON.stringify(body),
  })
  return res.json().catch(() => ({ ok: false, error: 'Invalid response from edge function' }))
}
