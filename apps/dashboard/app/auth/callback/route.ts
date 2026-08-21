import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// Supabase Auth (via @supabase/ssr) uses the PKCE flow for OAuth sign-in —
// signInWithOAuth() only sends the browser to the provider and back with a
// `?code=...` param; nothing exchanges that code for a real session until
// something calls exchangeCodeForSession() server-side, which is what this
// route exists to do. Without it, an OAuth redirect landed the user back on
// an app route with a code param that was never consumed, no session cookie
// was ever set, and middleware.ts immediately bounced them straight back to
// /login — OAuth login could never actually complete.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const errorDescription = searchParams.get('error_description')

  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Missing auth code')}`)
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
