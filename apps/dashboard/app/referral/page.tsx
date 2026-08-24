'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { Copy, Check, Share2, Users, Gift, Bell, Smile } from 'lucide-react'

type ClaimedReferral = {
  referred_user_id: string
  email: string | null
  status: string
  created_at: string
}

type StatsResult = {
  ok: boolean
  code: string | null
  redeem_count: number
  claimed: ClaimedReferral[]
  error?: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReferralPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [claimed, setClaimed] = useState<ClaimedReferral[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/referral', { method: 'GET' })
      const data = (await res.json()) as StatsResult
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Could not load your referral details.')
        return
      }
      setCode(data.code)
      setCount(data.redeem_count)
      setClaimed(data.claimed ?? [])
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const shareUrl = code ? `${window.location.origin}/login?ref=${code}` : ''
  const message = code
    ? `Join me on PAAQ Intelligence — AI that listens to your product and surfaces insights in minutes. ${shareUrl}`
    : ''

  const copyText = (text: string, scope: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(scope)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on PAAQ Intelligence', text: message, url: shareUrl })
        return
      } catch {
        // User dismissed the share sheet — fall through to email.
      }
    }
    window.location.href = `mailto:?subject=${encodeURIComponent('Join me on PAAQ Intelligence')}&body=${encodeURIComponent(message)}`
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-intel/10">
          <Gift className="h-5 w-5 text-intel" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Invite friends, grow faster</h1>
          <p className="text-xs text-muted-foreground">
            Share your personal link — every friend who signs up is a step toward the next milestone.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={refresh} className="underline underline-offset-2">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="h-52 animate-pulse rounded-xl border border-border/40 bg-card/60" />
          <div className="h-52 animate-pulse rounded-xl border border-border/40 bg-card/60" />
        </div>
      ) : (
        <>
          {/* Hero invite card */}
          <Card className="p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">Your personal invite</h2>
                  {code && <ToneBadge tone="healthy" dot>Live</ToneBadge>}
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Anyone who opens this link can sign up — you'll be credited when they do.
                </p>

                {code ? (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2.5 font-mono text-xs text-foreground sm:text-sm">
                        <span className="truncate">{shareUrl}</span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => copyText(shareUrl, 'link')}
                          className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent"
                        >
                          {copied === 'link' ? <Check className="h-3.5 w-3.5 text-healthy" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied === 'link' ? 'Copied!' : 'Copy link'}
                        </button>
                        <button
                          onClick={handleShare}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white"
                          style={{ background: 'linear-gradient(135deg,#27a6ce,#51c9d3)' }}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Invite
                        </button>
                      </div>
                    </div>
                    {count > 0 && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        <strong className="text-foreground">{count}</strong> friend{count === 1 ? '' : 's'} signed up with your link. Nice work.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Preparing your link…
                  </div>
                )}
              </div>

              {/* Code + count snapshot */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-xl border border-border/70 bg-background/30 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Your code</p>
                  {code ? (
                    <button
                      onClick={() => copyText(code, 'code')}
                      className="mt-1 flex items-center gap-1.5 text-lg font-black tracking-widest text-foreground hover:underline"
                    >
                      {code}
                      {copied === 'code' ? <Check className="h-3.5 w-3.5 text-healthy" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  ) : (
                    <div className="mt-1 text-lg font-black text-muted-foreground">—</div>
                  )}
                  <p className="text-[10px] text-muted-foreground">share-code</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/30 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Signups</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-foreground">{count}</p>
                  <p className="text-[10px] text-muted-foreground">attributed to you</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Why share */}
          <Card>
            <CardHead title="Why share?" desc="Every friend you bring helps the community — and unlocks more for everyone." />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
              {[
                { icon: Users, title: 'Grow the community', body: 'More teams learning from real production data.' },
                { icon: Gift,  title: 'Track your influence', body: 'See your impact grow in real time, right here.' },
                { icon: Bell,  title: 'Stay in the loop', body: 'We’ll let you know whenever a friend signs up.' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/30 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-intel/10 text-intel">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* People you've referred */}
          <Card>
            <CardHead
              title="People you've brought in"
              desc={count > 0 ? `${count} signup${count === 1 ? '' : 's'} via your link` : 'Your list is empty for now'}
            />
            {count === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 pb-8 pt-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card">
                  <Smile className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">No signups yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Copy your link above and share it with a friend. When they join, they'll show up here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 px-5 pb-5">
                {claimed.map((r) => (
                  <div key={r.referred_user_id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-intel/10 text-xs font-semibold text-intel">
                      {(r.email ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{r.email ?? 'Private user'}</p>
                      <p className="text-[10px] text-muted-foreground">Joined {formatDate(r.created_at)}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold text-healthy">
                      <Check className="h-3.5 w-3.5" /> signed up
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}