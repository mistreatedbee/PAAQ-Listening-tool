'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, ToneBadge, Confidence } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  ListChecks, CheckCircle2, XCircle, UserCheck, Archive, Sparkles,
  ChevronDown, ChevronRight, Zap, Eye, FlaskConical, MessageSquare,
  AlertTriangle, TrendingUp, Clock, User,
} from 'lucide-react'
import type { Tone } from '@/lib/data'
import { FixExecution } from '@/components/dashboard/fix-execution'
import { ApprovalPolicyPill, useApprovalMode } from '@/components/dashboard/approval-policy'

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

type FixOption = {
  label: 'A' | 'B' | 'C'
  tag: string
  title: string
  desc: string
  confidence: number
  improvement: string
  risk: string
  riskTone: Tone
  effort: string
}

function generateOptions(rec: DbRecommendation): FixOption[] {
  const baseConf = rec.confidence != null ? Math.round(rec.confidence * 100) : 85
  const baseImp  = rec.impact_score != null ? Math.round(rec.impact_score * 100) : 40
  const imp      = rec.expected_improvement ?? `${baseImp}% improvement expected`

  return [
    {
      label: 'A',
      tag: 'Recommended',
      title: rec.title,
      desc: rec.description ?? 'Apply the primary AI-recommended fix with full automated testing and zero-downtime deployment.',
      confidence: baseConf,
      improvement: imp,
      risk: baseImp > 60 ? 'Medium' : 'Low',
      riskTone: baseImp > 60 ? 'warning' : 'healthy',
      effort: rec.effort ?? 'medium',
    },
    {
      label: 'B',
      tag: 'Conservative',
      title: `Staged rollout — ${rec.title}`,
      desc: 'Same fix applied behind a feature flag with a 10 → 50 → 100% staged rollout. 30-minute monitoring window between each stage.',
      confidence: Math.max(72, baseConf - 9),
      improvement: `${Math.round(baseImp * 0.8)}% improvement (staged)`,
      risk: 'Very Low',
      riskTone: 'healthy',
      effort: 'high',
    },
    {
      label: 'C',
      tag: rec.type === 'rollback' ? 'Immediate' : 'Quick patch',
      title: rec.type === 'rollback'
        ? 'Rollback to last stable version'
        : 'Lightweight patch — buy time for full fix',
      desc: rec.type === 'rollback'
        ? 'Instantly revert to the last known stable deployment. Zero code changes — minimal risk, immediate recovery.'
        : 'Apply a targeted patch that limits blast radius immediately while the full fix is prepared and reviewed.',
      confidence: Math.max(68, baseConf - 16),
      improvement: `${Math.round(baseImp * 0.45)}% immediate reduction`,
      risk: rec.type === 'rollback' ? 'Very Low' : 'Medium',
      riskTone: rec.type === 'rollback' ? 'healthy' : 'warning',
      effort: 'low',
    },
  ]
}

function priorityTone(p: string): Tone {
  if (p === 'critical') return 'critical'
  if (p === 'high') return 'warning'
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
  fix: 'Fix', rollback: 'Rollback', scale: 'Scale',
  notify: 'Notify', patch: 'Patch', investigate: 'Investigate',
}

const FILTERS = ['All', 'pending', 'approved', 'rejected', 'assigned', 'archived']

