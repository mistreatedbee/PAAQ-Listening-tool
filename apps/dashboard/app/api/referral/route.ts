import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// Returns the signed-in user's referral code plus how many signups they've
// redeemed (and who, resolved server-side via the edge function so emails are
// never touched by the public-schema client). Session-gated, edge-backed —
// same pattern as POST /api/referral/code and /api/referral/claim.
export async function GET() {
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
    body: JSON.stringify({ action: 'stats' }),
  })

  const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response from referral service' }))
  if (!res.ok || !data.ok) {
    return NextResponse.json({ ok: false, error: data.error ?? 'Failed to load referral stats' }, { status: res.ok ? 400 : res.status })
  }

  return NextResponse.json({
    ok: true,
    code: data.code ?? null,
    redeem_count: data.redeem_count ?? 0,
    claimed: data.claimed ?? [],
  })
}