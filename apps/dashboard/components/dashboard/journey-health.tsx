'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead } from '@/components/kit'
import { cn } from '@/lib/utils'
import { Route, CheckCircle2, AlertCircle, XCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type JourneyRow = {
  label: string
  sublabel: string
  count: number
  pct: number
  barColor: string
  textColor: string
  Icon: typeof CheckCircle2
}

export function JourneyHealth() {
  const { app } = useConnectedApp()
  const [total, setTotal] = useState(0)
  const [rows, setRows] = useState<JourneyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    Promise.all([
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'active'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'open'),
    ]).then(([allSes, activeSes, errors]) => {
      const tot    = allSes.count   ?? 0
      const active = activeSes.count ?? 0
      const er     = Math.min(errors.count ?? 0, tot)
      const failed = er
      const succ   = Math.max(0, tot - active - failed)
      const aband  = Math.max(0, tot - active - succ - failed)

      setTotal(tot)
      setRows([
        {
          label: 'Successful Journeys',
          sublabel: 'Users reached their goal',
          count: succ,
          pct: tot > 0 ? Math.round((succ / tot) * 100) : 0,
          barColor: 'bg-healthy',
          textColor: 'text-healthy',
          Icon: CheckCircle2,
        },
        {
          label: 'Abandoned Journeys',
          sublabel: 'Users dropped off mid-flow',
          count: aband,
          pct: tot > 0 ? Math.round((aband / tot) * 100) : 0,
          barColor: 'bg-warning',
          textColor: 'text-warning',
          Icon: AlertCircle,
        },
        {
          label: 'Failed Journeys',
          sublabel: 'Sessions interrupted by errors',
          count: failed,
          pct: tot > 0 ? Math.round((failed / tot) * 100) : 0,
          barColor: 'bg-critical',
          textColor: 'text-critical',
          Icon: XCircle,
        },
      ])
      setLoading(false)
    })
  }, [app.id])

  return (
    <Card>
      <CardHead
        title="User Journey Health"
        desc="How users are progressing through your application"
        icon={<Route className="h-4 w-4 text-intel" />}
        action={
          <Link href="/user-journey" className="flex items-center gap-1 text-xs font-medium text-intel hover:underline">
            Details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="px-5 pb-5 space-y-3">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border/40 bg-card/60" />
          ))
        ) : total === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Route className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No journey data yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">Connect your SDK to track user journeys</p>
          </div>
        ) : (
          <>
            {rows.map((r) => {
              const Icon = r.Icon
              return (
                <div key={r.label} className="rounded-lg border border-border/50 bg-background/30 px-3.5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', r.textColor)} />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{r.label}</p>
                        <p className="text-[10px] text-muted-foreground/70">{r.sublabel}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-bold tabular-nums', r.textColor)}>{r.pct}%</p>
                      <p className="text-[10px] text-muted-foreground/70">{r.count.toLocaleString()} sessions</p>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', r.barColor)}
                      style={{ width: `${r.pct}%`, transition: 'width 0.7s ease' }}
                    />
                  </div>
                </div>
              )
            })}
            <p className="text-center text-[10px] text-muted-foreground/50 pt-1">
              {total.toLocaleString()} total sessions recorded
            </p>
          </>
        )}
      </div>
    </Card>
  )
}
