'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge, Confidence } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText, toneBg } from '@/lib/tones'
import {
  ArrowLeft, Sparkles, AlertTriangle, CheckCircle2, Clock, Loader2,
  Bot, Target, Zap, Shield, BarChart3, Users, Wrench, Search, Layers,
} from 'lucide-react'
import type { Tone } from '@/lib/data'
import { FixExecution } from '@/components/dashboard/fix-execution'

type DbInvestigation = {
  id: string
  title: string
  status: string
  root_cause: string | null
  timeline: Array<{ time: string; event: string; severity: string }> | null
  affected_services: string[] | null
  confidence: number | null
  business_impact: string | null
  technical_impact: string | null
  evidence: Record<string, string> | null
  agents_run: string[] | null
  recommendations_count: number
  created_at: string
  completed_at: string | null
}

type DbRecommendation = {
  id: string
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
}

const AGENT_META: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  incident: { label: 'Incident Agent', icon: <AlertTriangle className="h-3.5 w-3.5 text-critical" />, desc: 'Timeline & blast radius' },
  root_cause: { label: 'Root Cause Agent', icon: <Search className="h-3.5 w-3.5 text-warning" />, desc: 'Why it happened' },
  product: { label: 'Product Analyst', icon: <Users className="h-3.5 w-3.5 text-ai" />, desc: 'User impact' },
  ux: { label: 'UX Intelligence', icon: <Target className="h-3.5 w-3.5 text-intel" />, desc: 'Friction & experience' },
  qa: { label: 'QA Intelligence', icon: <Layers className="h-3.5 w-3.5 text-intel" />, desc: 'Regressions & coverage' },
  performance: { label: 'Performance Agent', icon: <BarChart3 className="h-3.5 w-3.5 text-healthy" />, desc: 'Metrics & forecasts' },
  security: { label: 'Security Agent', icon: <Shield className="h-3.5 w-3.5 text-warning" />, desc: 'Threat detection' },
  executive: { label: 'Executive Agent', icon: <Zap className="h-3.5 w-3.5 text-ai" />, desc: 'Business summary' },
}

function statusTone(s: string): Tone {
  if (s === 'failed') return 'critical'
  if (s === 'running') return 'warning'
  if (s === 'complete') return 'healthy'
  return 'intel'
}

function severityTone(s: string): Tone {
  if (s === 'critical') return 'critical'
  if (s === 'high') return 'warning'
  if (s === 'low') return 'intel'
  return 'intel'
}

function priorityTone(p: string): Tone {
  if (p === 'critical') return 'critical'
  if (p === 'high') return 'warning'
  if (p === 'low') return 'intel'
  return 'intel'
}

