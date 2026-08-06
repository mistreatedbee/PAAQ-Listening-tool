'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Circle, Loader2, MinusCircle } from 'lucide-react'

// The 10 onboarding steps, in their fixed order — see
// apps/api/supabase/migrations/035_onboarding_runs.sql for the source of
// truth. step_key isn't DB-constrained (expected to evolve), so this is
// used only to pick a stable display order/label; any unrecognised
// step_key coming back from the DB is still rendered, just appended at
// the end in whatever order it arrived.
const STEP_ORDER = [
  'connect_repository',
  'understand_project',
  'generate_sdk',
  'configure_connections',
  'verify_backend',
  'verify_frontend',
  'verify_database',
  'start_learning',
  'activate_monitoring',
  'remove_setup_page',
]

function titleCase(stepKey: string) {
  return stepKey.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

type StepRow = {
  id: string
  run_id: string
  step_key: string
  step_order: number
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  detail: string | null
}

function StatusIcon({ status }: { status: StepRow['status'] }) {
  switch (status) {
    case 'done':    return <CheckCircle2 className="h-4 w-4 text-healthy" />
    case 'running': return <Loader2 className="h-4 w-4 animate-spin text-ai" />
    case 'failed':  return <XCircle className="h-4 w-4 text-critical" />
    case 'skipped': return <MinusCircle className="h-4 w-4 text-muted-foreground/50" />
    default:        return <Circle className="h-4 w-4 text-muted-foreground/30" />
  }
}

export function StepTimeline({ runId }: { runId: string }) {
  const [steps, setSteps] = useState<StepRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const sb = createClient()

    async function load() {
      const { data } = await sb
        .from('onboarding_run_steps')
        .select('id, run_id, step_key, step_order, status, detail')
        .eq('run_id', runId)
        .order('step_order', { ascending: true })
      if (!cancelled) {
        setSteps((data ?? []) as StepRow[])
        setLoading(false)
      }
    }

    load()

    const channel = sb
      .channel(`onboarding-steps:${runId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onboarding_run_steps', filter: `run_id=eq.${runId}` }, () => { if (!cancelled) load() })
      .subscribe()

    // 5s polling fallback in case Realtime is unavailable — same pattern as
    // connected-app-context.tsx's sdk_installations polling fallback.
    const timer = setInterval(() => { if (!cancelled) load() }, 5_000)

    return () => {
      cancelled = true
      clearInterval(timer)
      sb.removeChannel(channel)
    }
  }, [runId])

  const known = STEP_ORDER
    .map((key) => steps.find((s) => s.step_key === key))
    .filter((s): s is StepRow => Boolean(s))
  const extra = steps.filter((s) => !STEP_ORDER.includes(s.step_key))
  const ordered = [...known, ...extra]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ol className="space-y-0">
      {STEP_ORDER.map((key, i) => {
        const row = ordered.find((s) => s.step_key === key)
        const status = row?.status ?? 'pending'
        const isLast = i === STEP_ORDER.length - 1
        return (
          <li key={key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <StatusIcon status={status} />
              </span>
              {!isLast && <span className="w-px flex-1 bg-border/50" />}
            </div>
            <div className={cn('min-w-0 flex-1 pb-5', isLast && 'pb-0')}>
              <p className={cn(
                'text-sm font-medium',
                status === 'done' ? 'text-foreground'
                  : status === 'running' ? 'text-ai'
                  : status === 'failed' ? 'text-critical'
                  : 'text-muted-foreground',
              )}>
                {titleCase(key)}
              </p>
              {row?.detail && (
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{row.detail}</p>
              )}
            </div>
          </li>
        )
      })}
      {extra.map((row) => (
        <li key={row.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <StatusIcon status={row.status} />
            </span>
          </div>
          <div className="min-w-0 flex-1 pb-0">
            <p className="text-sm font-medium text-muted-foreground">{titleCase(row.step_key)}</p>
            {row.detail && <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{row.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