type Executing = { title: string; option: string; improvement: string } | null

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<DbRecommendation[]>([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [executing, setExecuting] = useState<Executing>(null)
  const [selectedOption, setSelectedOption] = useState<Record<string, 'A' | 'B' | 'C'>>({})
  const { mode } = useApprovalMode()

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
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

  const handleApproveExecute = (rec: DbRecommendation, optionLabel: 'A' | 'B' | 'C') => {
    const options = generateOptions(rec)
    const opt = options.find((o) => o.label === optionLabel)!
    setExecuting({
      title: opt.title,
      option: `Option ${optionLabel} — ${opt.tag}`,
      improvement: opt.improvement,
    })
    updateStatus(rec.id, 'approved')
  }

  const pending  = recommendations.filter((r) => r.status === 'pending').length
  const approved = recommendations.filter((r) => r.status === 'approved').length
  const critical = recommendations.filter((r) => r.priority === 'critical').length
  const avgImpact = (() => {
    const vals = recommendations.filter((r) => r.impact_score != null)
    if (!vals.length) return 0
    return Math.round(vals.reduce((a, r) => a + (r.impact_score ?? 0), 0) / vals.length * 100)
  })()

  const filtered = filter === 'All' ? recommendations : recommendations.filter((r) => r.status === filter)

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* Fix Execution Modal */}
      {executing && (
        <FixExecution
          title={executing.title}
          option={executing.option}
          improvement={executing.improvement}
          onClose={() => setExecuting(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          icon={<ListChecks className="h-5 w-5 text-ai" />}
          title="Recommendations"
          desc="AI-generated actions with multi-option fixes. Review each option, simulate changes, then approve for execution."
        />
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <ApprovalPolicyPill />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Pending approval', v: String(pending),    t: 'text-warning' },
          { l: 'Approved',         v: String(approved),   t: 'text-healthy' },
          { l: 'Critical priority', v: String(critical),  t: 'text-critical' },
          { l: 'Avg impact',       v: avgImpact ? `${avgImpact}%` : '—', t: 'text-ai' },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.l}</p>
            <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight tabular-nums', s.t)}>{s.v}</p>
          </Card>
        ))}
      </div>

      {/* Mode callout */}
      {mode === 'autonomous' && pending > 0 && (
        <Card className="flex items-center gap-3 border-healthy/30 bg-healthy/[0.04] px-5 py-3">
          <Zap className="h-4 w-4 text-healthy shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold text-healthy">Autonomous Mode active.</span>{' '}
            Low-risk recommendations will be resolved automatically. Medium and high-risk items need your approval.
          </p>
        </Card>
      )}

      {mode !== 'autonomous' && pending > 0 && (
        <Card className="flex items-center gap-3 border-warning/30 bg-warning/[0.04] px-5 py-3">
          <Sparkles className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold text-warning">{pending} recommendation{pending > 1 ? 's' : ''}</span>{' '}
            waiting for your decision. Review each option before approving execution.
          </p>
        </Card>
      )}

      {/* Filters */}
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

      {/* List */}
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
            const pTone     = priorityTone(rec.priority)
            const impactPct = rec.impact_score != null ? Math.round(rec.impact_score * 100) : null
            const confPct   = rec.confidence  != null ? Math.round(rec.confidence  * 100) : null
            const isPending = rec.status === 'pending'
            const isOpen    = expanded === rec.id
            const options   = generateOptions(rec)
            const chosen    = selectedOption[rec.id] ?? 'A'
            const chosenOpt = options.find((o) => o.label === chosen)!

            return (
              <Card key={rec.id} className={cn('transition-colors', isPending && 'border-ai/20')}>
                {/* Card top */}
                <div className="p-5 space-y-3">
                  {/* Badges row */}
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

                  {/* Title + description */}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                    {rec.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{rec.description}</p>
                    )}
                  </div>

                  {/* Impact + confidence */}
                  <div className="grid grid-cols-2 gap-2">
                    {impactPct != null && (
                      <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Business Impact</p>
                          <TrendingUp className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                            <div className="h-full rounded-full bg-ai transition-all" style={{ width: `${impactPct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-ai tabular-nums">{impactPct}%</span>
                        </div>
                      </div>
                    )}
                    {confPct != null && (
                      <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">AI Confidence</p>
                          <Sparkles className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                        <div className="mt-1.5">
                          <Confidence value={confPct} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3">
                    {rec.expected_improvement && (
                      <div className="flex items-center gap-1 text-xs font-medium text-healthy">
                        <CheckCircle2 className="h-3 w-3" />
                        {rec.expected_improvement}
                      </div>
                    )}
                    {rec.suggested_owner && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User className="h-3 w-3" />
                        {rec.suggested_owner}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                      <Clock className="h-3 w-3" />
                      {new Date(rec.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Action buttons — pending state */}
                  {isPending && (
                    <div className="space-y-2 pt-1 border-t border-border/40">
                      {/* Primary actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setExpanded(isOpen ? null : rec.id)}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                            isOpen
                              ? 'border-ai/40 bg-ai/10 text-ai'
                              : 'border-border/60 bg-card/60 text-foreground hover:bg-accent',
                          )}
                        >
                          <FlaskConical className="h-3.5 w-3.5" />
                          View Fix Options
                          {isOpen
                            ? <ChevronDown className="h-3 w-3" />
                            : <ChevronRight className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => handleApproveExecute(rec, chosen)}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-ai/30 bg-ai/10 px-3 py-2 text-xs font-semibold text-ai hover:bg-ai/20 transition-colors"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Approve &amp; Execute
                        </button>
                      </div>
                      {/* Secondary actions */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => updateStatus(rec.id, 'assigned')}
                          className="flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/60 px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-accent transition-colors"
                        >
                          <UserCheck className="h-3 w-3" /> Assign
                        </button>
                        <button
                          onClick={() => updateStatus(rec.id, 'rejected')}
                          className="flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/60 px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-accent transition-colors"
                        >
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                        <button
                          onClick={() => updateStatus(rec.id, 'archived')}
                          className="flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/60 px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-accent transition-colors"
                        >
                          <Archive className="h-3 w-3" /> Archive
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Non-pending nav */}
                  {!isPending && rec.investigation_id && (
                    <a href={`/investigations/${rec.investigation_id}`} className="text-[10px] text-intel hover:underline">
                      View investigation →
                    </a>
                  )}
                </div>

                {/* Expanded fix options panel */}
                {isOpen && isPending && (
                  <div className="border-t border-border/40 bg-background/30 px-5 pb-5 pt-4 rounded-b-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Fix Options — choose one to execute
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        AI-generated alternatives
                      </div>
                    </div>

                    <div className="space-y-2">
                      {options.map((opt) => {
                        const isSelected = chosen === opt.label
                        return (
                          <button
                            key={opt.label}
                            onClick={() => setSelectedOption((prev) => ({ ...prev, [rec.id]: opt.label }))}
                            className={cn(
                              'w-full rounded-xl border p-3.5 text-left transition-all',
                              isSelected
                                ? 'border-ai/40 bg-ai/8 ring-1 ring-ai/20'
                                : 'border-border/50 bg-card/60 hover:border-border hover:bg-card',
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {/* Option letter */}
                              <div className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                                isSelected
                                  ? 'border-ai/50 bg-ai/15 text-ai'
                                  : 'border-border/60 bg-muted/50 text-muted-foreground',
                              )}>
                                {opt.label}
                              </div>

                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={cn(
                                    'text-[9px] font-bold uppercase tracking-widest rounded-full px-1.5 py-0.5',
                                    opt.label === 'A'
                                      ? 'bg-ai/15 text-ai'
                                      : opt.label === 'B'
                                        ? 'bg-healthy/15 text-healthy'
                                        : 'bg-warning/15 text-warning',
                                  )}>
                                    {opt.tag}
                                  </span>
                                  <ToneBadge tone={opt.riskTone}>{opt.risk} risk</ToneBadge>
                                  <span className={cn('text-[10px] font-medium', effortColor(opt.effort))}>
                                    {opt.effort} effort
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-foreground leading-snug">{opt.title}</p>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">{opt.desc}</p>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-semibold text-healthy">{opt.improvement}</span>
                                  <span className="text-[10px] text-muted-foreground/60">·</span>
                                  <span className="text-[10px] text-muted-foreground">{opt.confidence}% confidence</span>
                                </div>
                              </div>

                              {isSelected && (
                                <div className="shrink-0 mt-0.5">
                                  <CheckCircle2 className="h-4 w-4 text-ai" />
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Execute row */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleApproveExecute(rec, chosen)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-ai/30 bg-ai/10 px-4 py-2.5 text-sm font-semibold text-ai hover:bg-ai/20 transition-colors"
                      >
                        <Zap className="h-4 w-4" />
                        Approve &amp; Execute Option {chosen}
                      </button>
                      <button
                        title="Ask AI about this recommendation"
                        className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Ask AI
                      </button>
                      <button
                        title="Simulate this fix — see what will change"
                        className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                        Simulate
                      </button>
                    </div>

                    {/* Risk callout */}
                    {chosenOpt.riskTone === 'warning' && (
                      <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                        <p className="text-[10px] text-muted-foreground">
                          Option {chosen} carries medium risk. Consider switching to Option B for a safer staged deployment.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
