'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { navGroups } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { toneSoft, toneText } from '@/lib/tones'
import { X, Wifi } from 'lucide-react'

type LiveCounts = {
  '/incidents': number
  '/errors': number
  '/ai-insights': number
}

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const [counts, setCounts] = useState<LiveCounts | null>(null)
  const [openIncidents, setOpenIncidents] = useState(0)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('ai_insights').select('*', { count: 'exact', head: true }),
    ]).then(([{ count: incidents }, { count: errors }, { count: insights }]) => {
      const inc = incidents ?? 0
      setOpenIncidents(inc)
      setCounts({
        '/incidents': inc,
        '/errors': errors ?? 0,
        '/ai-insights': insights ?? 0,
      })
    })
  }, [])

  function getBadge(href: string): { value: string; tone: 'critical' | 'warning' | 'ai' } | null {
    if (!counts) return null
    const key = href as keyof LiveCounts
    if (!(key in counts)) return null
    const n = counts[key]
    if (n === 0) return null
    if (href === '/incidents') return { value: String(n), tone: 'critical' }
    if (href === '/errors') return { value: String(n), tone: 'warning' }
    if (href === '/ai-insights') return { value: String(n), tone: 'ai' }
    return null
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:z-30 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <Link href="/" className="flex items-center gap-3">
            {/* PAAQ logo */}
            <Image
              src="/logo.png"
              alt="PAAQ"
              width={32}
              height={32}
              className="shrink-0 rounded-lg"
              priority
            />
            <span className="flex flex-col leading-none">
              <span className="paaq-gradient-text text-sm font-black tracking-tight">PAAQ</span>
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">Listening</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* PAAQ module quick-status */}
        <div className="border-b border-sidebar-border/60 px-3 py-2.5">
          <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Platform Modules
          </p>
          <div className="grid grid-cols-4 gap-1">
            {[
              { label: 'Ask', color: 'bg-healthy' },
              { label: 'Book', color: 'bg-intel' },
              { label: 'Attend', color: 'bg-ai' },
              { label: 'Learn', color: 'bg-warning' },
            ].map((m) => (
              <div key={m.label} className="flex flex-col items-center gap-1 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 py-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse-dot', m.color)} />
                <span className="text-[9px] font-semibold text-sidebar-foreground/70">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nav */}
        <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href
                  const Icon = item.icon
                  const liveBadge = getBadge(item.href)
                  const badge = item.badge === 'live' ? 'live' : liveBadge
                  return (
                    <li key={item.href} className="relative">
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-all',
                          active
                            ? 'bg-intel/10 font-medium text-intel'
                            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 h-5 w-0.5 rounded-r-full bg-intel" aria-hidden="true" />
                        )}
                        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-intel' : 'text-muted-foreground/70')} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge === 'live' ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-healthy">
                            <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-dot" />
                            live
                          </span>
                        ) : badge ? (
                          <span
                            className={cn(
                              'rounded-full border px-1.5 py-0 text-[10px] font-semibold',
                              toneSoft[badge.tone],
                            )}
                          >
                            {badge.value}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer — platform health */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-2.5">
            <span className={cn(
              'relative flex h-2.5 w-2.5 shrink-0',
            )}>
              <span className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-dot',
                openIncidents > 0 ? 'bg-critical' : 'bg-healthy',
              )} />
              <span className={cn(
                'relative h-2.5 w-2.5 rounded-full',
                openIncidents > 0 ? 'bg-critical' : 'bg-healthy',
              )} />
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <p className={cn('truncate text-xs font-semibold', openIncidents > 0 ? toneText.critical : 'text-sidebar-foreground')}>
                {openIncidents > 0
                  ? `${openIncidents} open incident${openIncidents !== 1 ? 's' : ''}`
                  : 'All systems healthy'}
              </p>
              <p className="text-[10px] text-muted-foreground/70">PAAQ Production · live</p>
            </div>
            <Wifi className="h-3.5 w-3.5 shrink-0 text-healthy opacity-70" />
          </div>
        </div>
      </aside>
    </>
  )
}
