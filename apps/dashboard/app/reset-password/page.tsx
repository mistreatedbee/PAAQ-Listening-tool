'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ArrowRight, Check, Loader2, Eye, EyeOff } from 'lucide-react'

// ─── Theme (matches login light theme) ───────────────────────────────────────

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

function ResetForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = passwordStrength(password)
  const match = confirm.length === 0 || confirm === password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setError(null)
    setLoading(true)

    // A recovery link clicked from the reset email exchanges a token that
    // creates a recovery session, so the browser client already has the
    // session cookies needed for updateUser to succeed.
    const sb = createClient()
    const { error: err } = await sb.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      if (err.message.toLowerCase().includes('session')) {
        setError('This reset link has expired. Please request a new one.')
      } else {
        setError(err.message)
      }
      return
    }

    setDone(true)
    setTimeout(() => router.replace('/login?tab=signin'), 1600)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12" style={{ background: C.bg }}>
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-black" style={{ color: C.textPrimary }}>
          {done ? 'Password updated' : 'Choose a new password'}
        </h1>
        <p className="mb-8 text-sm" style={{ color: C.textSecondary }}>
          {done
            ? 'Your password has been reset. You can now sign in with your new password.'
            : 'Enter a new password for your account. Make it at least 8 characters.'}
        </p>

        {done && (
          <div className="mb-6 rounded-xl border p-4" style={{ borderColor: C.tealSoft, background: C.tealSoft }}>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" style={{ color: C.green }} />
              <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>All set!</span>
            </div>
          </div>
        )}

        {!done && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold" style={{ color: C.textPrimary }}>
                New password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" required
                  className="h-12 w-full rounded-xl border bg-white px-4 pr-11 text-sm outline-none transition-all placeholder:text-slate-400"
                  style={{ borderColor: C.border, color: C.textPrimary }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && strength.label && (
                <div className="mt-2">
                  <div className="mb-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i <= strength.score ? strength.color : C.border }} />
                    ))}
                  </div>
                  <p className="text-xs font-medium" style={{ color: strength.color }}>{strength.label} password</p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold" style={{ color: C.textPrimary }}>
                Confirm password
              </label>
              <input
                type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••" autoComplete="new-password" required
                className="h-12 w-full rounded-xl border bg-white px-4 text-sm outline-none transition-all placeholder:text-slate-400"
                style={{ borderColor: match ? C.border : C.red, color: C.textPrimary }} />
              {!match && confirm.length > 0 && (
                <p className="mt-1 text-xs" style={{ color: C.red }}>Passwords do not match.</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm" style={{ borderColor: C.redSoft }}>
                <span style={{ color: C.red }}>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ background: TEAL_GRADIENT }}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50">
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <>Update password <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  )
}