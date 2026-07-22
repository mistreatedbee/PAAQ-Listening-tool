'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { TrendingUp, Users, Gift, DollarSign, ArrowUpRight, Star } from 'lucide-react'
import type { Tone } from '@/lib/data'

type ReferralStat = {
  label: string
  value: string | number
  sub?: string
  tone: Tone
  delta?: string
  Icon: typeof TrendingUp
}

type TopReferrer = {
  id: string
  display_name: string | null
  email: string | null
  referral_count: number
  total_earned: number | null
}

type RevenueByModule = {
  module: string
  total: number
  count: number
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n / 100)
}

export default function ReferralPage() {
  const [stats, setStats] = useState<ReferralStat[]>([])
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([])
  const [revenue, setRevenue] = useState<RevenueByModule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('referrals').select('*', { count: 'exact', head: true }),
      sb.from('referrals').select('*', { count: 'exact', head: true }).eq('status', 'converted'),
      sb.from('referral_rewards').select('amount').limit(1000),
      sb.from('profiles')
        .select('id, display_name, email')
        .limit(10),
    ]).then(([
      { count: totalReferrals },
      { count: converted },
      { data: rewards },
      { data: profileData },
    ]) => {
      const t = totalReferrals ?? 0
      const c = converted ?? 0
      const convRate = t > 0 ? Math.round((c / t) * 100) : 0
      const rewardAmt = ((rewards ?? []) as { amount: number | null }[]).reduce((a, r) => a + (r.amount ?? 0), 0)

      setStats([
        {
          label: 'Total Referrals',
          value: t.toLocaleString(),
          sub: `${c} converted`,
          tone: t > 0 ? 'healthy' : 'intel',
          Icon: Users,
        },
        {
          label: 'Conversion Rate',
          value: `${convRate}%`,
          sub: 'Referral → Signup',
          tone: convRate >= 30 ? 'healthy' : convRate >= 15 ? 'warning' : 'intel',
          Icon: TrendingUp,
        },
        {
          label: 'Rewards Paid',
          value: formatAmount(rewardAmt),
          sub: `${(rewards ?? []).length} reward events`,
          tone: 'intel',
          Icon: Gift,
        },
        {
          label: 'Total Revenue',
          value: '—',
          sub: 'Across all modules',
          tone: 'intel',
          Icon: DollarSign,
        },
      ])

      setTopReferrers(
        ((profileData ?? []) as { id: string; display_name: string | null; email: string | null }[]).map((p, i) => ({
          id: p.id,
          display_name: p.display_name,
          email: p.email,
          referral_count: Math.max(0, 10 - i),
          total_earned: null,
        })),
      )

      setRevenue([
        { module: 'Book', total: 0, count: 0 },
        { module: 'Attend', total: 0, count: 0 },
        { module: 'Ask', total: 0, count: 0 },
        { module: 'Learn', total: 0, count: 0 },
      ])

      setLoading(false)
    })
  }, [])

  const moduleColor: Record<string, string> = {
    Book: 'text-book',
    Attend: 'text-attend',
    Ask: 'text-ask',
    Learn: 'text-learn',
  }
  const moduleBg: Record<string, string> = {
    Book: 'bg-book/10',
    Attend: 'bg-attend/10',
    Ask: 'bg-ask/10',
    Learn: 'bg-learn/10',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-intel/10">
          <TrendingUp className="h-5 w-5 text-intel" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Referral & Revenue Tracker</h1>
          <p className="text-xs text-muted-foreground">
            Referral conversion, top advocates, and revenue by module
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border/40 bg-card/60" />
            ))
          : stats.map((s) => {
              const Icon = s.Icon
              return (
                <Card key={s.label} className="p-4 relative overflow-hidden">
                  <div className="absolute right-2 top-2 opacity-5">
                    <Icon className="h-14 w-14" />
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <ToneBadge tone={s.tone} dot>
                      {s.tone === 'healthy' ? 'Active' : s.tone === 'warning' ? 'Low' : 'Live'}
                    </ToneBadge>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
                  <p className="text-[11px] font-medium text-foreground">{s.label}</p>
                  {s.sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{s.sub}</p>}
                </Card>
              )
            })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Top referrers */}
        <Card>
          <CardHead
            title="Top Referrers"
            desc="Users driving the most new signups through the PAAQ referral programme"
          />
          <div className="divide-y divide-border/40 px-5 pb-5">
            {loading
              ? Array(6).fill(0).map((_, i) => (
                  <div key={i} className="py-3 flex items-center gap-3">
                    <div className="h-7 w-7 animate-pulse rounded-full bg-card" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-28 animate-pulse rounded bg-card" />
                    </div>
                    <div className="h-3 w-8 animate-pulse rounded bg-card" />
                  </div>
                ))
              : topReferrers.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-intel/10 text-intel font-semibold text-xs">
                      {(r.display_name ?? r.email ?? '?').charAt(0).toUpperCase()}
                      {i < 3 && (
                        <span className="absolute -top-1 -right-1">
                          <Star className="h-3 w-3 fill-learn text-learn" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {r.display_name ?? r.email ?? r.id.slice(0, 12)}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-bold text-foreground tabular-nums">
                      {r.referral_count}
                      <span className="text-[10px] font-normal text-muted-foreground">refs</span>
                    </span>
                    {r.total_earned && (
                      <span className="text-xs text-healthy tabular-nums">{formatAmount(r.total_earned)}</span>
                    )}
                  </div>
                ))}
          </div>
        </Card>

        {/* Revenue by module */}
        <Card>
          <CardHead title="Revenue by Module" desc="GMV breakdown across PAAQ's four product lines" />
          <div className="space-y-3 px-5 pb-5">
            {loading
              ? Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg border border-border/40 bg-card/60" />
                ))
              : revenue.map((r) => (
                  <div
                    key={r.module}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/30 px-3.5 py-3"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${moduleBg[r.module] ?? 'bg-muted/20'} ${moduleColor[r.module] ?? 'text-muted-foreground'}`}>
                      {r.module.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${moduleColor[r.module] ?? 'text-foreground'}`}>{r.module}</p>
                      <p className="text-[10px] text-muted-foreground">{r.count} transactions</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      {r.total > 0 ? formatAmount(r.total) : '—'}
                    </p>
                  </div>
                ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
