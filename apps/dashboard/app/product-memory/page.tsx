'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { BrainCircuit, Search, Clock, Tag } from 'lucide-react'
import type { Tone } from '@/lib/data'

type DbMemory = {
  id: string
  type: string
  title: string
  summary: string | null
  tags: string[] | null
  created_at: string
}

function typeTone(t: string): Tone {
  if (t === 'incident') return 'critical'
  if (t === 'fix') return 'healthy'
  if (t === 'decision') return 'intel'
  if (t === 'outcome') return 'healthy'
  if (t === 'insight') return 'warning'
  return 'intel'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

const TYPE_FILTERS = ['All', 'incident', 'fix', 'decision', 'insight', 'outcome', 'report']

export default function ProductMemoryPage() {
  const [memories, setMemories] = useState<DbMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')

  useEffect(() => {
    const sb = createClient()
    sb.from('product_memory')
      .select('id, type, title, summary, tags, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setMemories((data ?? []) as DbMemory[])
        setLoading(false)
      })
  }, [])

  const filtered = memories.filter((m) => {
    const matchesType = typeFilter === 'All' || m.type === typeFilter
    const q = search.toLowerCase()
    const matchesSearch = !q
      || m.title.toLowerCase().includes(q)
      || (m.summary ?? '').toLowerCase().includes(q)
      || (m.tags ?? []).some((t) => t.toLowerCase().includes(q))
    return matchesType && matchesSearch
  })

  const totalByType: Record<string, number> = {}
  for (const m of memories) {
    totalByType[m.type] = (totalByType[m.type] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BrainCircuit className="h-5 w-5 text-ai" />}
        title="Product Memory"
        desc="A living knowledge store of investigations, fixes, and decisions — automatically built from every AI operation."
        actions={
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memory…"
              className="w-full rounded-lg border border-border/70 bg-card/60 py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ai/40"
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Total entries', v: String(memories.length), t: 'text-foreground' },
          { l: 'Incidents', v: String(totalByType['incident'] ?? 0), t: 'text-critical' },
          { l: 'Fixes recorded', v: String(totalByType['fix'] ?? 0), t: 'text-healthy' },
          { l: 'Decisions', v: String(totalByType['decision'] ?? 0), t: 'text-intel' },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.l}</p>
            <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight', s.t)}>{s.v}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((f) => {
          const count = f === 'All' ? memories.length : (totalByType[f] ?? 0)
          return (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === f
                  ? 'border-ai/40 bg-ai/10 text-ai'
                  : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'All' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <BrainCircuit className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">
            {memories.length === 0 ? 'No memory entries yet' : 'No results for your search'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {memories.length === 0
              ? 'Memory is built automatically every time an investigation runs.'
              : 'Try different search terms or filters.'}
          </p>
        </Card>
      ) : (
        <div className="relative border-l border-border/60 pl-6 space-y-0">
          {filtered.map((entry, i) => {
            const tone = typeTone(entry.type)
            const isLast = i === filtered.length - 1
            return (
              <div key={entry.id} className={cn('relative pb-6', isLast && 'pb-0')}>
                <span className={cn(
                  'absolute -left-[25px] top-1 h-3 w-3 rounded-full ring-4 ring-background',
                  tone === 'critical' ? 'bg-critical' :
                  tone === 'healthy' ? 'bg-healthy' :
                  tone === 'warning' ? 'bg-warning' :
                  'bg-intel/60',
                )} />

                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ToneBadge tone={tone}>{entry.type}</ToneBadge>
                      {entry.tags && entry.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          <Tag className="h-2.5 w-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />{timeAgo(entry.created_at)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-foreground">{entry.title}</p>

                  {entry.summary && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.summary}</p>
                  )}
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
