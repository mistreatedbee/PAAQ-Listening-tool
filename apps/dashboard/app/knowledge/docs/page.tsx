'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { KnowledgeDocument } from '@/lib/knowledge-types'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card } from '@/components/kit'
import { FileSearch, Plus, X, Loader2, ChevronDown, ChevronUp, Sparkles, FileText } from 'lucide-react'

const DOC_TYPES = ['documentation', 'api-spec', 'architecture', 'release-notes', 'faq', 'runbook', 'adr'] as const
const DOC_FORMATS = ['markdown', 'openapi', 'graphql', 'plaintext'] as const

const TYPE_COLOR: Record<string, string> = {
  documentation: '#51C9D3', 'api-spec': '#27A6CE', architecture: '#4ade80',
  'release-notes': '#fbbf24', faq: '#fb923c', runbook: '#f87171', adr: '#c084fc',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export default function DocsPage() {
  const { app } = useConnectedApp()
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    title: '', doc_type: 'documentation', content_format: 'markdown',
    content: '', source: '', tags: '',
  })

  useEffect(() => {
    const sb = createClient()
    sb.from('knowledge_documents')
      .select('id, title, doc_type, content_format, source, tags, ai_summary, ai_processed, created_at, updated_at, tenant_id, project_id')
      .eq('project_id', app.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setDocs((data ?? []) as KnowledgeDocument[]); setLoading(false) })
  }, [app.id])

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    const sb = createClient()
    const { data } = await sb.from('knowledge_documents').insert({
      project_id: app.id,
      tenant_id: app.tenantId,
      title: form.title,
      doc_type: form.doc_type,
      content_format: form.content_format,
      content: form.content,
      source: form.source || null,
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }).select().single()
    if (data) {
      setDocs((prev) => [data as KnowledgeDocument, ...prev])
      setForm({ title: '', doc_type: 'documentation', content_format: 'markdown', content: '', source: '', tags: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const filtered = docs
    .filter((d) => typeFilter === 'all' || d.doc_type === typeFilter)
    .filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Docs & Specs</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Documentation, API specs, architecture diagrams, ADRs, and runbooks</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Document'}
        </button>
      </div>

      {showForm && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Import Document</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Authentication Flow Documentation" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.doc_type} onChange={(e) => setForm((p) => ({ ...p, doc_type: e.target.value }))}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Format</label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.content_format} onChange={(e) => setForm((p) => ({ ...p, content_format: e.target.value }))}>
                {DOC_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Source URL / Path</label>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} placeholder="https://... or /docs/auth.md" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Content *</label>
            <textarea className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none resize-none"
              rows={8} value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} placeholder="Paste documentation, OpenAPI spec, or any text content here…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tags (comma-separated)</label>
            <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="auth, onboarding, payments" />
          </div>
          <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Document
          </button>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          className="w-full max-w-xs rounded-xl border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {['all', ...DOC_TYPES].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition-all capitalize"
              style={{ background: typeFilter === t ? (TYPE_COLOR[t] ?? 'oklch(0.54 0.10 198)') + '18' : 'transparent', borderColor: typeFilter === t ? (TYPE_COLOR[t] ?? 'oklch(0.54 0.10 198)') + '50' : undefined, color: typeFilter === t ? (TYPE_COLOR[t] ?? '#51C9D3') : undefined }}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading documents…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <FileSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No documents imported yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <button className="flex w-full items-center gap-3 px-5 py-4 text-left" onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}>
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{doc.title}</span>
                    {doc.ai_processed && <Sparkles className="h-3.5 w-3.5 text-ai" aria-label="AI processed" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-semibold rounded px-1.5 py-0.5"
                      style={{ background: (TYPE_COLOR[doc.doc_type] ?? '#51C9D3') + '15', color: TYPE_COLOR[doc.doc_type] ?? '#51C9D3' }}>
                      {doc.doc_type}
                    </span>
                    <span className="text-xs text-muted-foreground">{doc.content_format} · {fmtDate(doc.created_at)}</span>
                  </div>
                </div>
                {expandedId === doc.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {expandedId === doc.id && (
                <div className="border-t bg-muted/20 px-5 py-4 space-y-3">
                  {doc.ai_summary && (
                    <div className="rounded-xl border border-ai/20 bg-ai/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ai mb-1.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI Summary
                      </p>
                      <p className="text-sm text-foreground">{doc.ai_summary}</p>
                    </div>
                  )}
                  {doc.source && (
                    <p className="text-xs text-muted-foreground">Source: <span className="font-mono">{doc.source}</span></p>
                  )}
                  {doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map((t) => <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t}</span>)}
                    </div>
                  )}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View raw content</summary>
                    <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{doc.content}</pre>
                  </details>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
