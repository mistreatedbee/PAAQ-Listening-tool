'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHead, ToneBadge, StatusDot } from '@/components/kit'
import { CreditCard, Wallet, ArrowUpRight, ArrowDownLeft, Zap, CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { Tone } from '@/lib/data'

type WebhookEvent = {
  id: string
  event_type: string | null
  status: string | null
  amount: number | null
  currency: string | null
  created_at: string
  error_message: string | null
}

type WalletStat = {
  total_balance: number
  total_pending: number
  count: number
}

type PaymentStat = {
  label: string
  value: string | number
  sub?: string
  tone: Tone
  Icon: typeof CreditCard
}

function eventTone(s: string | null): Tone {
  if (s === 'success' || s === 'processed') return 'healthy'
  if (s === 'failed' || s === 'error') return 'critical'
  if (s === 'pending') return 'warning'
  return 'intel'
}

function formatAmount(amt: number | null, currency: string | null) {
  if (amt == null) return '—'
  const c = (currency ?? 'usd').toUpperCase()
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(amt / 100)
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function PaymentsPage() {
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([])
  const [stats, setStats] = useState<PaymentStat[]>([])
  const [walletStat, setWalletStat] = useState<WalletStat | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      // Recent stripe webhooks
      sb.from('stripe_webhook_events')
        .select('id, event_type, status, amount, currency, created_at, error_message')
        .order('created_at', { ascending: false })
        .limit(15),
      // Webhook stats
      sb.from('stripe_webhook_events').select('*', { count: 'exact', head: true }),
      sb.from('stripe_webhook_events').select('*', { count: 'exact', head: true }).eq('status', 'success'),
      sb.from('stripe_webhook_events').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      sb.from('stripe_webhook_events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      // Wallet / escrow aggregate
      sb.from('expert_wallets').select('balance, pending_balance'),
    ]).then(([
      { data: webhookData },
      { count: totalWebhooks },
      { count: successWebhooks },
      { count: failedWebhooks },
      { count: pendingWebhooks },
      { data: wallets },
    ]) => {
      setWebhooks((webhookData ?? []) as WebhookEvent[])

      const total = totalWebhooks ?? 0
      const success = successWebhooks ?? 0
      const failed = failedWebhooks ?? 0
      const pending = pendingWebhooks ?? 0
      const successRate = total > 0 ? Math.round((success / total) * 100) : 0

      const ws = (wallets ?? []) as { balance: number | null; pending_balance: number | null }[]
      const totalBalance = ws.reduce((a, w) => a + (w.balance ?? 0), 0)
      const totalPending = ws.reduce((a, w) => a + (w.pending_balance ?? 0), 0)
      setWalletStat({ total_balance: totalBalance, total_pending: totalPending, count: ws.length })

      setStats([
        {
          label: 'Webhook Success Rate',
          value: `${successRate}%`,
          sub: `${success} / ${total} events`,
          tone: successRate >= 99 ? 'healthy' : successRate >= 95 ? 'warning' : 'critical',
          Icon: Zap,
        },
        {
          label: 'Failed Webhooks',
          value: failed,
          sub: failed === 0 ? 'None — all clear' : 'Needs attention',
          tone: failed === 0 ? 'healthy' : failed < 5 ? 'warning' : 'critical',
          Icon: XCircle,
        },
        {
          label: 'Pending Events',
          value: pending,
          sub: 'Awaiting processing',
          tone: pending < 10 ? 'healthy' : pending < 50 ? 'warning' : 'critical',
          Icon: Clock,
        },
        {
          label: 'Total Wallet Balance',
          value: formatAmount(totalBalance, 'usd'),
          sub: `${ws.length} wallets · ${formatAmount(totalPending, 'usd')} pending`,
          tone: 'intel',
          Icon: Wallet,
        },
      ])
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-book/10">
          <CreditCard className="h-5 w-5 text-book" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Payments & Wallet Monitor</h1>
          <p className="text-xs text-muted-foreground">
            Stripe webhook health, escrow flow, and expert wallet balances
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border/40 bg-card/60" />
            ))
          : stats.map((s) => {
              const Icon = s.Icon
              return (
                <Card key={s.label} className="relative overflow-hidden">
                  <div className="absolute right-3 top-3 opacity-5">
                    <Icon className="h-14 w-14" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <ToneBadge tone={s.tone} dot>
                        {s.tone === 'healthy' ? 'OK' : s.tone === 'warning' ? 'Warn' : s.tone === 'critical' ? 'Alert' : 'Live'}
                      </ToneBadge>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
                    <p className="text-[11px] font-medium text-foreground">{s.label}</p>
                    {s.sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{s.sub}</p>}
                  </div>
                </Card>
              )
            })}
      </div>

      {/* Webhook event log */}
      <Card>
        <CardHead
          title="Stripe Webhook Feed"
          desc="Most recent incoming events from Stripe — payments, subscriptions, payouts"
        />
        <div className="divide-y divide-border/40 px-5 pb-5">
          {loading
            ? Array(8).fill(0).map((_, i) => (
                <div key={i} className="py-3 flex gap-3">
                  <div className="h-3 w-40 animate-pulse rounded bg-card flex-shrink-0" />
                  <div className="h-3 w-16 animate-pulse rounded bg-card ml-auto" />
                </div>
              ))
            : webhooks.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No webhook events found
              </div>
            ) : (
              webhooks.map((w) => {
                const tone = eventTone(w.status)
                const StatusIcon = tone === 'healthy' ? CheckCircle2 : tone === 'critical' ? XCircle : tone === 'warning' ? Clock : Zap
                return (
                  <div key={w.id} className="flex items-center gap-3 py-2.5">
                    <StatusIcon className={
                      tone === 'healthy' ? 'h-3.5 w-3.5 text-healthy shrink-0' :
                      tone === 'critical' ? 'h-3.5 w-3.5 text-critical shrink-0' :
                      tone === 'warning' ? 'h-3.5 w-3.5 text-warning shrink-0' :
                      'h-3.5 w-3.5 text-intel shrink-0'
                    } />
                    <span className="text-xs font-medium text-foreground flex-1 truncate">
                      {w.event_type ?? 'unknown'}
                    </span>
                    {w.amount != null && (
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {formatAmount(w.amount, w.currency)}
                      </span>
                    )}
                    <ToneBadge tone={tone}>{w.status ?? 'unknown'}</ToneBadge>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(w.created_at)}</span>
                  </div>
                )
              })
            )}
        </div>
      </Card>
    </div>
  )
}
