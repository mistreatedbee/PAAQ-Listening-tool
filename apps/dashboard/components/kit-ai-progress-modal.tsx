'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Bot, Check, X } from 'lucide-react'
import { AiThinkingDots } from '@/components/kit-ai-button'

/**
 * Full-screen progress modal for long-running AI operations.
 *
 * "Run AI Analysis" and "Investigate" take 15-60s; a popup makes the wait
 * explicit and entertaining instead of leaving users staring at a button.
 * Shows an animated AI core, the current stage, elapsed time and — for
 * investigations — the 8 specialist agents as they come online.
 */

export type AiProgress = {
  /** Headline shown above the stage text, e.g. the incident title. */
  title?: string
  stages: string[]
  /** Agent names rendered as badges; index lights up over time. */
  agents?: string[]
}

const AGENT_LABELS: Record<string, string> = {
  incident: 'Incident',
  root_cause: 'Root Cause',
  product: 'Product',
  ux: 'UX',
  qa: 'QA',
  performance: 'Performance',
  security: 'Security',
  executive: 'Executive',
}

function AiCore() {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      {/* contracting pulse rings */}
      <span aria-hidden className="animate-ring-contract absolute inset-0 rounded-full border border-ai/40" />
      <span aria-hidden className="animate-ring-contract absolute inset-0 rounded-full border border-ai/30 [animation-delay:0.9s]" />
      {/* counter-rotating orbit rings with satellite dots */}
      <span aria-hidden className="animate-turn-slow absolute inset-1">
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-ai shadow-[0_0_8px_2px_color-mix(in_srgb,var(--ai)_60%,transparent)]" />
      </span>
      <span aria-hidden className="animate-turn-rev absolute inset-4">
        <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-intel shadow-[0_0_6px_2px_color-mix(in_srgb,var(--intel)_50%,transparent)]" />
      </span>
      {/* gradient core */}
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#27A6CE] via-[#51C9D3] to-[#5FDED4] shadow-[0_0_24px_4px_color-mix(in_srgb,var(--ai)_40%,transparent)]"
      >
        <Bot className="h-6 w-6 text-white" />
      </span>
    </div>
  )
}

export function AiProgressModal({
  open,
  onClose,
  progress,
}: {
  open: boolean
  /** Close is offered only when a dismiss handler is given; AI work continues in the background either way. */
  onClose?: () => void
  progress: AiProgress | null
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (!open) {
      setStartedAt(null)
      return
    }
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [open])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!mounted || !open || !progress) return null

  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0
  // Stages advance every 7s but never past the last one until done.
  const stageIdx = Math.min(progress.stages.length - 1, Math.floor(elapsed / 7))
  const agentCount = progress.agents?.length ?? 0
  // Agents come online one per ~5s once the collection stage has passed.
  const litAgents = Math.max(1, Math.floor(Math.max(0, elapsed - 5) / Math.max(4, 45 / Math.max(1, agentCount))))

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl animate-rise">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Hide (analysis keeps running)"
            title="Hide (analysis keeps running)"
            className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="flex flex-col items-center px-8 pb-7 pt-9 text-center">
          <AiCore />

          <p className="mt-5 text-xs font-medium uppercase tracking-widest text-ai">AI working</p>
          <h3 className="mt-1 max-w-xs text-balance text-base font-semibold leading-snug text-foreground">
            {progress.title ?? 'Analysing your data'}
          </h3>

          <p className="mt-4 flex h-5 items-center gap-1.5 text-sm font-medium text-foreground/90">
            {progress.stages[stageIdx]}
            <AiThinkingDots />
          </p>

          <div className="mt-1.5 flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
            <span className="inline-block h-1 w-16 overflow-hidden rounded-full bg-border">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-[#27A6CE] to-[#5FDED4]"
                style={{ width: `${Math.min(95, 8 + stageIdx * (87 / Math.max(1, progress.stages.length - 1)))}%`, transition: 'width 1.2s ease-out' }}
              />
            </span>
            {elapsed}s elapsed
          </div>

          {agentCount > 0 && (
            <>
              <div className="mt-6 mb-2.5 h-px w-full bg-border/60" />
              <div className="flex flex-wrap justify-center gap-1.5">
                {progress.agents?.map((a, i) => (
                  <span
                    key={a}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all duration-500',
                      i < litAgents
                        ? 'border-ai/50 bg-ai/10 text-ai shadow-[0_0_8px_0_color-mix(in_srgb,var(--ai)_25%,transparent)]'
                        : 'border-border/60 bg-card/60 text-muted-foreground/50',
                    )}
                  >
                    {i < litAgents ? <Check className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                    {AGENT_LABELS[a] ?? a}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-muted-foreground">
                {Math.min(litAgents, agentCount)} of {agentCount} specialist agents reporting
              </p>
            </>
          )}

          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground/80">
            This usually takes under a minute. You can keep the tab open — we&apos;ll take you to the results.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
