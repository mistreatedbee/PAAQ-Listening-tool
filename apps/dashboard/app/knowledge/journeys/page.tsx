'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { JourneyRegistry, JourneyStep } from '@/lib/knowledge-types'
import { CRITICALITY_COLOR } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card } from '@/components/kit'
import { Route, Plus, X, Loader2, ChevronDown, ChevronUp, CheckCircle, XCircle, ArrowDown } from 'lucide-react'

export default function JourneysPage() {
  const { app } = useConnectedApp()
  const [journeys, setJourneys] = useState<JourneyRegistry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', description: '', business_purpose: '', criticality: 'high',
    success_state: '', avg_duration_seconds: '',
  })
  const [steps, setSteps] = useState<{ screen: string; action: string; required: boolean }[]>([
    { screen: '', action: '', required: true },
  ])

  useEffect(() => {
    const sb = createClient()
    sb.from('journey_registry')
      .select('*')
      .eq('project_id', app.id)
      .order('criticality')
      .then(({ data }) => { setJourneys((data ?? []) as JourneyRegistry[]); setLoading(false) })
  }, [app.id])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const sb = createClient()
    const formattedSteps: JourneyStep[] = steps
      .filter((s) => s.screen.trim() || s.action.trim())
      .map((s, i) => ({ step: i + 1, screen: s.screen, action: s.action, required: s.required }))
    const { data } = await sb.from('journey_registry').insert({
      project_id: app.id,
      tenant_id: app.tenantId,
      name: form.name,
      description: form.description || null,
      business_purpose: form.business_purpose || null,
      criticality: form.criticality,
      steps: formattedSteps,
      success_state: form.success_state || null,
      avg_duration_seconds: form.avg_duration_seconds ? parseInt(form.avg_duration_seconds) : null,
    }).select().single()
    if (data) {
      setJourneys((prev) => [data as JourneyRegistry, ...prev])
      setForm({ name: '', description: '', business_purpose: '', criticality: 'high', success_state: '', avg_duration_seconds: '' })
      setSteps([{ screen: '', action: '', required: true }])
      setShowForm(false)
    }
    setSaving(false)
  }

  const updateStep = (i: number, field: string, value: string | boolean) =>
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Journey Registry</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Critical user flows — steps, success states, and expected durations</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Journey'}
        </button>
      </div>

      {showForm && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Register User Journey</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Journey Name *</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. User Registration" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Criticality</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.criticality} onChange={(e) => setForm((p) => ({ ...p, criticality: e.target.value }))}>
                {['critical', 'high', 'medium', 'low'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Business Purpose</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.business_purpose} onChange={(e) => setForm((p) => ({ ...p, business_purpose: e.target.value }))} placeholder="Convert visitor to verified user" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Success State</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.success_state} onChange={(e) => setForm((p) => ({ ...p, success_state: e.target.value }))} placeholder="User account created and verified" />
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Journey Steps</label>
              <button onClick={() => setSteps((p) => [...p, { screen: '', action: '', required: true }])}
                className="text-xs text-primary hover:underline">+ Add step</button>
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1.5rem_1fr_1fr_auto] items-center">
                  <span className="text-xs font-bold text-muted-foreground text-center">{i + 1}</span>
                  <input className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                    value={step.screen} onChange={(e) => updateStep(i, 'screen', e.target.value)} placeholder="Screen name" />
                  <input className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                    value={step.action} onChange={(e) => updateStep(i, 'action', e.target.value)} placeholder="User action" />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={step.required} onChange={(e) => updateStep(i, 'required', e.target.checked)} className="rounded" />
                      Req.
                    </label>
                    {steps.length > 1 && (
                      <button onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))} className="text-destructive hover:opacity-80">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Journey
          </button>
        </Card>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading journeys…</div>
      ) : journeys.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Route className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No journeys registered yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {journeys.map((j) => (
            <Card key={j.id} className="overflow-hidden">
              <button
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
                onClick={() => setExpandedId(expandedId === j.id ? null : j.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{j.name}</span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{ color: CRITICALITY_COLOR[j.criticality], borderColor: CRITICALITY_COLOR[j.criticality] + '40', background: CRITICALITY_COLOR[j.criticality] + '12' }}
                    >
                      {j.criticality}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{j.steps.length} steps{j.avg_duration_seconds ? ` · ~${Math.round(j.avg_duration_seconds / 60)}min avg` : ''}</p>
                </div>
                {expandedId === j.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {expandedId === j.id && (
                <div className="border-t bg-muted/20 px-5 py-5 space-y-4">
                  {j.business_purpose && (
                    <p className="text-sm text-muted-foreground">{j.business_purpose}</p>
                  )}
                  <div className="flex flex-col gap-2">
                    {j.steps.map((step, i) => (
                      <div key={i} className="flex flex-col items-start">
                        <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 w-full">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{step.step}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{step.screen}</p>
                            {step.action && <p className="text-xs text-muted-foreground">{step.action}</p>}
                          </div>
                          {!step.required && <span className="text-[10px] text-muted-foreground">optional</span>}
                        </div>
                        {i < j.steps.length - 1 && <ArrowDown className="mx-4 h-4 w-4 text-muted-foreground/40" />}
                      </div>
                    ))}
                  </div>
                  {j.success_state && (
                    <div className="flex items-center gap-2 rounded-xl border border-healthy/20 bg-healthy/5 px-4 py-3">
                      <CheckCircle className="h-4 w-4 text-healthy shrink-0" />
                      <p className="text-sm text-healthy">{j.success_state}</p>
                    </div>
                  )}
                  {(j.failure_states as string[]).length > 0 && (
                    <div className="space-y-1">
                      {(j.failure_states as string[]).map((fs, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl border border-critical/20 bg-critical/5 px-4 py-3">
                          <XCircle className="h-4 w-4 text-critical shrink-0" />
                          <p className="text-sm text-critical">{fs}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