export default function InvestigationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [inv, setInv] = useState<DbInvestigation | null>(null)
  const [recs, setRecs] = useState<DbRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [executing, setExecuting] = useState<{ title: string; improvement?: string } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('investigations')
        .select('id, title, status, root_cause, timeline, affected_services, confidence, business_impact, technical_impact, evidence, agents_run, recommendations_count, created_at, completed_at')
        .eq('id', id)
        .single(),
      sb.from('recommendations')
        .select('id, type, title, description, confidence, impact_score, effort, expected_improvement, suggested_owner, priority, status')
        .eq('investigation_id', id)
        .order('created_at'),
    ]).then(([{ data: invData }, { data: recData }]) => {
      setInv(invData as DbInvestigation | null)
      setRecs((recData ?? []) as DbRecommendation[])
      setLoading(false)
    })
  }, [id])

  const handleApprove = async (rec: DbRecommendation) => {
    const sb = createClient()
    await sb.from('recommendations').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', rec.id)
    setRecs((prev) => prev.map((r) => r.id === rec.id ? { ...r, status: 'approved' } : r))
    setExecuting({ title: rec.title, improvement: rec.expected_improvement ?? undefined })
  }

  const handleReject = async (recId: string) => {
    const sb = createClient()
    await sb.from('recommendations').update({ status: 'rejected' }).eq('id', recId)
    setRecs((prev) => prev.map((r) => r.id === recId ? { ...r, status: 'rejected' } : r))
    showToast('Recommendation rejected')
  }


  if (loading) {
    return <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
  }
  if (!inv) {
    return (
      <div className="space-y-4">
        <Link href="/investigations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All investigations
        </Link>
        <p className="text-muted-foreground">Investigation not found.</p>
      </div>
    )
  }

  const conf = inv.confidence != null ? Math.round(inv.confidence * 100) : null
  const sTone = statusTone(inv.status)
  const agentOutputs = inv.evidence as Record<string, string> | null

  return (
    <div className="space-y-6">
      {executing && (
        <FixExecution
          title={executing.title}
          improvement={executing.improvement}
          onClose={() => setExecuting(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <Link href="/investigations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All investigations
      </Link>

      <PageHeader
        icon={<Search className="h-5 w-5 text-ai" />}
        title={inv.title}
        desc={`${inv.id.slice(0, 8)}… · ${inv.agents_run?.length ?? 0} agents · ${new Date(inv.created_at).toLocaleString()}`}
        actions={
          <div className="flex items-center gap-2">
            <ToneBadge tone={sTone}>{inv.status}</ToneBadge>
            {conf != null && <Confidence value={conf} />}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Root cause */}
          <Card>
            <CardHead
              title="Root Cause"
              desc="Primary finding"
              icon={<Sparkles className="h-4 w-4 text-ai" />}
            />
            <div className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-foreground">
                {inv.root_cause ?? 'Investigation in progress…'}
              </p>
              {inv.technical_impact && (
                <div className="mt-4 rounded-lg border border-border/50 bg-card/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Technical impact</p>
                  <p className="mt-1.5 text-sm text-foreground">{inv.technical_impact}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Timeline */}
          {inv.timeline && inv.timeline.length > 0 && (
            <Card>
              <CardHead title="Investigation Timeline" icon={<Clock className="h-4 w-4" />} />
              <div className="px-5 pb-5">
                <ol className="relative border-l border-border/60 pl-5">
                  {inv.timeline.map((entry, i) => {
                    const t = severityTone(entry.severity)
                    return (
                      <li key={i} className="relative mb-4 last:mb-0">
                        <span className={cn('absolute -left-[27px] mt-0.5 h-3 w-3 rounded-full ring-4 ring-background', toneBg[t])} />
                        <p className="font-mono text-[11px] text-muted-foreground">{entry.time}</p>
                        <p className="mt-0.5 text-sm text-foreground">{entry.event}</p>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </Card>
          )}

          {/* Agent outputs */}
          {agentOutputs && Object.keys(agentOutputs).length > 0 && (
            <Card>
              <CardHead title="Agent Reports" icon={<Bot className="h-4 w-4" />} desc="Individual agent findings" />
              <div className="divide-y divide-border/40 px-5 pb-5">
                {Object.entries(agentOutputs).map(([agentName, summary]) => {
                  const meta = AGENT_META[agentName]
                  if (!meta) return null
                  return (
                    <div key={agentName} className="py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {meta.icon}
                        <span className="text-xs font-semibold text-foreground">{meta.label}</span>
                        <span className="text-[10px] text-muted-foreground">{meta.desc}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{summary}</p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <Card>
              <CardHead title="Recommendations" desc="AI-generated actions awaiting approval" icon={<Wrench className="h-4 w-4" />} />
              <div className="space-y-3 px-5 pb-5">
                {recs.map((rec) => {
                  const pTone = priorityTone(rec.priority)
                  const impactPct = rec.impact_score != null ? Math.round(rec.impact_score * 100) : null
                  return (
                    <div key={rec.id} className="rounded-lg border border-border/60 bg-card/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <ToneBadge tone={pTone}>{rec.priority}</ToneBadge>
                            <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">{rec.type}</span>
                            {rec.effort && (
                              <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{rec.effort} effort</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                          {rec.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>
                          )}
                          {rec.expected_improvement && (
                            <p className="mt-2 text-xs font-medium text-healthy">
                              Expected: {rec.expected_improvement}
                            </p>
                          )}
                          {rec.suggested_owner && (
                            <p className="mt-1 text-[10px] text-muted-foreground">Owner: {rec.suggested_owner}</p>
                          )}
                        </div>
                        {impactPct != null && (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground">Impact</span>
                            <span className="text-sm font-bold text-ai">{impactPct}%</span>
                          </div>
                        )}
                      </div>

                      {rec.status === 'pending' && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleApprove(rec)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-ai/10 border border-ai/30 px-2 py-2 text-xs font-semibold text-ai hover:bg-ai/20 transition-colors"
                          >
                            <Zap className="h-3.5 w-3.5" /> Approve &amp; Execute
                          </button>
                          <button
                            onClick={() => handleReject(rec.id)}
                            className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {rec.status !== 'pending' && (
                        <div className="mt-2">
                          <ToneBadge tone={rec.status === 'approved' ? 'healthy' : 'intel'}>{rec.status}</ToneBadge>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {conf != null && (
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confidence</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-ai">{conf}%</span>
                  <Confidence value={conf} />
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
                  <div className="h-full rounded-full bg-ai transition-all" style={{ width: `${conf}%` }} />
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <ToneBadge tone={sTone}>{inv.status}</ToneBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Agents run</span>
                <span className="font-semibold text-foreground">{inv.agents_run?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recommendations</span>
                <span className="font-semibold text-foreground">{inv.recommendations_count}</span>
              </div>
              {inv.completed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="text-xs text-foreground">{new Date(inv.completed_at).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </Card>

          {inv.affected_services && inv.affected_services.length > 0 && (
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Affected services</p>
              <div className="flex flex-wrap gap-1.5">
                {inv.affected_services.map((svc) => (
                  <span key={svc} className="rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-xs text-foreground">
                    {svc}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {inv.business_impact && (
            <Card className="border-warning/20 bg-warning/[0.03] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">Business impact</p>
              <p className="text-sm leading-relaxed text-foreground">{inv.business_impact}</p>
            </Card>
          )}

          <div className="space-y-2">
            <Link
              href="/recommendations"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ai px-3 py-2 text-xs font-medium text-ai-foreground hover:opacity-90 transition-opacity"
            >
              View all recommendations
            </Link>
            <button
              onClick={() => router.push('/investigations')}
              className="flex w-full items-center justify-center rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              Back to investigations
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
