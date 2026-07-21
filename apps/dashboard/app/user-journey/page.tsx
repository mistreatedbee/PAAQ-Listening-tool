'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { Route, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'

type Journey = {
  id: string
  session_id: string
  journey_name: string
  steps: Array<{ step: number; screen: string }>
  completed: boolean
  drop_off_step: string | null
  drop_off_reason: string | null
  ai_analysis: string | null
  created_at: string
}

export default function UserJourneyPage() {
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [selected, setSelected] = useState<Journey | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchJourneys = async () => {
    const sb = createClient()
    const { data } = await sb.from('user_journeys').select('*').order('created_at', { ascending: false }).limit(50)
    const rows = (data ?? []) as Journey[]
    setJourneys(rows)
    if (rows.length > 0 && !selected) setSelected(rows[0])
    setLoading(false)
  }

  useEffect(() => { fetchJourneys() }, [])

  const runAnalysis = async () => {
    setAnalysing(true)
    showToast('Reconstructing user journeys with AI…')
    const sb = createClient()
    const { data, error } = await sb.functions.invoke('analyze')
    if (error) {
      showToast('Analysis failed — check ANTHROPIC_API_KEY is set in Supabase')
    } else {
      await fetchJourneys()
      showToast(`Analysis complete — ${data?.journeys ?? 0} journeys reconstructed`)
    }
    setAnalysing(false)
  }

  // Group by journey_name for stats
  const journeyGroups = journeys.reduce<Record<string, Journey[]>>((acc, j) => {
    const key = j.journey_name ?? 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(j)
    return acc
  }, {})

  const completionRate = journeys.length > 0
    ? Math.round((journeys.filter((j) => j.completed).length / journeys.length) * 100)
    : 0

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        icon={<Route className="h-5 w-5" />}
        title="User Journey Explorer"
        desc="Automatically reconstructed session paths. AI detects friction, failures and abandonment points."
        actions={
          <button
            onClick={runAnalysis}
            disabled={analysing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${analysing ? 'animate-spin' : ''}`} />
            {analysing ? 'Analysing…' : 'Run AI Analysis'}
          </button>
        }
      />

      {journeys.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Sessions analysed', value: journeys.length },
            { label: 'Completion rate', value: `${completionRate}%` },
            { label: 'Unique journeys', value: Object.keys(journeyGroups).length },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1.5 text-2xl font-semibold text-foreground">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : journeys.length === 0 ? (
        <Card className="p-10 text-center">
          <Route className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">No journey data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Send events with screen names via the PAAQ SDK, then click "Run AI Analysis" to reconstruct journeys.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Journey list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">Sessions</p>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto scrollbar-thin">
              {journeys.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelected(j)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selected?.id === j.id
                      ? 'border-ai/40 bg-ai/[0.06]'
                      : 'border-border/60 bg-card/60 hover:bg-accent/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {j.completed
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-healthy" />
                      : <XCircle className="h-3.5 w-3.5 shrink-0 text-critical" />}
                    <span className="truncate text-xs font-medium text-foreground">{j.journey_name}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {j.steps?.length ?? 0} steps · {j.completed ? 'Completed' : `Dropped at ${j.drop_off_step ?? 'unknown'}`}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Journey detail */}
          {selected && (
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHead
                  title={selected.journey_name ?? 'Journey'}
                  desc={selected.completed ? 'Completed successfully' : `Dropped off at: ${selected.drop_off_step ?? 'unknown'}`}
                />
                <div className="px-5 pb-5">
                  {/* Funnel visualization */}
                  <div className="space-y-2">
                    {(selected.steps ?? []).map((step, i) => {
                      const totalSteps = selected.steps?.length ?? 1
                      const width = Math.max(30, 100 - (i / totalSteps) * 50)
                      const isDropOff = step.screen === selected.drop_off_step && !selected.completed
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-5 shrink-0 text-[10px] font-mono text-muted-foreground text-right">{step.step}</span>
                          <div className="flex-1">
                            <div
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                isDropOff
                                  ? 'bg-critical/10 border border-critical/30 text-critical'
                                  : i === 0
                                  ? 'bg-ai/10 border border-ai/20 text-foreground'
                                  : 'bg-card/80 border border-border/50 text-foreground'
                              }`}
                              style={{ width: `${width}%`, minWidth: '40%' }}
                            >
                              {isDropOff && <XCircle className="h-3.5 w-3.5 shrink-0" />}
                              {step.screen}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {!selected.completed && selected.drop_off_reason && (
                    <div className="mt-4 rounded-lg border border-warning/30 bg-warning/[0.06] p-3">
                      <p className="text-xs font-semibold text-warning">Drop-off reason</p>
                      <p className="mt-1 text-sm text-foreground">{selected.drop_off_reason}</p>
                    </div>
                  )}

                  {selected.ai_analysis && (
                    <div className="mt-4 rounded-lg border border-ai/20 bg-ai/[0.04] p-3">
                      <p className="text-xs font-semibold text-ai">AI Analysis</p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">{selected.ai_analysis}</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'Steps', value: selected.steps?.length ?? 0 },
                    { label: 'Status', value: selected.completed ? 'Completed' : 'Abandoned' },
                    { label: 'Drop-off', value: selected.drop_off_step ?? '—' },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">{s.label}</span>
                      <span className="text-sm font-semibold text-foreground">{s.value}</span>
                    </div>
                  ))}
                  <ToneBadge tone={selected.completed ? 'healthy' : 'critical'} className="self-end ml-auto">
                    {selected.completed ? 'Completed' : 'Abandoned'}
                  </ToneBadge>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
