'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { ManualConnectPanel } from '@/components/connect/manual-connect-panel'
import { Sparkles, ArrowUp, Loader2, ChevronRight } from 'lucide-react'

type InProgressRun = { id: string; status: string }

// Ready-made prompts covering the most common stacks — click one to fill the
// box (and still edit it before sending), so the user isn't stuck staring at
// a blank "describe your app" textarea with no idea what a good answer
// looks like.
const EXAMPLE_PROMPTS = [
  { label: 'React + Node + Postgres, on GitHub', text: 'Connect my production React frontend, Node.js backend and PostgreSQL database hosted on GitHub.' },
  { label: 'Next.js full-stack, on GitHub', text: 'Connect my Next.js app (frontend and API routes together) with a PostgreSQL database, hosted on GitHub.' },
  { label: 'Vue + Python/FastAPI + MySQL', text: 'Connect my Vue frontend, Python FastAPI backend, and MySQL database, hosted on GitHub.' },
  { label: 'Frontend only, no backend/DB', text: 'Connect just my React frontend on GitHub — no backend or database to connect yet.' },
]

export default function ConnectPage() {
  const { app } = useConnectedApp()
  const router = useRouter()
  // app/setup/page.tsx links directly to /connect?tab=mcp|cli|prompt — those
  // deep links should land with the advanced disclosure already open, not
  // collapsed with the requested tab hidden inside it.
  const searchParams = useSearchParams()
  const openAdvanced = searchParams.get('tab') !== null
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inProgress, setInProgress] = useState<InProgressRun | null>(null)
  const [checkingRuns, setCheckingRuns] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    sb.from('onboarding_runs')
      .select('id, status')
      .eq('project_id', app.id)
      .in('status', ['running', 'awaiting_input'])
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setInProgress((data?.[0] as InProgressRun) ?? null)
        setCheckingRuns(false)
      })
  }, [app.id])

  async function submit() {
    const text = prompt.trim()
    if (!text || submitting || app.id === '__loading__') return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', projectId: app.id, prompt: text }),
      })
      const result = await res.json().catch(() => ({ ok: false, error: 'Invalid response' }))
      if (result.ok && result.run_id) {
        router.push(`/connect/${result.run_id}`)
      } else {
        setError(result.error ?? 'Something went wrong starting the connection.')
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-10">

      {/* In-progress banner */}
      {!checkingRuns && inProgress && (
        <Link
          href={`/connect/${inProgress.id}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-ai/30 bg-ai/8 px-5 py-4 hover:bg-ai/12"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ai" />
            <p className="text-sm font-semibold text-foreground">
              You have a connection in progress
              {inProgress.status === 'awaiting_input' && <span className="ml-2 font-normal text-muted-foreground">— needs your input</span>}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ai" />
        </Link>
      )}

      {/* Hero */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-ai" />
          <span className="text-xs font-semibold uppercase tracking-widest text-ai">PAAQ Intelligence</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Connect Application</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the example closest to your stack below (or write your own), then edit any details before sending.
          The agent will connect your Git repository, generate a <code className="text-[11px]">@paaq/sdk</code> integration PR, and verify monitoring.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setPrompt(ex.text)}
              className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-ai/40 hover:bg-ai/5 hover:text-foreground transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); submit() }}
          className="mt-3 rounded-2xl border border-border/70 bg-card p-4 focus-within:border-ai/40"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Click an example above, or describe your own stack — e.g. Connect my production React frontend, Node.js backend and PostgreSQL database hosted on GitHub"
            rows={4}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              The agent will ask follow-up questions if it needs anything else.
            </p>
            <button
              type="submit"
              disabled={!prompt.trim() || submitting || app.id === '__loading__'}
              className="flex items-center gap-1.5 rounded-lg bg-ai px-4 py-2 text-xs font-semibold text-ai-foreground disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
              {submitting ? 'Starting…' : 'Connect'}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-2 text-xs font-medium text-critical">{error}</p>
        )}
      </div>

      {/* Advanced / power-user path — preserved from the old /connect page */}
      <details className="group rounded-2xl border border-border/60" open={openAdvanced}>
        <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-foreground marker:content-none">
          <span className="inline-flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
            Advanced: connect manually via MCP or CLI instead
          </span>
        </summary>
        <div className="border-t border-border/60 px-5 py-6">
          <ManualConnectPanel />
        </div>
      </details>
    </div>
  )
}
