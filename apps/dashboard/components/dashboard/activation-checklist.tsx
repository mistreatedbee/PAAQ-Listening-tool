'use client'

import { useEffect, useState } from 'react'
import { track } from '@vercel/analytics/react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { CheckCircle2, Circle, Sparkles, Users, Share2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type ChecklistStep = {
  id: string
  label: string
  description: string
  href: string
  completed: boolean
}

/**
 * Activation checklist shown to connected users with low event activity.
 * Guides users through the early-stage activation funnel.
 */
export function ActivationChecklist() {
  const { app } = useConnectedApp()
  const [eventCount, setEventCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    
    sb.from('events')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', app.id)
      .then(({ count }) => {
        setEventCount(count ?? 0)
        setLoading(false)
      })
  }, [app.id])

  // Only show for connected users with < 50 events (early activation stage)
  const anyConnected = app.sdkStatus.frontend === 'connected'
    || app.sdkStatus.backend === 'connected'
    || app.sdkStatus.database === 'connected'

  const shouldShow = anyConnected && !loading && eventCount !== null && eventCount < 50

  if (!shouldShow) return null

  // Define activation steps
  const steps: ChecklistStep[] = [
    {
      id: 'connect',
      label: 'Connect your first app',
      description: 'Install the SDK and send your first event',
      href: '/setup',
      completed: anyConnected && eventCount > 0,
    },
    {
      id: 'events',
      label: 'Send production traffic',
      description: 'Deploy to production and send 10+ events',
      href: '/setup',
      completed: eventCount >= 10,
    },
    {
      id: 'team',
      label: 'Invite your team',
      description: 'Collaborate with teammates on insights',
      href: '/settings',
      completed: false, // TODO: check if team members exist
    },
    {
      id: 'share',
      label: 'Share with friends',
      description: 'Help others discover PAAQ Intelligence',
      href: '/referral',
      completed: false, // TODO: check referral stats
    },
  ]

  const completedCount = steps.filter((s) => s.completed).length
  const nextStep = steps.find((s) => !s.completed)

  return (
    <div className="rounded-xl border border-ai/30 bg-gradient-to-br from-ai/8 to-intel/5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ai/20 text-ai">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h3 className="text-sm font-semibold text-foreground">
              Get the most out of PAAQ Intelligence
            </h3>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {completedCount}/{steps.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Complete these steps to unlock the full power of AI-native product intelligence.
          </p>

          {/* Checklist */}
          <div className="space-y-2.5">
            {steps.map((step, idx) => {
              const isNext = nextStep?.id === step.id
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  onClick={() => track('activation_step_click', { step: step.id })}
                  className={cn(
                    'group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-all',
                    step.completed
                      ? 'border-border/50 bg-card/40 opacity-60 hover:opacity-80'
                      : 'border-ai/40 bg-card/60 hover:border-ai/60 hover:bg-card/80',
                    isNext && 'ring-1 ring-ai/30',
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-healthy" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/60 group-hover:text-ai transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium',
                      step.completed ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                  {!step.completed && isNext && (
                    <ArrowRight className="h-4 w-4 text-ai opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Quick actions */}
          {eventCount === 0 && (
            <div className="mt-4 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Quick start:</span>
              <Link
                href="/connect"
                className="inline-flex items-center gap-1 font-medium text-ai hover:underline"
              >
                <Sparkles className="h-3 w-3" />
                AI-guided setup
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
