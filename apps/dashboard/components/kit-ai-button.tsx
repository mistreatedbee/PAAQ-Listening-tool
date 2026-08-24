'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

/**
 * Button for long-running AI operations ("Run AI Analysis", "Investigate").
 *
 * These calls take 15-60s, far past what a bare spinner communicates, so
 * while running the button shows a brand-gradient sweep, a rotating status
 * line and a live elapsed counter — reassurance that work is happening and
 * the tab should not be closed.
 */

const DEFAULT_STAGES = [
  'Collecting telemetry…',
  'AI agents analysing…',
  'Correlating findings…',
  'Almost there…',
]

export function AiButton({
  onClick,
  busy,
  idleLabel,
  busyLabel,
  stages = DEFAULT_STAGES,
  icon,
  className,
}: {
  onClick: () => void
  busy: boolean
  idleLabel: string
  busyLabel?: string
  /** Rotating status lines shown while busy; cycled every ~6s. */
  stages?: string[]
  icon?: ReactNode
  className?: string
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(0)
  const [stageIdx, setStageIdx] = useState(0)

  useEffect(() => {
    if (!busy) {
      setStartedAt(null)
      setStageIdx(0)
      return
    }
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [busy])

  useEffect(() => {
    if (!busy || stages.length <= 1) return
    const rotate = setInterval(() => setStageIdx((i) => (i + 1) % stages.length), 6000)
    return () => clearInterval(rotate)
  }, [busy, stages.length])

  // Stage index is time-derived so a re-render never desyncs it from the clock.
  const activeStage = startedAt
    ? Math.min(stages.length - 1, Math.floor(((now - startedAt) / 1000) / 6))
    : 0
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0

  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
        busy
          ? 'cursor-progress bg-ai/90 text-ai-foreground shadow-[0_0_16px_0_color-mix(in_srgb,var(--ai)_35%,transparent)]'
          : 'bg-ai text-ai-foreground hover:opacity-90',
        className,
      )}
    >
      {busy && (
        <span
          aria-hidden
          className="animate-ai-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
      )}
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {busyLabel ?? stages[activeStage]}
            <span className="inline-flex items-center" aria-hidden>
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="animate-ai-dot h-1 w-1 rounded-full bg-current"
                  style={{ animationDelay: `${d * 0.18}s` }}
                />
              ))}
            </span>
          </span>
          {elapsed > 0 && (
            <span className="ml-1 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {elapsed}s
            </span>
          )}
        </>
      ) : (
        <>
          {icon}
          {idleLabel}
        </>
      )}
    </button>
  )
}

/** Inline thinking-dots row for use outside buttons (cards, panels). */
export function AiThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden>
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="animate-ai-dot h-1.5 w-1.5 rounded-full bg-current"
          style={{ animationDelay: `${d * 0.18}s` }}
        />
      ))}
    </span>
  )
}
