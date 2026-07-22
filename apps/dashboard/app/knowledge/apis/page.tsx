'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { ApiRegistry } from '@/lib/knowledge-types'
import { CRITICALITY_COLOR } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card } from '@/components/kit'
import { Network, Plus, X, Loader2, ChevronDown, ChevronUp, Clock, Shield } from 'lucide-react'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'GRAPHQL', 'GRPC'] as const
const METHOD_COLOR: Record<string, string> = {
  GET: '#4ade80', POST: '#51C9D3', PUT: '#fbbf24', PATCH: '#fb923c',
  DELETE: '#f87171', GRAPHQL: '#c084fc', GRPC: '#8ba0b4',
}

export default function ApisPage() {
  const { app } = useConnectedApp()
  const [apis, setApis] = useState<ApiRegistry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    endpoint: '', method: 'GET', purpose: '', owning_service: '',
    criticality: 'medium', expected_latency_ms: '', requires_auth: true, tags: '',
  })

  useEffect(() => {
    const sb = createClient()
    sb.from('api_registry')
      .select('*')
      .eq('project_id', app.id)
      .order('criticality')
      .then(({ data }) => { setApis((data ?? []) as ApiRegistry[]); setLoading(false) })
  }, [app.id])

  const handleSave = async () => {
    if (!form.endpoint.trim()) return
    setSaving(true)
    const sb = createClient()
    const { data } = await sb.from('api_registry').insert({
      project_id: app.id,
      tenant_id: app.tenantId,
      endpoint: form.endpoint,
      method: form.method,
      purpose: form.purpose || null,
      owning_service: form.owning_service || null,
      criticality: form.criticality,
      expected_latency_ms: form.expected_latency_ms ? parseInt(form.expected_latency_ms) : null,
      requires_auth: form.requires_auth,
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }).select().single()
    if (data) {
      setApis((prev) => [data as ApiRegistry, ...prev])
      setForm({ endpoint: '', method: 'GET', purpose: '', owning_service: '', criticality: 'medium', expected_latency_ms: '', requires_auth: true, tags: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const filtered = apis.filter((a) =>
    !search || a.endpoint.toLowerCase().includes(search.toLowerCase()) || (a.purpose ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">API Registry</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Every endpoint — purpose, latency, auth, and ownership</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add API'}
        </button>
      </div>

      {showForm && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Register API Endpoint</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Endpoint Path *</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.endpoint} onChange={(e) => setForm((p) => ({ ...p, endpoint: e.target.value }))} placeholder="/api/documents/upload" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Method</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Purpose</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} placeholder="Identity verification" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Owning Service</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.owning_service} onChange={(e) => setForm((p) => ({ ...p, owning_service: e.target.value }))} placeholder="Document Service" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Criticality</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.criticality} onChange={(e) => setForm((p) => ({ ...p, criticality: e.target.value }))}>
                {['critical', 'high', 'medium', 'low'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Expected Latency (ms)</label>
              <input type="number" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.expected_latency_ms} onChange={(e) => setForm((p) => ({ ...p, expected_latency_ms: e.target.value }))} placeholder="200" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requires_auth} onChange={(e) => setForm((p) => ({ ...p, requires_auth: e.target.checked }))} className="rounded" />
                <span className="text-sm">Requires auth</span>
              </label>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.endpoint.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Endpoint
          </button>
        </Card>
      )}

      <input
        className="w-full max-w-sm rounded-xl border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        placeholder="Search endpoints…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading APIs…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Network className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No API endpoints registered yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((api) => (
            <Card key={api.id} className="overflow-hidden">
              <button
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
                onClick={() => setExpandedId(expandedId === api.id ? null : api.id)}
              >
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black"
                  style={{ background: METHOD_COLOR[api.method] + '20', color: METHOD_COLOR[api.method] }}
                >
                  {api.method}
                </span>
                <span className="flex-1 truncate font-mono text-sm">{api.endpoint}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {api.requires_auth && <Shield className="h-3.5 w-3.5 text-muted-foreground/60" title="Auth required" />}
                  {api.expected_latency_ms && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />{api.expected_latency_ms}ms
                    </span>
                  )}
                  <span
                    className="hidden rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase sm:block"
                    style={{ color: CRITICALITY_COLOR[api.criticality], borderColor: CRITICALITY_COLOR[api.criticality] + '40', background: CRITICALITY_COLOR[api.criticality] + '12' }}
                  >
                    {api.criticality}
                  </span>
                  {expandedId === api.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {expandedId === api.id && (
                <div className="border-t bg-muted/20 px-5 py-4 grid gap-4 sm:grid-cols-2">
                  {api.purpose && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Purpose</p>
                      <p className="mt-1 text-sm">{api.purpose}</p>
                    </div>
                  )}
                  {api.owning_service && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Owning Service</p>
                      <p className="mt-1 text-sm">{api.owning_service}</p>
                    </div>
                  )}
                  {api.dependencies.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dependencies</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {api.dependencies.map((d) => <span key={d} className="rounded-full border px-2 py-0.5 text-xs">{d}</span>)}
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
