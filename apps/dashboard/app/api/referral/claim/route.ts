import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// Attributes the signed-in user's signup to whichever referrer owns `code`.
// Called right after a successful signup in /login (see captureRef below),
// once the user has a session. The browser never writes to the DB directly —
// this route re-validates the session, then forwards to the `referral` edge
// function which performs the (idempotent, self-referral-guarded) insert.
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const sb = createClient(cookieStore)
  const { data: { session } } = await sb.auth.getSession()

  if (!session) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { code } = await request.json().catch(() => ({ code: undefined as unknown }))
  if (typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ ok: false, error: 'code is required' }, { status: 400 })
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/referral`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'claim', code }),
  })

  const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response from referral service' }))
  if (!res.ok || !data.ok) {
    return NextResponse.json({ ok: false, error: data.error ?? 'Failed to record referral' }, { status: res.ok ? 400 : res.status })
  }

  return NextResponse.json({ ok: true, already_claimed: data.already_claimed === true })
}