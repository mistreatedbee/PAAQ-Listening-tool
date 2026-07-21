'use client'

import { useState } from 'react'
import { systemMap, type ServiceNode } from '@/lib/data'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneBg, toneText } from '@/lib/tones'
import { Network, ChevronRight } from 'lucide-react'

const statusTone = {
  healthy: 'healthy',
  degraded: 'warning',
  critical: 'critical',
} as const

export function SystemMap() {
  const [active, setActive] = useState<ServiceNode>(systemMap.find((s) => s.status === 'critical') ?? systemMap[0])

  return (
    <Card className="overflow-hidden">
      <CardHead
        title="Live System Map"
        desc="Real-time service topology and health"
        icon={<Network className="h-4 w-4" />}
        action={
          <ToneBadge tone="healthy" dot>
            8 services
          </ToneBadge>
        }
      />
      <div className="px-5 pb-5">
        {/* pipeline */}
        <div className="scrollbar-thin flex items-stretch gap-1 overflow-x-auto pb-3">
          {systemMap.map((node, i) => {
            const tone = statusTone[node.status]
            const selected = active.id === node.id
            return (
              <div key={node.id} className="flex items-stretch">
                <button
                  onClick={() => setActive(node)}
                  className={cn(
                    'group relative w-[132px] shrink-0 rounded-lg border p-3 text-left transition-all',
                    selected
                      ? 'border-border bg-accent/60 ring-1 ring-intel/40'
                      : 'border-border/60 bg-card/60 hover:border-border hover:bg-accent/30',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('h-2 w-2 rounded-full', toneBg[tone], node.status !== 'healthy' && 'animate-pulse-dot')} />
                    <span className={cn('text-[10px] font-semibold uppercase', toneText[tone])}>{node.status}</span>
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-foreground">{node.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{node.requests}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{node.latency}</span>
                    <span className={cn('font-medium', node.status === 'healthy' ? 'text-muted-foreground' : toneText[tone])}>
                      {node.errors}
                    </span>
                  </div>
                </button>
                {i < systemMap.length - 1 && (
                  <div className="flex w-5 items-center justify-center">
                    <svg width="20" height="10" aria-hidden="true">
                      <line x1="0" y1="5" x2="20" y2="5" stroke="var(--border)" strokeWidth="1.5" className="animate-flow" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* detail */}
        <div className="mt-1 rounded-lg border border-border/60 bg-background/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', toneBg[statusTone[active.status]])} />
              <h4 className="text-sm font-semibold text-foreground">{active.name}</h4>
              <ToneBadge tone={statusTone[active.status]}>{active.status}</ToneBadge>
            </div>
            <button className="flex items-center gap-1 text-xs font-medium text-intel hover:underline">
              Inspect service <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{active.detail}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Health" value={`${active.health}%`} tone={statusTone[active.status]} />
            <Stat label="Latency" value={active.latency} />
            <Stat label="Error rate" value={active.errors} tone={active.status !== 'healthy' ? statusTone[active.status] : undefined} />
            <Stat label="Requests" value={active.requests} />
          </div>
        </div>
      </div>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'healthy' | 'warning' | 'critical' }) {
  return (
    <div className="rounded-md border border-border/50 bg-card/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', tone ? toneText[tone] : 'text-foreground')}>{value}</p>
    </div>
  )
}
