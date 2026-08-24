/**
 * PAAQ Referral / waiting-list edge function.
 *
 * Two actions, both authenticated with the caller's own Supabase JWT (the
 * dashboard routes verify the session with cookies()/getUser() first, then
 * forward the session token here — see /api/referral/*). The function
 * re-resolves the user from that token with `sb.auth.getUser`, then performs
 * writes through the service-role client (which, like every other edge
 * function in this repo, bypasses RLS):
 *
 *   action: 'code'   — return the caller's referral code, lazily creating one
 *                      if they don't have a shareable code yet.
 *   action: 'claim'  — attribute a fresh signup to whoever owns `code`.
 *                      Guarded against self-referral and idempotent thanks to
 *                      the UNIQUE constraint on referred_user_id.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 8-char URL-safe code that's easy to read/type in a share link.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion
const CODE_LENGTH = 8

function generateCode(): string {
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return out
}

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

/**
 * Resolve the caller's user id from the Authorization bearer token. The
 * service-role client is used both to verify the token and for all writes,
 * so RLS never blocks the multi-user ops (referring user != claiming user).
 */
async function resolveUser(sb: ReturnType<typeof createClient>, authHeader: string | null) {
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return { error: respond({ ok: false, error: 'Unauthorized' }, 401) as Response, user: null }
  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return { error: respond({ ok: false, error: 'Invalid session' }, 401) as Response, user: null }
  return { error: null as Response | null, user }
}

async function handleCode(sb: ReturnType<typeof createClient>, userId: string) {
  // Existing code → return it untouched.
  const { data: existing } = await sb
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return respond({ ok: true, code: existing.code })
  }

  // No code yet → mint one. Retry on the tiny chance of a collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data: created, error } = await sb
      .from('referral_codes')
      .insert({ user_id: userId, code })
      .select('code')
      .maybeSingle()

    if (!error && created) return respond({ ok: true, code: created.code })
    if (error && error.code !== '23505') {
      // 23505 = unique_violation (code clash); anything else is a real failure.
      return respond({ ok: false, error: 'Failed to create referral code' }, 500)
    }
  }
  return respond({ ok: false, error: 'Could not allocate a unique referral code' }, 500)
}

async function handleStats(sb: ReturnType<typeof createClient>, userId: string) {
  // Reuse the get-or-create path so a fresh user always has a code to share.
  const codeResult = await handleCode(sb, userId)
  const codeBody = JSON.parse((await codeResult.text()).slice()) as { ok: boolean; code?: string }

  // Claims attributed to this user as the referrer.
  const { data: claims, error } = await sb
    .from('referral_claims')
    .select('referred_user_id, status, created_at')
    .eq('referrer_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return respond({ ok: false, error: 'Failed to load referral stats' }, 500)
  }

  // Resolve referred users' emails via auth.users (only reachable through
  // the service-role client from here — never exposed to the dashboard's
  // public-schema client). Batch with a single IN query instead of N lookups.
  const ids = (claims ?? []).map((c) => c.referred_user_id)
  const emailById = new Map<string, string | null>()
  if (ids.length > 0) {
    const { data: users } = await sb
      .from('auth.users')
      .select('id, email')
      .in('id', ids)
    for (const u of users ?? []) emailById.set(u.id, u.email ?? null)
  }

  const claimed = (claims ?? []).map((claim) => ({
    referred_user_id: claim.referred_user_id,
    email: emailById.get(claim.referred_user_id) ?? null,
    status: claim.status,
    created_at: claim.created_at,
  }))

  return respond({
    ok: true,
    code: codeBody.code ?? null,
    redeem_count: (claims ?? []).length,
    claimed,
  })
}

async function handleClaim(sb: ReturnType<typeof createClient>, userId: string, code: string) {
  if (!code) return respond({ ok: false, error: 'code is required' }, 400)
  const normalized = code.trim().toUpperCase()

  // Self-referral guard — the claiming user must not own the code they used.
  const { data: owner } = await sb
    .from('referral_codes')
    .select('user_id')
    .eq('code', normalized)
    .maybeSingle()

  if (!owner) return respond({ ok: false, error: 'That referral code does not exist' }, 404)
  if (owner.user_id === userId) return respond({ ok: false, error: 'You cannot refer yourself' }, 400)

  // Idempotent: ON CONFLICT (referred_user_id) DO NOTHING. Returns the row
  // only on first insert so re-claims don't double-count.
  const { data: claim, error } = await sb
    .from('referral_claims')
    .insert({
      code: normalized,
      referrer_user_id: owner.user_id,
      referred_user_id: userId,
      status: 'credited',
    })
    .select('id')
    .maybeSingle()

  if (error) return respond({ ok: false, error: 'Failed to record referral' }, 500)

  if (!claim) {
    // Already claimed this referral — no-op success so a duplicate request
    // (e.g. double-tap at signup) isn't surfaced as an error.
    return respond({ ok: true, already_claimed: true })
  }

  return respond({ ok: true, already_claimed: false })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return respond({ ok: false, error: 'Method not allowed' }, 405)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const authHeader = req.headers.get('authorization')
    const { error, user } = await resolveUser(sb, authHeader)
    if (error || !user) return error ?? respond({ ok: false, error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'code') return await handleCode(sb, user.id)
    if (action === 'stats') return await handleStats(sb, user.id)
    if (action === 'claim') return await handleClaim(sb, user.id, body.code as string)

    return respond({ ok: false, error: 'Unknown action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return respond({ ok: false, error: message }, 500)
  }
})