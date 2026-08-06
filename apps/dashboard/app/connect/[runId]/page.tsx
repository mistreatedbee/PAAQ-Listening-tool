'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { StepTimeline } from '@/components/onboarding/step-timeline'
import { OnboardChatPanel } from '@/components/onboarding/onboard-chat-panel'
import { Loader2, Sparkles, XCircle, X } from 'lucide-react'

type RunStatus = 'running' | 'awaiting_input' | 'succeeded' | 'failed' | 'cancelled'

type RunRow = {
  id: string
  project_id: string | null
  status: RunStatus
  error: string | null
  prompt: string
}

export default function OnboardRunPage() {
  const params = useParams<{ runId: string }>()
  const router = useRouter()
  const runId = params.runId

  const [run, setRun] = useState<RunRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    let cancelled = false
    const sb = createClient()

    async function load() {
      const { data } = await sb
        .from('onboarding_runs')
        .select('id, project_id, status, error, prompt')
        .eq('id', runId)
        .maybeSingle()
      if (!cancelled) {
        setRun(data as RunRow | null)
        setLoading(false)
      }
    }

    load()

    const channel = sb
      .channel(`onboarding-run:${runId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onboarding_runs', filter: `id=eq.${runId}` }, () => { if (!cancelled) load() })
      .subscribe()

    const timer = setInterval(() => { if (!cancelled) load() }, 5_000)

    return () => {
      cancelled = true
      clearInterval(timer)
      sb.removeChannel(channel)
    }
  }, [runId])

  // Auto-redirect to the app's management page a couple seconds after
  // succeeding, so the user sees the "All connected!" state before leaving.
  useEffect(() => {
    if (run?.status === 'succeeded' && run.project_id) {
      const t = setTimeout(() => router.push(`/apps/${run.project_id}`), 2000)
      return () => clearTimeout(t)
    }
  }, [run?.status, run?.project_id, router])

  async function cancelRun() {
    if (cancelling) return
    setCancelling(true)
    try {
      await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', runId }),
      })
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="max-w-lg space-y-3">
        <p className="text-sm font-semibold text-foreground">Run not found</p>
        <p className="text-sm text-muted-foreground">This onboarding run doesn't exist or you don't have access to it.</p>
        <Link href="/connect" className="text-sm font-medium text-ai hover:underline">← Back to Connect</Link>
      </div>
    )
  }

  const canCancel = run.status === 'running' || run.status === 'awaiting_input'

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-ai" />
            <span className="text-xs font-semibold uppercase tracking-widest text-ai">PAAQ Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Connecting your application</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground line-clamp-2">"{run.prompt}"</p>
        </div>
        {canCancel && (
          <button
            onClick={cancelRun}
            disabled={cancelling}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-critical/40 hover:text-critical disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        )}
      </div>

      {run.status === 'failed' && (
        <div className="flex items-start gap-3 rounded-xl border border-critical/30 bg-critical/8 px-4 py-3">
          <XCircle className="h-4 w-4 text-critical shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-critical">Onboarding failed</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{run.error ?? 'An unknown error occurred.'}</p>
            <Link href="/connect" className="mt-2 inline-block text-xs font-semibold text-ai hover:underline">Try again →</Link>
          </div>
        </div>
      )}

      {/* Two-column layout: timeline + chat */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Progress</p>
          <StepTimeline runId={runId} />
        </div>

        <div className="h-[560px] lg:h-auto">
          <OnboardChatPanel runId={runId} projectId={run.project_id ?? ''} status={run.status} />
        </div>
      </div>
    </div>
  )
}
