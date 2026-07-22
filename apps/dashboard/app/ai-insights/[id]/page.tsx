'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge, Confidence } from '@/components/kit'
import { Sparkles, ArrowLeft, Users, AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react'
import type { Tone } from '@/lib/data'

type DbInsight = {
  id: string
  category: string
  title: string
  description: string | null
  confidence: number | null
  recommendation: string | null
  recommended_action: string | null
  impact_score: number | null
  affected_users: number | null
  priority: string | null
  evidence: Record<string, unknown> | null
  status: string | null
  created_at: string
}

function categoryTone(c: string): Tone {
  if (c === 'error' || c === 'security') return 'critical'
  if (c === 'warning' || c === 'performance') return 'warning'
  if (c === 'growth' || c === 'success') return 'healthy'
  return 'intel'
}

function priorityTone(p: string | null): Tone {
  if (p === 'critical') return 'critical'
  if (p === 'high') return 'warning'
  if (p === 'low') return 'intel'
  return 'intel'
}

function priorityIcon(p: string | null) {
  if (p === 'critical') return <AlertTriangle className="h-4 w-4 text-critical" />
  if (p === 'high') return <TrendingUp className="h-4 w-4 text-warning" />
  return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
}

export default function InsightDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [insight, setInsight] = useState<DbInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const sb = createClient()
    sb.from('ai_insights')
      .select('id, category, title, description, confidence, recommendation, recommended_action, impact_score, affected_users, priority, evidence, status, created_at')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setInsight(data as DbInsight | null)
        setLoading(false)
      })
  }, [id])

  const handleUpdateStatus = async (newStatus: string) => {
    const sb = createClient()
    const { error } = await sb.from('ai_insights').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setInsight((prev) => prev ? { ...prev, status: newStatus } : prev)
      showToast(`Marked as ${newStatus}`)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
  }

  if (!insight) {
    return (
      <div className="flex flex-col items-center gap-3 py-32 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground opacity-20" />
        <p className="text-sm text-muted-foreground">Insight not found.</p>
        <button onClick={() => router.push('/ai-insights')} className="text-xs text-intel hover:underline">
          Back to AI Insights
        </button>
      </div>
    )
  }

  const tone = categoryTone(insight.category)
  const pTone = priorityTone(insight.priority)
  const confidence = Math.round((insight.confidence ?? 0.8) * 100)
  const impactPct = Math.round((insight.impact_score ?? 0.5) * 100)
  const rec = insight.recommended_action ?? insight.recommendation

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        icon={<Sparkles className="h-5 w-5 text-ai" />}
        title={insight.title}
        desc={`${insight.category.charAt(0).toUpperCase() + insight.category.slice(1)} · ${new Date(insight.created_at).toLocaleString()}`}
        actions={
          <button
            onClick={() => router.push('/ai-insights')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHead title="Analysis" desc="AI-generated finding" icon={<Sparkles className="h-4 w-4 text-ai" />} />
            <div className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-foreground">{insight.description ?? 'No description available.'}</p>

              {rec && (
                <div className="mt-4 rounded-lg border border-ai/20 bg-ai/[0.05] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ai">Recommended action</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">{rec}</p>
                </div>
              )}
            </div>
          </Card>

          {insight.evidence && Object.keys(insight.evidence).length > 0 && (
            <Card>
              <CardHead title="Evidence" desc="Supporting data from the platform" />
              <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2">
                {Object.entries(insight.evidence).map(([key, val]) => (
                  <div key={key} className="rounded-lg border border-border/50 bg-card/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{String(val)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Priority</span>
                <div className="flex items-center gap-1.5">
                  {priorityIcon(insight.priority)}
                  <ToneBadge tone={pTone}>{insight.priority ?? 'medium'}</ToneBadge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Category</span>
                <ToneBadge tone={tone}>{insight.category}</ToneBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <ToneBadge tone={insight.status === 'resolved' ? 'healthy' : 'intel'}>
                  {insight.status ?? 'active'}
                </ToneBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <Confidence value={confidence} />
              </div>
              {(insight.affected_users ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Users affected</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    {insight.affected_users}
                  </span>
                </div>
              )}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Impact score</span>
                  <span className="text-xs font-semibold text-foreground">{impactPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                  <div
                    className="h-full rounded-full bg-ai transition-all"
                    style={{ width: `${impactPct}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
            <div className="space-y-2">
              {insight.status !== 'resolved' && (
                <button
                  onClick={() => handleUpdateStatus('resolved')}
                  className="w-full rounded-lg bg-healthy/10 border border-healthy/30 px-3 py-2 text-xs font-medium text-healthy hover:bg-healthy/20 transition-colors"
                >
                  Mark as resolved
                </button>
              )}
              {insight.status !== 'dismissed' && (
                <button
                  onClick={() => handleUpdateStatus('dismissed')}
                  className="w-full rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                >
                  Dismiss
                </button>
              )}
              {(insight.status === 'resolved' || insight.status === 'dismissed') && (
                <button
                  onClick={() => handleUpdateStatus('active')}
                  className="w-full rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Reopen
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
