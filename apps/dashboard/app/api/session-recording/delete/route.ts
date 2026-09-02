import { NextResponse } from 'next/server'

/** Server-only: delete replay blobs for a session after an error is resolved. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const sessionId = body.session_id as string | undefined
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  const secret = process.env.REPO_CONNECTOR_INTERNAL_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/session-recording-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': secret,
    },
    body: JSON.stringify({ session_id: sessionId }),
  })

  const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response' }))
  return NextResponse.json(data, { status: res.status })
}
