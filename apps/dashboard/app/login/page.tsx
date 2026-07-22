'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { Sparkles, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck, Zap, BrainCircuit, BarChart3 } from 'lucide-react'

type AuthMode = 'signin' | 'signup'

const FEATURES = [
  {
    icon: <Zap className="h-4 w-4" />,
    title: 'Real-time error intelligence',
    desc: 'Every crash, exception, and warning — captured, classified, and explained before your users notice.',
  },
  {
    icon: <BrainCircuit className="h-4 w-4" />,
    title: 'AI agents that investigate',
    desc: 'Six specialist agents work continuously to find root causes, surface regressions, and suggest fixes.',
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: 'Cross-module visibility',
    desc: 'Ask, Book, Attend, and Learn — one dashboard surfaces what\'s healthy, degraded, or failing.',
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: 'Security and compliance',
    desc: 'Anomaly detection, auth events, and Stripe webhook integrity — monitored continuously.',
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const sb = createClient()

    if (mode === 'signin') {
      const { error: err } = await sb.auth.signInWithPassword({ email, password })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } else {
      const { error: err } = await sb.auth.signUp({ email, password })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      setSuccess('Check your email to confirm your account, then sign in.')
      setMode('signin')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding + features */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden lg:flex" style={{ background: 'linear-gradient(145deg, #0f1923 0%, #0d2035 40%, #0a2a3a 70%, #0c2f3d 100%)' }}>
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #51C9D3, transparent 70%)' }} />
          <div className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #5FDED4, transparent 70%)' }} />
          <div className="absolute right-0 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #27A6CE, transparent 70%)' }} />
        </div>

        {/* Top — logo */}
        <div className="relative px-10 pt-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)' }}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight text-white">PAAQ</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#51C9D3' }}>Listening Tool</p>
            </div>
          </div>
        </div>

        {/* Middle — headline */}
        <div className="relative px-10">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-white">
            Every signal.<br />
            Every session.<br />
            <span style={{ color: '#51C9D3' }}>One surface.</span>
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            AI-native product intelligence and engineering operations — built specifically for the PAAQ platform.
          </p>

          {/* Features */}
          <div className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3">
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'rgba(81, 201, 211, 0.12)', color: '#51C9D3' }}
                >
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — live status indicator */}
        <div className="relative border-t border-white/8 px-10 py-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse" style={{ backgroundColor: '#51C9D3' }} />
              <span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: '#51C9D3' }} />
            </span>
            <span className="text-xs text-white/40">All systems operational · AI agents active</span>
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)' }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-black tracking-tight text-foreground">PAAQ</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Listening Tool</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'signin'
                ? 'Enter your credentials to access the dashboard'
                : 'Set up your PAAQ Listening Tool account'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="mb-6 flex rounded-lg border border-border/70 bg-card/60 p-1 text-sm">
            {(['signin', 'signup'] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
                  mode === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border/70 bg-card/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#51C9D3]/60 focus:outline-none focus:ring-2 focus:ring-[#51C9D3]/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Minimum 6 characters' : '••••••••'}
                  className="w-full rounded-lg border border-border/70 bg-card/60 px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#51C9D3]/60 focus:outline-none focus:ring-2 focus:ring-[#51C9D3]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error / success */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3.5 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-[#51C9D3]/20 bg-[#51C9D3]/8 px-3.5 py-2.5 text-sm text-[#51C9D3]">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)' }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null) }}
              className="font-medium hover:underline"
              style={{ color: '#51C9D3' }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
