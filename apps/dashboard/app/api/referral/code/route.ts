import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// Returns (or lazily mints) the signed-in user's shareable referral code.
// The session is checked here with cookies(), then the request is forwarded
// to the `referral` edge function with the user's access token, which is
// what the edge function actually trusts — same trust boundary as
// /api/client-onboard and the other session-gated, edge-backed routes.
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const sb = createClient(cookieStore)
  const { data: { session } } = await sb.auth.getSession()

  if (!session) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/referral`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'code' }),
  })

  const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response from referral service' }))
  if (!res.ok || !data.ok) {
    return NextResponse.json({ ok: false, error: data.error ?? 'Failed to get referral code' }, { status: res.ok ? 400 : res.status })
  }

  return NextResponse.json({ ok: true, code: data.code })
}