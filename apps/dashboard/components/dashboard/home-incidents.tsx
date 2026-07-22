'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHead, ToneBadge, StatusDot } from '@/components/kit'
import { AlertTriangle, ArrowRight, Plus } from 'lucide-react'
import type { Tone } from '@/lib/data'
import { cn } from '@/lib/utils'

type Incident = {
  id: string
  title: string
  severity: string
  status: string
  created_at: string
  ai_summary: string | null
}

function severityTone(s: string): Tone {
  if (s === 'critical' || s === 'high') return 'critical'
  if (s === 'medium') return 'warning'
  return 'intel'
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function HomeIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('incidents')
        .select('id, title, severity, status, created_at, ai_summary')
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(4),
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
    ]).then(([{ data }, { count }]) => {
      setIncidents((data ?? []) as Incident[])
      setTotal(count ?? 0)
      setLoading(false)
    })
  }, [])

  return (
    <Card className="flex flex-col">
      <CardHead
        title="Active Incidents"
        desc="Open incidents requiring attention"
        action={
          <Link href="/incidents" className="flex items-center gap-1 text-xs font-medium text-intel hover:underline">
            All {total > 0 ? `(${total})` : ''} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="flex-1 space-y-2 px-5 pb-5">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border/40 bg-card/60" />
          ))
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-healthy/10">
              <AlertTriangle className="h-5 w-5 text-healthy" />
            </div>
            <p className="text-sm font-semibold text-foreground">All clear</p>
            <p className="mt-0.5 text-xs text-muted-foreground">No open incidents</p>
          </div>
        ) : (
          incidents.map((inc) => {
            const tone = severityTone(inc.severity)
            return (
              <Link
                key={inc.id}
                href={`/incidents/${inc.id}`}
                className="block rounded-lg border border-border/50 bg-background/30 px-3.5 py-2.5 transition-all hover:border-border hover:bg-accent/30"
              >
                <div className="flex items-center gap-2">
                  <StatusDot tone={tone} pulse />
                  <ToneBadge tone={tone}>{inc.severity}</ToneBadge>
                  <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(inc.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-foreground">{inc.title}</p>
                {inc.ai_summary && (
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{inc.ai_summary}</p>
                )}
              </Link>
            )
          })
        )}
        <Link
          href="/incidents"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/50 py-2 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Declare incident
        </Link>
      </div>
    </Card>
  )
}
