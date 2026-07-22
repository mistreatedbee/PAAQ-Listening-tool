'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge, Confidence } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { Search, Sparkles, CheckCircle2, Clock, AlertTriangle, Loader2, ChevronRight, Bot } from 'lucide-react'
import type { Tone } from '@/lib/data'

type DbInvestigation = {
  id: string
  title: string
  status: string
  root_cause: string | null
  confidence: number | null
  business_impact: string | null
  agents_run: string[] | null
  recommendations_count: number
  created_at: string
  completed_at: string | null
}

function statusTone(s: string): Tone {
  if (s === 'failed') return 'critical'
  if (s === 'running') return 'warning'
  if (s === 'complete') return 'healthy'
  return 'intel'
}

function statusIcon(s: string) {
  if (s === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" />
  if (s === 'complete') return <CheckCircle2 className="h-3.5 w-3.5 text-healthy" />
  if (s === 'failed') return <AlertTriangle className="h-3.5 w-3.5 text-critical" />
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<DbInvestigation[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchInvestigations = () => {
    const sb = createClient()
    return sb
      .from('investigations')
      .select('id, title, status, root_cause, confidence, business_impact, agents_run, recommendations_count, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setInvestigations((data ?? []) as DbInvestigation[])
        setLoading(false)
      })
  }

  useEffect(() => { fetchInvestigations() }, [])

  const handleTrigger = async () => {
    setTriggering(true)
    showToast('Dispatching 8 AI agents…')
    try {
      const sb = createClient()
      const { data, error } = await sb.functions.invoke('investigate', { body: {} })
      if (error) throw error
      showToast(`Investigation complete — ${data?.recommendations ?? 0} recommendations generated`)
      await fetchInvestigations()
    } catch {
      showToast('Failed — make sure ANTHROPIC_API_KEY is set in Supabase Edge Function secrets')
    }
    setTriggering(false)
  }

  const complete = investigations.filter((i) => i.status === 'complete').length
  const running = investigations.filter((i) => i.status === 'running').length
  const pending = investigations.reduce((a, i) => a + i.recommendations_count, 0)
  const avgConf = investigations.filter((i) => i.confidence != null).length
    ? Math.round(
        investigations
          .filter((i) => i.confidence != null)
          .reduce((a, i) => a + (i.confidence ?? 0), 0) /
          investigations.filter((i) => i.confidence != null).length *
          100,
      )
    : 0

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        icon={<Search className="h-5 w-5 text-ai" />}
        title="AI Investigations"
        desc="8 specialist agents automatically investigate incidents, correlate evidence, and surface root causes."
        actions={
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {triggering
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Sparkles className="h-4 w-4" />}
            {triggering ? 'Investigating…' : 'Trigger Investigation'}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Total', v: String(investigations.length), t: 'text-foreground' },
          { l: 'Complete', v: String(complete), t: 'text-healthy' },
          { l: 'Recommendations', v: String(pending), t: 'text-warning' },
          { l: 'Avg confidence', v: avgConf ? `${avgConf}%` : '—', t: 'text-ai' },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.l}</p>
            <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight', s.t)}>{s.v}</p>
          </Card>
        ))}
      </div>

      {running > 0 && (
        <Card className="flex items-center gap-3 border-warning/30 bg-warning/[0.04] px-5 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-warning" />
          <p className="text-sm text-foreground">
            <span className="font-semibold text-warning">{running} investigation{running > 1 ? 's' : ''} running</span>
            {' '}— agents are working. Refresh in a moment to see results.
          </p>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : investigations.length === 0 ? (
        <Card className="p-10 text-center">
          <Bot className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">No investigations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Trigger Investigation" to dispatch all 8 agents.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {investigations.map((inv) => {
            const tone = statusTone(inv.status)
            const conf = inv.confidence != null ? Math.round(inv.confidence * 100) : null
            return (
              <Card key={inv.id} className="p-5 transition-colors hover:border-border">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {statusIcon(inv.status)}
                      <ToneBadge tone={tone}>{inv.status}</ToneBadge>
                      <span className="font-mono text-[10px] text-muted-foreground">{inv.id.slice(0, 8)}…</span>
                      {inv.agents_run && (
                        <span className="text-[10px] text-muted-foreground">
                          {inv.agents_run.length} agents
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-foreground">{inv.title}</h3>

                    {inv.root_cause && (
                      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                        {inv.root_cause}
                      </p>
                    )}

                    {inv.business_impact && (
                      <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Business impact</p>
                        <p className="mt-0.5 text-xs text-foreground line-clamp-1">{inv.business_impact}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {timeAgo(inv.created_at)}
                      </span>
                      {inv.recommendations_count > 0 && (
                        <span className="rounded-full bg-ai/10 px-2 py-0.5 text-[10px] font-semibold text-ai">
                          {inv.recommendations_count} recommendation{inv.recommendations_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 lg:flex-col lg:items-end">
                    {conf != null && (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-muted-foreground">Confidence</span>
                        <Confidence value={conf} />
                      </div>
                    )}
                    {inv.status === 'complete' && (
                      <Link
                        href={`/investigations/${inv.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-ai/10 border border-ai/20 px-3 py-1.5 text-xs font-medium text-ai hover:bg-ai/20 transition-colors"
                      >
                        View report <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
