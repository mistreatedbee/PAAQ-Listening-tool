'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { Sparkles, ArrowRight, Loader2, Eye, EyeOff, Check, X } from 'lucide-react'

// ─── Theme (matches onboarding light theme) ───────────────────────────────────

const C = {
  bg: '#f5f8fb',
  border: 'rgba(15,27,42,0.08)',
  borderStrong: 'rgba(15,27,42,0.15)',
  textPrimary: '#0f1b2a',
  textSecondary: '#4a5a6b',
  textMuted: '#7a8fa3',
  teal: '#27a6ce',
  tealSoft: 'rgba(39,166,206,0.08)',
  green: '#16a34a',
  red: '#dc2626',
  redSoft: 'rgba(220,38,38,0.08)',
}

const TEAL_GRADIENT = 'linear-gradient(135deg,#27a6ce,#51c9d3)'

// ─── OAuth provider icons ─────────────────────────────────────────────────────

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

// ─── Password strength ────────────────────────────────────────────────────────

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
    4: { label: 'Strong', color: '#16a34a' },
  }
  return { score: capped, ...map[capped] }
}

// ─── Reusable inputs ──────────────────────────────────────────────────────────

function AuthInput({ type = 'text', value, onChange, placeholder, autoComplete, children }: {
  type?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; children?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative">
      <input
        type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} required
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          borderColor: focused ? C.teal : C.border,
          boxShadow: focused ? `0 0 0 3px ${C.tealSoft}` : 'none',
          color: C.textPrimary,
        }}
        className="h-12 w-full rounded-xl border bg-white px-4 pr-11 text-sm outline-none transition-all placeholder:text-slate-400"
      />
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const strength = mode === 'signup' ? passwordStrength(password) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
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
      // Auto sign in after signup (works when email confirmation is disabled in Supabase)
      const { error: signInErr } = await sb.auth.signInWithPassword({ email, password })
      if (signInErr) { setError(signInErr.message); setLoading(false); return }
      router.push('/onboarding')
      router.refresh()
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

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError(null)
    setPassword('')
  }

  return (
    <div className="min-h-screen flex" style={{ background: C.bg }}>

      {/* ── Left brand panel ───────────────────────────────────────────────── */}
      <div className="relative hidden w-[48%] flex-col justify-between overflow-hidden lg:flex"
        style={{ background: 'linear-gradient(145deg,#0c1f2e 0%,#0d2337 50%,#0b2a40 100%)' }}>
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle,#51C9D3,transparent 70%)' }} />
          <div className="absolute -bottom-16 left-1/4 h-64 w-64 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle,#27a6ce,transparent 70%)' }} />
        </div>

        {/* Logo */}
        <div className="relative px-10 pt-10">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="PAAQ Intelligence" width={36} height={36} className="rounded-xl shadow-md" />
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight text-white">PAAQ Intelligence</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#51C9D3' }}>AI Digital Product Platform</p>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative px-10">
          <h2 className="mb-4 text-3xl font-black leading-tight text-white">
            Monitor your product.<br />
            <span style={{ backgroundImage: 'linear-gradient(90deg,#51C9D3,#5FDED4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Understand it with AI.
            </span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#8ba0b4' }}>
            Connect websites, mobile apps, and APIs in minutes. AI agents surface insights immediately.
          </p>
        </div>

        {/* Benefits */}
        <div className="relative space-y-4 px-10 pb-10">
          {[
            { icon: Sparkles, text: 'AI root cause analysis in seconds' },
            { icon: Eye,      text: 'Real-time event stream across all platforms' },
            { icon: Check,    text: 'Knowledge graph built automatically' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'rgba(81,201,211,0.15)' }}>
                <Icon className="h-3.5 w-3.5" style={{ color: '#51C9D3' }} />
              </div>
              <span className="text-sm" style={{ color: '#8ba0b4' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12" style={{ background: C.bg }}>
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Image src="/logo.png" alt="PAAQ Intelligence" width={32} height={32} className="rounded-lg" />
            <span className="text-sm font-bold" style={{ color: C.textPrimary }}>PAAQ Intelligence</span>
          </div>

          <h1 className="mb-1 text-2xl font-black" style={{ color: C.textPrimary }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mb-8 text-sm" style={{ color: C.textSecondary }}>
            {mode === 'signin' ? 'Sign in to your PAAQ dashboard.' : 'Start monitoring in under 5 minutes.'}
          </p>

          {/* OAuth buttons */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            {([
              { provider: 'google' as const, label: 'Google', Icon: GoogleIcon },
              { provider: 'github' as const, label: 'GitHub', Icon: GithubIcon },
            ]).map(({ provider, label, Icon }) => (
              <button key={provider} onClick={() => handleOAuth(provider)} disabled={!!oauthLoading || loading}
                style={{ borderColor: C.borderStrong, color: C.textPrimary }}
                className="flex items-center justify-center gap-2 rounded-xl border bg-white py-3 text-sm font-semibold transition-colors hover:bg-slate-50 disabled:opacity-50">
                {oauthLoading === provider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon />}
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="relative mb-6 flex items-center gap-3">
            <div className="flex-1 border-t" style={{ borderColor: C.border }} />
            <span className="text-xs" style={{ color: C.textMuted }}>or continue with email</span>
            <div className="flex-1 border-t" style={{ borderColor: C.border }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold" style={{ color: C.textPrimary }}>
                Email address
              </label>
              <AuthInput
                type="email" value={email} onChange={setEmail}
                placeholder="you@company.com" autoComplete="email"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold" style={{ color: C.textPrimary }}>Password</label>
                {mode === 'signin' && (
                  <a href="#" className="text-xs font-medium" style={{ color: C.teal }}>Forgot password?</a>
                )}
              </div>
              <AuthInput
                type={showPw ? 'text' : 'password'} value={password} onChange={setPassword}
                placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}>
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </AuthInput>

              {/* Password strength meter */}
              {mode === 'signup' && password && strength && (
                <div className="mt-2">
                  <div className="mb-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i <= strength.score ? strength.color : C.border }} />
                    ))}
                  </div>
                  {strength.label && (
                    <p className="text-xs font-medium" style={{ color: strength.color }}>{strength.label} password</p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: 'rgba(220,38,38,0.3)', background: C.redSoft, color: C.red }}>
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ background: TEAL_GRADIENT }}
              className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50">
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <>{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: C.textSecondary }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={switchMode} className="font-semibold transition-colors" style={{ color: C.teal }}>
              {mode === 'signin' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          <p className="mt-6 text-center text-xs" style={{ color: C.textMuted }}>
            By continuing, you agree to our{' '}
            <a href="#" className="underline underline-offset-2">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="underline underline-offset-2">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
