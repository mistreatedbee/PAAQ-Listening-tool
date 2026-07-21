'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { navGroups } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { toneSoft, toneText } from '@/lib/tones'
import { Activity, X } from 'lucide-react'

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
          <Link href="/" className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-intel to-ai">
              <Activity className="h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">PAAQ</span>
              <span className="text-[10px] font-medium text-muted-foreground">Listening Platform</span>
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

        {/* Nav */}
        <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href
                  const Icon = item.icon
                  const liveBadge = getBadge(item.href)
                  const badge = item.badge === 'live' ? 'live' : liveBadge
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-sidebar-accent font-medium text-sidebar-foreground'
                            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 h-5 w-0.5 rounded-r-full bg-intel" aria-hidden="true" />
                        )}
                        <Icon className={cn('h-4 w-4 shrink-0', active && 'text-intel')} />
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

        {/* Footer status */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <span className={cn(
              'h-2 w-2 rounded-full',
              openIncidents > 0 ? 'bg-critical animate-pulse-dot' : 'bg-healthy animate-pulse-dot',
            )} />
            <div className="flex-1 leading-tight">
              <p className={cn('text-xs font-medium', openIncidents > 0 ? toneText.critical : 'text-sidebar-foreground')}>
                {openIncidents > 0 ? `${openIncidents} open incident${openIncidents !== 1 ? 's' : ''}` : 'All systems operational'}
              </p>
              <p className="text-[10px] text-muted-foreground">Production · live</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
