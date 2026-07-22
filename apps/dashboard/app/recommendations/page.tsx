'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, ToneBadge, Confidence } from '@/components/kit'
import { cn } from '@/lib/utils'
import { ListChecks, CheckCircle2, XCircle, UserCheck, Archive, Sparkles } from 'lucide-react'
import type { Tone } from '@/lib/data'

type DbRecommendation = {
  id: string
  investigation_id: string | null
  type: string
  title: string
  description: string | null
  confidence: number | null
  impact_score: number | null
  effort: string | null
  expected_improvement: string | null
  suggested_owner: string | null
  priority: string
  status: string
  approved_by: string | null
  created_at: string
}

function priorityTone(p: string): Tone {
  if (p === 'critical') return 'critical'
  if (p === 'high') return 'warning'
  if (p === 'low') return 'intel'
  return 'intel'
}

function statusTone(s: string): Tone {
  if (s === 'approved') return 'healthy'
  if (s === 'rejected') return 'critical'
  if (s === 'assigned') return 'intel'
  return 'intel'
}

function effortColor(e: string | null) {
  if (e === 'low') return 'text-healthy'
  if (e === 'high') return 'text-critical'
  return 'text-warning'
}

const TYPE_LABELS: Record<string, string> = {
  fix: 'Fix', rollback: 'Rollback', scale: 'Scale', notify: 'Notify',
  patch: 'Patch', investigate: 'Investigate',
}

const FILTERS = ['All', 'pending', 'approved', 'rejected', 'assigned', 'archived']

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<DbRecommendation[]>([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchRecommendations = () => {
    const sb = createClient()
    return sb
      .from('recommendations')
      .select('id, investigation_id, type, title, description, confidence, impact_score, effort, expected_improvement, suggested_owner, priority, status, approved_by, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecommendations((data ?? []) as DbRecommendation[])
        setLoading(false)
      })
  }

  useEffect(() => { fetchRecommendations() }, [])

  const updateStatus = async (id: string, newStatus: string) => {
    const sb = createClient()
    const update: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'approved') update.approved_at = new Date().toISOString()
    await sb.from('recommendations').update(update).eq('id', id)
    setRecommendations((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r))
    showToast(`Recommendation ${newStatus}`)
  }

  const pending = recommendations.filter((r) => r.status === 'pending').length
  const approved = recommendations.filter((r) => r.status === 'approved').length
  const avgImpact = recommendations.filter((r) => r.impact_score != null).length
    ? Math.round(
        recommendations
          .filter((r) => r.impact_score != null)
          .reduce((a, r) => a + (r.impact_score ?? 0), 0) /
          recommendations.filter((r) => r.impact_score != null).length *
          100,
      )
    : 0
  const critical = recommendations.filter((r) => r.priority === 'critical').length

  const filtered = filter === 'All'
    ? recommendations
    : recommendations.filter((r) => r.status === filter)

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        icon={<ListChecks className="h-5 w-5 text-ai" />}
        title="Recommendations"
        desc="AI-generated actions awaiting your approval. Review, approve, assign or reject each recommendation."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Pending approval', v: String(pending), t: 'text-warning' },
          { l: 'Approved', v: String(approved), t: 'text-healthy' },
          { l: 'Critical priority', v: String(critical), t: 'text-critical' },
          { l: 'Avg impact', v: avgImpact ? `${avgImpact}%` : '—', t: 'text-ai' },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.l}</p>
            <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight', s.t)}>{s.v}</p>
          </Card>
        ))}
      </div>

      {pending > 0 && (
        <Card className="flex items-center gap-3 border-warning/30 bg-warning/[0.04] px-5 py-3">
          <Sparkles className="h-4 w-4 text-warning" />
          <p className="text-sm text-foreground">
            <span className="font-semibold text-warning">{pending} recommendation{pending > 1 ? 's' : ''}</span>
            {' '}waiting for your decision.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = f === 'All' ? recommendations.length : recommendations.filter((r) => r.status === f).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filter === f
                  ? 'border-ai/40 bg-ai/10 text-ai'
                  : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'All' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <ListChecks className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">
            {filter === 'All' ? 'No recommendations yet' : `No ${filter} recommendations`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === 'All'
              ? 'Run an investigation to generate AI-powered recommendations.'
              : 'Try a different filter.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((rec) => {
            const pTone = priorityTone(rec.priority)
            const impactPct = rec.impact_score != null ? Math.round(rec.impact_score * 100) : null
            const confPct = rec.confidence != null ? Math.round(rec.confidence * 100) : null
            const isPending = rec.status === 'pending'

            return (
              <Card key={rec.id} className={cn('p-5 transition-colors', isPending && 'border-ai/20')}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ToneBadge tone={pTone}>{rec.priority}</ToneBadge>
                      <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {TYPE_LABELS[rec.type] ?? rec.type}
                      </span>
                      {rec.effort && (
                        <span className={cn('text-[10px] font-medium', effortColor(rec.effort))}>
                          {rec.effort} effort
                        </span>
                      )}
                    </div>
                    {rec.status !== 'pending' && (
                      <ToneBadge tone={statusTone(rec.status)}>{rec.status}</ToneBadge>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                    {rec.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rec.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {impactPct != null && (
                      <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Impact</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                            <div className="h-full rounded-full bg-ai transition-all" style={{ width: `${impactPct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-ai">{impactPct}%</span>
                        </div>
                      </div>
                    )}
                    {confPct != null && (
                      <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Confidence</p>
                        <div className="mt-1">
                          <Confidence value={confPct} />
                        </div>
                      </div>
                    )}
                  </div>

                  {rec.expected_improvement && (
                    <p className="text-xs font-medium text-healthy">
                      Expected: {rec.expected_improvement}
                    </p>
                  )}

                  {rec.suggested_owner && (
                    <p className="text-[10px] text-muted-foreground">
                      Suggested owner: <span className="font-medium text-foreground">{rec.suggested_owner}</span>
                    </p>
                  )}

                  {isPending && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => updateStatus(rec.id, 'approved')}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-healthy/10 border border-healthy/30 px-3 py-2 text-xs font-medium text-healthy hover:bg-healthy/20 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => updateStatus(rec.id, 'assigned')}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Assign
                      </button>
                      <button
                        onClick={() => updateStatus(rec.id, 'rejected')}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => updateStatus(rec.id, 'archived')}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </button>
                    </div>
                  )}

                  {!isPending && rec.investigation_id && (
                    <a
                      href={`/investigations/${rec.investigation_id}`}
                      className="text-[10px] text-intel hover:underline"
                    >
                      View investigation →
                    </a>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
