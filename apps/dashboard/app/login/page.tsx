'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Sparkles, ArrowRight, Loader2, Eye, EyeOff, Check, X } from 'lucide-react'

type Mode = 'signin' | 'signup'

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
  const map: Record<number, { label: string; color: string }> = {
    0: { label: '', color: '' },
    1: { label: 'Weak', color: '#ef4444' },
    2: { label: 'Fair', color: '#f97316' },
    3: { label: 'Good', color: '#eab308' },
    4: { label: 'Strong', color: '#22c55e' },
  }
  return { score: capped, ...map[capped] }
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const strength = mode === 'signup' ? passwordStrength(password) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const sb = createClient()

    if (mode === 'signin') {
      const { error: err } = await sb.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      router.push('/dashboard')
      router.refresh()
    } else {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return }
      const { error: err } = await sb.auth.signUp({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      setSuccess('Check your email for a confirmation link, then sign in.')
      setMode('signin')
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError(null)
    setOauthLoading(provider)
    const sb = createClient()
    const { error: err } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (err) { setError(err.message); setOauthLoading(null) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#060b10' }}>
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden lg:flex"
        style={{ background: 'linear-gradient(145deg,#0f1923 0%,#0d2035 40%,#0a2a3a 70%,#0c2f3d 100%)' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle,#51C9D3,transparent 70%)' }} />
          <div className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full opacity-15" style={{ background: 'radial-gradient(circle,#5FDED4,transparent 70%)' }} />
          <div className="absolute right-0 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,#27A6CE,transparent 70%)' }} />
        </div>

        {/* Logo */}
        <div className="relative px-10 pt-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' }}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight text-white">PAAQ</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#51C9D3' }}>Listening Tool</p>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative px-10">
          <h2 className="text-3xl font-black leading-tight text-white mb-4">
            Monitor your product.<br />
            <span style={{ backgroundImage: 'linear-gradient(90deg,#51C9D3,#5FDED4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Understand it with AI.
            </span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#8ba0b4' }}>
            Connect your app in minutes. AI agents start surfacing insights immediately.
          </p>
        </div>

        {/* Benefits */}
        <div className="relative px-10 pb-10 space-y-4">
          {[
            { icon: Sparkles, text: 'AI root cause analysis in seconds' },
            { icon: Eye, text: 'Real-time event stream across all platforms' },
            { icon: Check, text: 'Knowledge Graph built automatically' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(81,201,211,0.15)' }}>
                <Icon className="h-3.5 w-3.5" style={{ color: '#51C9D3' }} />
              </div>
              <span className="text-sm" style={{ color: '#8ba0b4' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' }}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-black" style={{ color: '#e8f0f8' }}>PAAQ Intelligence</span>
          </div>

          <h1 className="text-2xl font-black mb-1" style={{ color: '#e8f0f8' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm mb-8" style={{ color: '#8ba0b4' }}>
            {mode === 'signin' ? 'Sign in to your dashboard.' : 'Start monitoring in under 5 minutes.'}
          </p>

          {/* OAuth buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([
              { provider: 'google' as const, label: 'Google', Icon: GoogleIcon },
              { provider: 'github' as const, label: 'GitHub', Icon: GithubIcon },
            ]).map(({ provider, label, Icon }) => (
              <button key={provider} onClick={() => handleOAuth(provider)} disabled={!!oauthLoading || loading}
                className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors hover:bg-white/5 disabled:opacity-50"
                style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#e8f0f8' }}>
                {oauthLoading === provider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon />}
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex items-center gap-3 mb-6">
            <div className="flex-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <span className="text-xs" style={{ color: '#4a5568' }}>or continue with email</span>
            <div className="flex-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8ba0b4' }}>Email address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" autoComplete="email"
                className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#e8f0f8' }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(81,201,211,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={{ color: '#8ba0b4' }}>Password</label>
                {mode === 'signin' && (
                  <button type="button" onClick={() => setError('Password reset: go to Supabase → Authentication → Users to reset.')}
                    className="text-xs transition-colors" style={{ color: '#51C9D3' }}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full rounded-xl border px-4 py-3 pr-11 text-sm transition-colors focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#e8f0f8' }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(81,201,211,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#4a5568' }}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password strength */}
              {mode === 'signup' && password && strength && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)' }} />
                    ))}
                  </div>
                  {strength.label && (
                    <p className="text-xs" style={{ color: strength.color }}>{strength.label} password</p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#fca5a5' }}>
                <X className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(81,201,211,0.3)', background: 'rgba(81,201,211,0.08)', color: '#51C9D3' }}>
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                {success}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' }}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#5a7085' }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null) }}
              className="font-semibold transition-colors" style={{ color: '#51C9D3' }}>
              {mode === 'signin' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          <p className="mt-6 text-center text-xs" style={{ color: '#4a5568' }}>
            By continuing, you agree to our{' '}
            <a href="#" className="underline" style={{ color: '#4a5568' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="underline" style={{ color: '#4a5568' }}>Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
