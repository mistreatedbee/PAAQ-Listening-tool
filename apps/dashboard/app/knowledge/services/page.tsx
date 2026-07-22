'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { ServiceRegistry } from '@/lib/knowledge-types'
import { CRITICALITY_COLOR } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card } from '@/components/kit'
import { Server, Plus, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  healthy: '#4ade80', degraded: '#fbbf24', down: '#f87171', unknown: '#8ba0b4',
}

export default function ServicesPage() {
  const { app } = useConnectedApp()
  const [services, setServices] = useState<ServiceRegistry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', description: '', service_type: 'internal', owner: '',
    criticality: 'high', database: '', health_endpoint: '', status: 'healthy', dependencies: '', tags: '',
  })

  useEffect(() => {
    const sb = createClient()
    sb.from('service_registry')
      .select('*')
      .eq('project_id', app.id)
      .order('criticality')
      .then(({ data }) => { setServices((data ?? []) as ServiceRegistry[]); setLoading(false) })
  }, [app.id])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const sb = createClient()
    const { data } = await sb.from('service_registry').insert({
      project_id: app.id,
      tenant_id: app.tenantId,
      name: form.name,
      description: form.description || null,
      service_type: form.service_type,
      owner: form.owner || null,
      criticality: form.criticality,
      database: form.database || null,
      health_endpoint: form.health_endpoint || null,
      status: form.status,
      dependencies: form.dependencies ? form.dependencies.split(',').map((s) => s.trim()).filter(Boolean) : [],
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }).select().single()
    if (data) {
      setServices((prev) => [data as ServiceRegistry, ...prev])
      setForm({ name: '', description: '', service_type: 'internal', owner: '', criticality: 'high', database: '', health_endpoint: '', status: 'healthy', dependencies: '', tags: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Service Registry</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Backend services — ownership, dependencies, and health</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {showForm && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Register Service</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Service Name *</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Authentication Service" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Owner</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} placeholder="Team or person" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none resize-none"
              rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What does this service do?" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.service_type} onChange={(e) => setForm((p) => ({ ...p, service_type: e.target.value }))}>
                <option value="internal">Internal</option>
                <option value="external">External</option>
                <option value="third-party">Third-party</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Criticality</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.criticality} onChange={(e) => setForm((p) => ({ ...p, criticality: e.target.value }))}>
                {['critical', 'high', 'medium', 'low'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="healthy">Healthy</option>
                <option value="degraded">Degraded</option>
                <option value="down">Down</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Database</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.database} onChange={(e) => setForm((p) => ({ ...p, database: e.target.value }))} placeholder="PostgreSQL, Redis…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Health Endpoint</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none"
                value={form.health_endpoint} onChange={(e) => setForm((p) => ({ ...p, health_endpoint: e.target.value }))} placeholder="/health" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dependencies (comma-separated)</label>
            <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={form.dependencies} onChange={(e) => setForm((p) => ({ ...p, dependencies: e.target.value }))} placeholder="Database, Auth Service" />
          </div>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Service
          </button>
        </Card>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading services…</div>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Server className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No services registered yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <button className="flex w-full items-center gap-3 px-5 py-4 text-left" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[s.status] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.service_type} · {s.owner ?? 'No owner'}</p>
                </div>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ color: CRITICALITY_COLOR[s.criticality], borderColor: CRITICALITY_COLOR[s.criticality] + '40', background: CRITICALITY_COLOR[s.criticality] + '12' }}>
                  {s.criticality}
                </span>
                {expandedId === s.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {expandedId === s.id && (
                <div className="border-t bg-muted/20 px-5 py-4 space-y-3">
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    {s.database && <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Database</p><p className="mt-0.5">{s.database}</p></div>}
                    {s.health_endpoint && <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Health Check</p><p className="mt-0.5 font-mono text-xs">{s.health_endpoint}</p></div>}
                  </div>
                  {s.dependencies.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Dependencies</p>
                      <div className="flex flex-wrap gap-1">{s.dependencies.map((d) => <span key={d} className="rounded-full border px-2 py-0.5 text-xs">{d}</span>)}</div>
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
