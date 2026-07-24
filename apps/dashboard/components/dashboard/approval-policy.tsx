'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Eye, Hand, Users, Zap, ChevronDown, Check } from 'lucide-react'

export type ApprovalMode = 'advisory' | 'assisted' | 'team' | 'autonomous'

const MODES = [
  {
    id: 'advisory' as ApprovalMode,
    label: 'Advisory',
    desc: 'AI detects and recommends only — no execution',
    icon: Eye,
    color: 'text-intel',
    borderColor: 'border-intel/40',
    bgColor: 'bg-intel/10',
    requires: 'No execution at all — insights only',
  },
  {
    id: 'assisted' as ApprovalMode,
    label: 'Assisted',
    desc: 'Every action requires your approval before execution',
    icon: Hand,
    color: 'text-ai',
    borderColor: 'border-ai/40',
    bgColor: 'bg-ai/10',
    requires: 'Manual approval required for every action',
  },
  {
    id: 'team' as ApprovalMode,
    label: 'Team Approval',
    desc: 'High-impact changes require two approvers',
    icon: Users,
    color: 'text-warning',
    borderColor: 'border-warning/40',
    bgColor: 'bg-warning/10',
    requires: '2 approvers for medium and high impact',
  },
  {
    id: 'autonomous' as ApprovalMode,
    label: 'Autonomous',
    desc: 'AI auto-resolves low-risk issues — you approve the rest',
    icon: Zap,
    color: 'text-healthy',
    borderColor: 'border-healthy/40',
    bgColor: 'bg-healthy/10',
    requires: 'Approval only for medium and high risk',
  },
] as const

const STORAGE_KEY = 'paaq-approval-mode'

export function useApprovalMode() {
  const [mode, setMode] = useState<ApprovalMode>('assisted')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ApprovalMode | null
    if (saved && MODES.find((m) => m.id === saved)) setMode(saved)
  }, [])

  const updateMode = (m: ApprovalMode) => {
    setMode(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  return { mode, setMode: updateMode }
}

export function ApprovalPolicyPill() {
  const { mode, setMode } = useApprovalMode()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = MODES.find((m) => m.id === mode)!

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
          current.borderColor,
          current.bgColor,
          current.color,
        )}
      >
        <current.icon className="h-3 w-3" />
        {current.label} Mode
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-border/80 bg-card shadow-xl">
          <p className="px-4 pt-3 pb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Approval Policy
          </p>
          {MODES.map((m) => {
            const Icon = m.icon
            const active = m.id === mode
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setOpen(false) }}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40',
                  active && 'bg-accent/50',
                )}
              >
                <div className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                  m.borderColor, m.bgColor,
                )}>
                  <Icon className={cn('h-3.5 w-3.5', m.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground">{m.label}</p>
                    {active && (
                      <div className="flex items-center gap-0.5 rounded-full bg-ai/15 px-1.5 py-0.5">
                        <Check className="h-2.5 w-2.5 text-ai" />
                        <span className="text-[9px] font-bold text-ai">Active</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{m.desc}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground/50">{m.requires}</p>
                </div>
              </button>
            )
          })}
          <div className="border-t border-border/40 px-4 py-2.5">
            <p className="text-[9px] text-muted-foreground/50">
              Medium and high-risk actions always require human approval, regardless of mode.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
