'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { FeatureRegistry } from '@/lib/knowledge-types'
import { CRITICALITY_COLOR } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card } from '@/components/kit'
import { Cpu, Plus, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

const CRITICALITY_OPTS = ['critical', 'high', 'medium', 'low'] as const
const STATUS_OPTS = ['active', 'in-development', 'deprecated', 'paused'] as const

function StatusDot({ status }: { status: string }) {
  const color = status === 'active' ? '#4ade80' : status === 'in-development' ? '#fbbf24' : '#8ba0b4'
  return <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
}

export default function FeaturesPage() {
  const { app } = useConnectedApp()
  const [features, setFeatures] = useState<FeatureRegistry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterCrit, setFilterCrit] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', description: '', business_purpose: '', criticality: 'high',
    status: 'active', owning_team: '', dependencies: '', tags: '',
  })

  useEffect(() => {
    const sb = createClient()
    sb.from('feature_registry')
      .select('*')
      .eq('project_id', app.id)
      .order('criticality', { ascending: true })
      .then(({ data }) => { setFeatures((data ?? []) as FeatureRegistry[]); setLoading(false) })
  }, [app.id])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const sb = createClient()
    const row = {
      project_id: app.id,
      tenant_id: app.tenantId,
      name: form.name,
      description: form.description || null,
      business_purpose: form.business_purpose || null,
      criticality: form.criticality,
      status: form.status,
      owning_team: form.owning_team || null,
      dependencies: form.dependencies ? form.dependencies.split(',').map((s) => s.trim()).filter(Boolean) : [],
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }
    const { data } = await sb.from('feature_registry').insert(row).select().single()
    if (data) {
      setFeatures((prev) => [data as FeatureRegistry, ...prev])
      setForm({ name: '', description: '', business_purpose: '', criticality: 'high', status: 'active', owning_team: '', dependencies: '', tags: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const filtered = features.filter((f) => filterCrit === 'all' || f.criticality === filterCrit)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Feature Registry</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Every product feature — purpose, criticality, and ownership</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Feature'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Register New Feature</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Feature Name *</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Document Upload" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Owning Team</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.owning_team} onChange={(e) => setForm((p) => ({ ...p, owning_team: e.target.value }))} placeholder="e.g. Mobile Engineering" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What does this feature do?" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Business Purpose</label>
            <textarea className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              rows={2} value={form.business_purpose} onChange={(e) => setForm((p) => ({ ...p, business_purpose: e.target.value }))} placeholder="Why does this feature exist for users/business?" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Criticality</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.criticality} onChange={(e) => setForm((p) => ({ ...p, criticality: e.target.value }))}>
                {CRITICALITY_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tags (comma-separated)</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="onboarding, payments" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dependencies (comma-separated)</label>
            <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={form.dependencies} onChange={(e) => setForm((p) => ({ ...p, dependencies: e.target.value }))} placeholder="Auth Service, Storage Service" />
          </div>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Feature
          </button>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...CRITICALITY_OPTS].map((c) => (
          <button
            key={c}
            onClick={() => setFilterCrit(c)}
            className="rounded-full border px-3 py-1 text-xs font-semibold transition-all"
            style={{
              background: filterCrit === c ? 'oklch(0.54 0.10 198 / 0.12)' : 'transparent',
              borderColor: filterCrit === c ? 'oklch(0.54 0.10 198 / 0.4)' : undefined,
              color: filterCrit === c ? 'var(--color-primary)' : undefined,
            }}
          >
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      {/* Feature list */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading features…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Cpu className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No features registered yet. Add your first above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <Card key={f.id} className="overflow-hidden">
              <button
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
                onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CRITICALITY_COLOR[f.criticality] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{f.name}</span>
                    <StatusDot status={f.status} />
                    <span className="text-xs text-muted-foreground">{f.status}</span>
                  </div>
                  {f.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{f.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-muted-foreground sm:block">{f.owning_team ?? '—'}</span>
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase"
                    style={{ color: CRITICALITY_COLOR[f.criticality], borderColor: CRITICALITY_COLOR[f.criticality] + '40', background: CRITICALITY_COLOR[f.criticality] + '12' }}
                  >
                    {f.criticality}
                  </span>
                  {expandedId === f.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {expandedId === f.id && (
                <div className="border-t bg-muted/20 px-5 py-4 grid gap-4 sm:grid-cols-2">
                  {f.business_purpose && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Business Purpose</p>
                      <p className="mt-1 text-sm">{f.business_purpose}</p>
                    </div>
                  )}
                  {f.dependencies.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dependencies</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.dependencies.map((d) => (
                          <span key={d} className="rounded-full border bg-background px-2.5 py-0.5 text-xs">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {f.tags.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.tags.map((t) => (
                          <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{t}</span>
                        ))}
                      </div>
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
