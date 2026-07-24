'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, XCircle, X, ShieldCheck, GitBranch } from 'lucide-react'

type Step = {
  label: string
  detail: string
  duration: number
}

const STEPS: Step[] = [
  { label: 'Pulling latest repository',      detail: 'Fetching current codebase state from source control',          duration: 900 },
  { label: 'Creating isolated workspace',    detail: 'Setting up a safe sandboxed execution environment',             duration: 700 },
  { label: 'Generating fix',                 detail: 'AI applying recommended changes to identified files',           duration: 1600 },
  { label: 'Running automated tests',        detail: 'Verifying no regressions were introduced by the change',        duration: 1400 },
  { label: 'Running security checks',        detail: 'Scanning for vulnerabilities and compliance issues',            duration: 1100 },
  { label: 'Building application',           detail: 'Compiling and bundling with production settings',               duration: 1300 },
  { label: 'Deploying changes',              detail: 'Rolling out to production with zero-downtime strategy',         duration: 1200 },
  { label: 'Monitoring production',          detail: 'Verifying health metrics and error rates after deployment',     duration: 1000 },
]

type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export function FixExecution({
  title,
  option,
  improvement,
  onClose,
}: {
  title: string
  option?: string
  improvement?: string
  onClose: () => void
}) {
  const [statuses, setStatuses] = useState<StepStatus[]>(STEPS.map(() => 'pending'))
  const [complete, setComplete] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let cancelled = false
    let step = 0

    const runStep = () => {
      if (cancelled || step >= STEPS.length) return

      setStatuses((prev) => {
        const next = [...prev]
        next[step] = 'running'
        return next
      })

      setTimeout(() => {
        if (cancelled) return
        setStatuses((prev) => {
          const next = [...prev]
          next[step] = 'done'
          return next
        })
        step++
        if (step < STEPS.length) setTimeout(runStep, 180)
        else setComplete(true)
      }, STEPS[step].duration)
    }

    const start = setTimeout(runStep, 500)
    return () => { cancelled = true; clearTimeout(start) }
  }, [])

  const doneCount = statuses.filter((s) => s === 'done').length
  const pct = Math.round((doneCount / STEPS.length) * 100)

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 transition-opacity duration-200',
      mounted ? 'opacity-100' : 'opacity-0',
    )}>
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-6 pt-5 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-ai">Executing fix</span>
              {option && (
                <span className="rounded-full border border-ai/25 bg-ai/10 px-1.5 py-0.5 text-[9px] font-semibold text-ai">
                  {option}
                </span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{title}</h2>
          </div>
          {complete && (
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-ai transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Steps */}
        <div className="px-6 py-4 space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
          {STEPS.map((step, i) => {
            const status = statuses[i]
            return (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-3 rounded-lg px-3 py-2 transition-all',
                  status === 'running' && 'bg-ai/8 border border-ai/20',
                  status === 'done'    && 'opacity-60',
                  status === 'pending' && 'opacity-30',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {status === 'done'    && <CheckCircle2 className="h-3.5 w-3.5 text-healthy" />}
                  {status === 'running' && <Loader2 className="h-3.5 w-3.5 text-ai animate-spin" />}
                  {status === 'failed'  && <XCircle className="h-3.5 w-3.5 text-critical" />}
                  {status === 'pending' && <div className="h-3.5 w-3.5 rounded-full border-2 border-border/50" />}
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    'text-xs font-medium leading-snug',
                    status === 'running' ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {step.label}
                  </p>
                  {status === 'running' && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{step.detail}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {complete ? (
          <div className="border-t border-border/60 px-6 py-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-healthy/10">
                <CheckCircle2 className="h-4.5 w-4.5 text-healthy" />
              </div>
              <div>
                <p className="text-sm font-semibold text-healthy">Deployment successful</p>
                {improvement && (
                  <p className="text-xs text-muted-foreground mt-0.5">{improvement}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                <ShieldCheck className="h-3.5 w-3.5 text-healthy shrink-0" />
                <span className="text-[10px] text-muted-foreground">Security passed</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                <GitBranch className="h-3.5 w-3.5 text-intel shrink-0" />
                <span className="text-[10px] text-muted-foreground">PR created</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-healthy/30 bg-healthy/10 px-4 py-2.5 text-sm font-semibold text-healthy hover:bg-healthy/20 transition-colors"
            >
              Done — view deployment
            </button>
          </div>
        ) : (
          <div className="border-t border-border/60 px-6 py-3">
            <p className="text-center text-[10px] text-muted-foreground/50">
              Every step is audited and logged · A rollback plan is ready if needed
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
