'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { DeploymentRegistry } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card } from '@/components/kit'
import { Rocket, Plus, X, Loader2, ChevronDown, ChevronUp, GitCommit, Tag } from 'lucide-react'

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  success:     { bg: 'rgba(74,222,128,0.10)',  color: '#4ade80',  label: 'Success' },
  failed:      { bg: 'rgba(248,113,113,0.10)', color: '#f87171',  label: 'Failed' },
  'rolled-back': { bg: 'rgba(251,191,36,0.10)', color: '#fbbf24', label: 'Rolled back' },
  'in-progress': { bg: 'rgba(81,201,211,0.10)', color: '#51C9D3', label: 'In progress' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function DeploymentsKnowledgePage() {
  const { app } = useConnectedApp()
  const [deployments, setDeployments] = useState<DeploymentRegistry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [envFilter, setEnvFilter] = useState('all')

  const [form, setForm] = useState({
    version: '', environment: 'production', deployed_by: '',
    release_notes: '', git_commit: '', git_tag: '', build_number: '',
    changed_features: '', changed_services: '', status: 'success',
  })

  useEffect(() => {
    const sb = createClient()
    sb.from('deployment_registry')
      .select('*')
      .eq('project_id', app.id)
      .order('deployed_at', { ascending: false })
      .then(({ data }) => { setDeployments((data ?? []) as DeploymentRegistry[]); setLoading(false) })
  }, [app.id])

  const handleSave = async () => {
    if (!form.version.trim()) return
    setSaving(true)
    const sb = createClient()
    const { data } = await sb.from('deployment_registry').insert({
      project_id: app.id,
      tenant_id: app.tenantId,
      version: form.version,
      environment: form.environment,
      deployed_by: form.deployed_by || null,
      release_notes: form.release_notes || null,
      git_commit: form.git_commit || null,
      git_tag: form.git_tag || null,
      build_number: form.build_number || null,
      status: form.status,
      changed_features: form.changed_features ? form.changed_features.split(',').map((s) => s.trim()).filter(Boolean) : [],
      changed_services: form.changed_services ? form.changed_services.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }).select().single()
    if (data) {
      setDeployments((prev) => [data as DeploymentRegistry, ...prev])
      setForm({ version: '', environment: 'production', deployed_by: '', release_notes: '', git_commit: '', git_tag: '', build_number: '', changed_features: '', changed_services: '', status: 'success' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const envs = ['all', ...Array.from(new Set(deployments.map((d) => d.environment)))]
  const filtered = deployments.filter((d) => envFilter === 'all' || d.environment === envFilter)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Deployment History</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Every release — versions, changelogs, and git references</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Log Deployment'}
        </button>
      </div>

      {showForm && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Log Deployment</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Version *</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.version} onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} placeholder="v2.4.1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Environment</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.environment} onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value }))}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="rolled-back">Rolled back</option>
                <option value="in-progress">In progress</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Deployed by</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.deployed_by} onChange={(e) => setForm((p) => ({ ...p, deployed_by: e.target.value }))} placeholder="CI/CD or name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Git Commit (short)</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none"
                value={form.git_commit} onChange={(e) => setForm((p) => ({ ...p, git_commit: e.target.value }))} placeholder="a1b2c3d" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Git Tag</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none"
                value={form.git_tag} onChange={(e) => setForm((p) => ({ ...p, git_tag: e.target.value }))} placeholder="v2.4.1" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Release Notes</label>
            <textarea className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none resize-none"
              rows={3} value={form.release_notes} onChange={(e) => setForm((p) => ({ ...p, release_notes: e.target.value }))} placeholder="What changed in this release?" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Changed Features (comma-separated)</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.changed_features} onChange={(e) => setForm((p) => ({ ...p, changed_features: e.target.value }))} placeholder="Document Upload, Payments" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Changed Services (comma-separated)</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.changed_services} onChange={(e) => setForm((p) => ({ ...p, changed_services: e.target.value }))} placeholder="Auth Service, Storage" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.version.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Save Deployment
          </button>
        </Card>
      )}

      {/* Env filter */}
      <div className="flex gap-2 flex-wrap">
        {envs.map((e) => (
          <button key={e} onClick={() => setEnvFilter(e)}
            className="rounded-full border px-3 py-1 text-xs font-semibold transition-all capitalize"
            style={{ background: envFilter === e ? 'oklch(0.54 0.10 198 / 0.12)' : 'transparent', borderColor: envFilter === e ? 'oklch(0.54 0.10 198 / 0.4)' : undefined, color: envFilter === e ? 'var(--color-primary)' : undefined }}>
            {e}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading deployments…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No deployments logged yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => {
            const st = STATUS_STYLES[d.status] ?? STATUS_STYLES.success
            return (
              <Card key={d.id} className="overflow-hidden">
                <button className="flex w-full items-center gap-3 px-5 py-4 text-left" onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                  <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-black font-mono" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono">{d.version}</span>
                      <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] capitalize">{d.environment}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{fmt(d.deployed_at)}{d.deployed_by ? ` · ${d.deployed_by}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.git_commit && <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><GitCommit className="h-3 w-3" />{d.git_commit.slice(0, 7)}</span>}
                    {d.git_tag && <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Tag className="h-3 w-3" />{d.git_tag}</span>}
                    {expandedId === d.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {expandedId === d.id && (
                  <div className="border-t bg-muted/20 px-5 py-4 space-y-3">
                    {d.release_notes && <p className="text-sm whitespace-pre-wrap">{d.release_notes}</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {d.changed_features.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Changed Features</p>
                          <div className="flex flex-wrap gap-1">{d.changed_features.map((f) => <span key={f} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{f}</span>)}</div>
                        </div>
                      )}
                      {d.changed_services.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Changed Services</p>
                          <div className="flex flex-wrap gap-1">{d.changed_services.map((s) => <span key={s} className="rounded-full border px-2 py-0.5 text-xs">{s}</span>)}</div>
                        </div>
                      )}
                    </div>
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
