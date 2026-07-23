'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { Calendar, Users, MessageCircle, UserCheck, CreditCard, Minus } from 'lucide-react'
import type { Tone } from '@/lib/data'

type FlowStatus = 'healthy' | 'degraded' | 'failing' | 'no-data'

type Flow = {
  id: string
  label: string
  moduleColor: string
  Icon: typeof Calendar
  steps: string[]
  status: FlowStatus
  rate: number
  count: number
}

function statusTone(s: FlowStatus): Tone {
  if (s === 'healthy') return 'healthy'
  if (s === 'degraded') return 'warning'
  if (s === 'failing') return 'critical'
  return 'intel'
}

function computeFlow(
  events: { event_name: string; screen_name: string | null; event_category: string | null }[],
  errors: { error_type: string | null; screen: string | null; status: string | null }[],
  patterns: RegExp[],
  errPatterns: RegExp[],
): { count: number; status: FlowStatus; rate: number } {
  const ev = events.filter((e) => patterns.some((p) => p.test([e.screen_name, e.event_category, e.event_name].filter(Boolean).join(' '))))
  const er = errors.filter((e) => errPatterns.some((p) => p.test([e.screen, e.error_type].filter(Boolean).join(' '))))
  if (ev.length === 0) return { count: 0, status: 'no-data', rate: 0 }
  const rate = Math.max(0, Math.round(((ev.length - er.length) / ev.length) * 100))
  const status: FlowStatus = rate >= 97 ? 'healthy' : rate >= 85 ? 'degraded' : 'failing'
  return { count: ev.length, status, rate }
}

export function CriticalFlows() {
  const { app } = useConnectedApp()
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    Promise.all([
      sb.from('events').select('event_name, screen_name, event_category').eq('project_id', app.id).limit(2000),
      sb.from('errors').select('error_type, screen, status').eq('project_id', app.id).limit(500),
    ]).then(([{ data: evts }, { data: errs }]) => {
      const events = (evts ?? []) as { event_name: string; screen_name: string | null; event_category: string | null }[]
      const errors = (errs ?? []) as { error_type: string | null; screen: string | null; status: string | null }[]

      const defs: Omit<Flow, 'status' | 'rate' | 'count'>[] = [
        {
          id: 'book-session',
          label: 'Book Session End-to-End',
          moduleColor: 'text-book',
          Icon: Calendar,
          steps: ['Slot selection', 'Escrow hold', 'Agora session', 'AI note-taker', 'Payout'],
        },
        {
          id: 'attend-event',
          label: 'Event Ticket & Live Join',
          moduleColor: 'text-attend',
          Icon: Users,
          steps: ['Ticket purchase', 'QR / code entry', 'Live Q&A', 'Post-event'],
        },
        {
          id: 'ask-question',
          label: 'Ask Question Flow',
          moduleColor: 'text-ask',
          Icon: MessageCircle,
          steps: ['Submit question', 'Expert response', 'Rating'],
        },
        {
          id: 'expert-credibility',
          label: 'Expert Credibility Verification',
          moduleColor: 'text-ask',
          Icon: UserCheck,
          steps: ['Identity verified', 'LinkedIn linked', 'Proof of Work', 'Speaker badge'],
        },
        {
          id: 'stripe-payment',
          label: 'Stripe Payment Processing',
          moduleColor: 'text-book',
          Icon: CreditCard,
          steps: ['Webhook received', 'Signature verified', 'Wallet updated', 'Payout processed'],
        },
      ]

      const patterns: [RegExp[], RegExp[]][] = [
        [[/book|session|slot|escrow|agora|note.?tak/i], [/book|session|slot|escrow|agora/i]],
        [[/attend|event|ticket|qr|access.?code|live/i], [/attend|event|ticket|stripe/i]],
        [[/ask|question|answer|response|rating/i], [/ask|question|answer/i]],
        [[/credib|verif|identity|linkedin|proof|speaker|badge/i], [/verif|identity|credib/i]],
        [[/stripe|payment|webhook|wallet|payout|subscription/i], [/stripe|payment|webhook/i]],
      ]

      const result: Flow[] = defs.map((def, i) => ({
        ...def,
        ...computeFlow(events, errors, patterns[i][0], patterns[i][1]),
      }))

      setFlows(result)
      setLoading(false)
    })
  }, [app.id])

  return (
    <Card>
      <CardHead
        title="Critical Flows"
        desc="The five highest-value user journeys — any failure triggers a high-severity incident"
      />
      <div className="px-5 pb-5 space-y-2">
        {loading
          ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg border border-border/40 bg-card/60" />
            ))
          : flows.map((f) => {
              const tone = statusTone(f.status)
              const Icon = f.Icon
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 px-3.5 py-2.5"
                >
                  <Icon className={cn('h-4 w-4 shrink-0', f.moduleColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{f.label}</p>
                    <p className="hidden text-[10px] text-muted-foreground sm:block">
                      {f.steps.join(' → ')}
                    </p>
                  </div>
                  {f.status === 'no-data' ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Minus className="h-3 w-3" /> No data
                    </span>
                  ) : (
                    <>
                      <span className="hidden tabular-nums text-xs font-semibold text-foreground sm:block">{f.rate}%</span>
                      <ToneBadge tone={tone} dot>
                        {f.status === 'healthy' ? 'Healthy' : f.status === 'degraded' ? 'Degraded' : 'Failing'}
                      </ToneBadge>
                    </>
                  )}
                </div>
              )
            })}
      </div>
    </Card>
  )
}
