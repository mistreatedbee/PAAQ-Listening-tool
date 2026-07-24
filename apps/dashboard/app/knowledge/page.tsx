'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { BookOpen, Cpu, Network, Route, Server, Rocket, FileText, BrainCircuit, ArrowRight, Plus, Sparkles, Search } from 'lucide-react'
import { Card, CardHead } from '@/components/kit'
import { useConnectedApp } from '@/components/shell/connected-app-context'

type Counts = {
  features: number
  screens: number
  apis: number
  journeys: number
  services: number
  deployments: number
  docs: number
}

const SECTIONS = [
  { label: 'Features',         href: '/knowledge/features',    icon: Cpu,      key: 'features',    desc: 'Product features and capabilities' },
  { label: 'APIs',             href: '/knowledge/apis',         icon: Network,  key: 'apis',        desc: 'Endpoints and service interfaces' },
  { label: 'User Journeys',    href: '/knowledge/journeys',     icon: Route,    key: 'journeys',    desc: 'Critical user flows and paths' },
  { label: 'Services',         href: '/knowledge/services',     icon: Server,   key: 'services',    desc: 'Backend services and dependencies' },
  { label: 'Deployments',      href: '/knowledge/deployments',  icon: Rocket,   key: 'deployments', desc: 'Release history and changelogs' },
  { label: 'Docs & Specs',     href: '/knowledge/docs',         icon: FileText, key: 'docs',        desc: 'Documentation and API specs' },
  { label: 'Knowledge Graph',  href: '/knowledge/graph',        icon: BrainCircuit, key: null,      desc: 'Visual dependency map' },
]

export default function KnowledgePage() {
  const { app } = useConnectedApp()
  const [counts, setCounts] = useState<Counts | null>(null)
  const [query, setQuery] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const sb = createClient()
    const pid = app.id
    Promise.all([
      sb.from('feature_registry').select('*', { count: 'exact', head: true }).eq('project_id', pid),
      sb.from('screen_registry').select('*', { count: 'exact', head: true }).eq('project_id', pid),
      sb.from('api_registry').select('*', { count: 'exact', head: true }).eq('project_id', pid),
      sb.from('journey_registry').select('*', { count: 'exact', head: true }).eq('project_id', pid),
      sb.from('service_registry').select('*', { count: 'exact', head: true }).eq('project_id', pid),
      sb.from('deployment_registry').select('*', { count: 'exact', head: true }).eq('project_id', pid),
      sb.from('knowledge_documents').select('*', { count: 'exact', head: true }).eq('project_id', pid),
    ]).then(([{ count: f }, { count: sc }, { count: a }, { count: j }, { count: sv }, { count: d }, { count: dc }]) => {
      setCounts({ features: f ?? 0, screens: sc ?? 0, apis: a ?? 0, journeys: j ?? 0, services: sv ?? 0, deployments: d ?? 0, docs: dc ?? 0 })
    })
  }, [app.id])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setAiAnswer(null)
    try {
      const sb = createClient()
      const { data } = await sb.functions.invoke('knowledge-query', {
        body: { query, projectId: app.id },
      })
      setAiAnswer(data?.answer ?? 'No answer available.')
    } catch {
      setAiAnswer('Could not reach the knowledge AI. Make sure the edge function is deployed.')
    } finally {
      setSearching(false)
    }
  }

  const totalRegistered = counts
    ? counts.features + counts.apis + counts.journeys + counts.services + counts.docs
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-ai" />
            <h1 className="text-xl font-bold">Application Knowledge</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            The AI's understanding of <span className="font-semibold text-foreground">{app.name}</span> — architecture, features, APIs, and more.
          </p>
        </div>
        <Link href="/knowledge/import" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Import Knowledge
        </Link>
      </div>

      {/* AI Search */}
      <Card className="border-ai/20 bg-ai/5">
        <CardHead
          title="Knowledge Search"
          desc="Ask any question about your application's architecture, features, or APIs"
          icon={<Sparkles className="h-4 w-4 text-ai" />}
        />
        <form onSubmit={handleSearch} className="flex gap-3 px-5 pb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="How does registration work? Which service owns document upload?"
              className="w-full rounded-xl border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ai/40"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="flex items-center gap-2 rounded-xl bg-ai px-4 py-2.5 text-sm font-semibold text-ai-foreground disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            {searching ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ai-foreground border-t-transparent" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Ask AI
          </button>
        </form>
        {aiAnswer && (
          <div className="mx-5 mb-5 rounded-xl border border-ai/20 bg-background p-4">
            <p className="text-xs font-semibold text-ai mb-2">AI Answer</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
          </div>
        )}
      </Card>

      {/* Status banner if empty */}
      {counts && totalRegistered === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <BrainCircuit className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-sm font-semibold">No knowledge imported yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Import your architecture, APIs, and documentation so the AI can understand your application.
          </p>
          <Link href="/knowledge/import" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Start Knowledge Import
          </Link>
        </div>
      )}

      {/* Registry cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const count = s.key ? (counts?.[s.key as keyof Counts] ?? 0) : null
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
              </div>
              {count !== null && (
                <p className="mt-3 text-2xl font-black tabular-nums text-foreground/90">
                  {count}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">registered</span>
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
