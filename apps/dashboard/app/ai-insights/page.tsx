'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { PageHeader, Card, ToneBadge } from '@/components/kit'
import { useBulkSelection, RowCheckbox, BulkActionsBar, ConfirmDeleteDialog } from '@/components/kit-bulk-actions'
import { InsightCard } from '@/components/insight-card'
import { AiButton } from '@/components/kit-ai-button'
import { Sparkles } from 'lucide-react'
import type { Insight, Tone } from '@/lib/data'

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

function toInsight(i: DbInsight): Insight {
  const rec = i.recommended_action ?? i.recommendation
  const actions: string[] = rec ? [rec, 'Investigate'] : ['Investigate']
  const affectedUsers = i.affected_users ?? 0
  return {
    id: i.id,
    title: i.title,
    summary: i.description ?? '',
    confidence: Math.round((i.confidence ?? 0.8) * 100),
    impact: i.category.charAt(0).toUpperCase() + i.category.slice(1),
    affected: affectedUsers > 0 ? `${affectedUsers} users` : '—',
    severity: categoryTone(i.category),
    actions,
    priority: i.priority ?? undefined,
    recommendedAction: rec ?? undefined,
    evidence: i.evidence ?? undefined,
  }
}

const FILTERS = ['All', 'critical', 'high', 'medium', 'low']

export default function AIInsightsPage() {
  const { app } = useConnectedApp()
  const [insights, setInsights] = useState<Insight[]>([])
  const [raw, setRaw] = useState<DbInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')
  const bulk = useBulkSelection()
  const [confirmMode, setConfirmMode] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchInsights = (projectId: string) => {
    const sb = createClient()
    return sb.from('ai_insights')
      .select('id, category, title, description, confidence, recommendation, recommended_action, impact_score, affected_users, priority, evidence, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as DbInsight[]
        setRaw(rows)
        setInsights(rows.map(toInsight))
        setLoading(false)
      })
  }

  useEffect(() => {
    if (app.id === '__loading__') return
    fetchInsights(app.id)
  }, [app.id])

  const handleRegenerate = async () => {
    setRegenerating(true)
    showToast('Running full AI analysis…')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ project_id: app.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      await fetchInsights(app.id)
      showToast(`Analysis complete — ${data?.insights ?? 'new'} insights generated`)
    } catch (err) {
      showToast(`Analysis failed — ${err instanceof Error ? err.message : 'check Supabase logs'}`)
    }
    setRegenerating(false)
  }

  const critical = raw.filter((r) => r.priority === 'critical' || r.category === 'error').length
  const avgConf = raw.length
    ? Math.round(raw.reduce((a, r) => a + (r.confidence ?? 0.8), 0) / raw.length * 100)
    : 0
  const totalAffected = raw.reduce((a, r) => a + (r.affected_users ?? 0), 0)

  const stats = [
    { label: 'Total insights', value: String(raw.length), tone: '' },
    { label: 'Critical', value: String(critical), tone: 'text-critical' },
    { label: 'Users affected', value: totalAffected > 0 ? String(totalAffected) : '—', tone: 'text-warning' },
    { label: 'Avg confidence', value: raw.length ? `${avgConf}%` : '—', tone: 'text-ai' },
  ]

  const filtered = filter === 'All'
    ? insights
    : insights.filter((i) => i.priority === filter)

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const sb = createClient()
    if (confirmMode === 'selected') {
      const ids = [...bulk.selected]
      await sb.from('ai_insights').delete().in('id', ids)
      setRaw((prev) => prev.filter((r) => !bulk.selected.has(r.id)))
      setInsights((prev) => prev.filter((i) => !bulk.selected.has(i.id)))
      bulk.clear()
    } else if (confirmMode === 'all') {
      await sb.from('ai_insights').delete().eq('project_id', app.id)
      setRaw([])
      setInsights([])
      bulk.clear()
    }
    setDeleting(false)
    setConfirmMode(null)
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        icon={<Sparkles className="h-5 w-5 text-ai" />}
        title="AI Insights"
        desc="Autonomous analysis of what is happening, why, who is affected and what to do next."
        actions={
          <AiButton
            onClick={handleRegenerate}
            busy={regenerating}
            idleLabel="Run AI Analysis"
            stages={[
              'Gathering insights data…',
              'AI agents analysing…',
              'Prioritising findings…',
              'Almost there…',
            ]}
            icon={<Sparkles className="h-4 w-4" />}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${s.tone || 'text-foreground'}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {!loading && raw.length > 0 && (
        <BulkActionsBar
          selectedCount={bulk.count}
          totalCount={raw.length}
          itemLabel="insight"
          onDeleteSelected={() => setConfirmMode('selected')}
          onClearAll={() => setConfirmMode('all')}
          onDeselectAll={bulk.clear}
        />
      )}

      <ConfirmDeleteDialog
        open={confirmMode !== null}
        loading={deleting}
        title={confirmMode === 'all' ? 'Delete all insights?' : `Delete ${bulk.count} insight${bulk.count === 1 ? '' : 's'}?`}
        description={
          confirmMode === 'all'
            ? `This permanently deletes all ${raw.length} AI insights for this project. This can't be undone.`
            : `This permanently deletes the selected insight(s). This can't be undone.`
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmMode(null)}
      />

      {/* Priority filter */}
      {raw.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'border-ai/40 bg-ai/10 text-ai'
                  : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'All' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'All' && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {raw.filter((r) => r.priority === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 && insights.length === 0 ? (
        <Card className="p-10 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">No insights yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Run AI Analysis" to analyse your live data with AI.
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No {filter} priority insights.</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((i) => (
            <div key={i.id} className="relative">
              <div className="absolute left-3 top-3 z-10">
                <RowCheckbox checked={bulk.isSelected(i.id)} onChange={() => bulk.toggle(i.id)} />
              </div>
              <InsightCard insight={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
