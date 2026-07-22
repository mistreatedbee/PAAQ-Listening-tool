'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { NAV_ITEMS } from '@/lib/nav'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { cn } from '@/lib/utils'
import { toneSoft } from '@/lib/tones'
import { X, Wifi, WifiOff } from 'lucide-react'

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const { app } = useConnectedApp()
  const [openIncidents, setOpenIncidents] = useState(0)
  const [openErrors, setOpenErrors] = useState(0)
  const [aiInsights, setAiInsights] = useState(0)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('ai_insights').select('*', { count: 'exact', head: true }),
    ]).then(([{ count: inc }, { count: err }, { count: ai }]) => {
      setOpenIncidents(inc ?? 0)
      setOpenErrors(err ?? 0)
      setAiInsights(ai ?? 0)
    })
  }, [])

  function liveBadge(href: string) {
    if (href === '/incidents' && openIncidents > 0)
      return { value: String(openIncidents), tone: 'critical' as const }
    if (href === '/ai-insights' && aiInsights > 0)
      return { value: String(aiInsights), tone: 'ai' as const }
    return null
  }

  const allConnected = app.sdkStatus.frontend === 'connected'
    && app.sdkStatus.backend === 'connected'
    && app.sdkStatus.database === 'connected'

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
        {/* Tool identity — always PAAQ Listening Tool */}
        <div className="flex h-14 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <Image
              src="/logo.png"
              alt="PAAQ Listening Tool"
              width={32}
              height={32}
              className="shrink-0 rounded-lg"
              priority
            />
            <span className="flex flex-col leading-none">
              <span className="paaq-gradient-text text-sm font-black tracking-tight">PAAQ</span>
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">Listening Tool</span>
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

        {/* Connected app feature areas — driven by config */}
        <div className="border-b border-sidebar-border/60 px-3 py-2.5">
          <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {app.name} · Feature Areas
          </p>
          <div className={cn('grid gap-1', app.featureAreas.length <= 4 ? 'grid-cols-4' : 'grid-cols-3')}>
            {app.featureAreas.map((fa) => (
              <div
                key={fa.id}
                className="flex flex-col items-center gap-1 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 py-1.5"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse-dot"
                  style={{ backgroundColor: fa.color }}
                />
                <span className="text-[9px] font-semibold text-sidebar-foreground/70">{fa.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nine fixed nav tabs */}
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              const Icon = item.icon
              const badge = liveBadge(item.href)
              return (
                <li key={item.href} className="relative">
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-all',
                      active
                        ? 'bg-intel/10 font-semibold text-intel'
                        : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 h-5 w-0.5 rounded-r-full bg-intel" aria-hidden="true" />
                    )}
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-intel' : 'text-muted-foreground/70')} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge && (
                      <span className={cn('rounded-full border px-1.5 py-0 text-[10px] font-semibold', toneSoft[badge.tone])}>
                        {badge.value}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer — connected app identity + health */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          {/* Connected app badge */}
          <div
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
            style={{ borderColor: `${app.accentColor}30`, backgroundColor: `${app.accentColor}08` }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: app.accentColor }}
            />
            <div className="flex-1 min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold text-foreground">{app.name}</p>
              <p className="text-[10px] text-muted-foreground/70">{app.environment}</p>
            </div>
            <span className={cn(
              'text-[10px] font-semibold',
              allConnected ? 'text-healthy' : 'text-warning',
            )}>
              {allConnected ? '3/3' : app.sdkStatus.frontend === 'connected' ? '2/3' : '1/3'}
            </span>
          </div>

          {/* Platform health pulse */}
          <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-dot',
                openIncidents > 0 ? 'bg-critical' : 'bg-healthy',
              )} />
              <span className={cn(
                'relative h-2 w-2 rounded-full',
                openIncidents > 0 ? 'bg-critical' : 'bg-healthy',
              )} />
            </span>
            <p className={cn('flex-1 truncate text-xs font-semibold', openIncidents > 0 ? 'text-critical' : 'text-sidebar-foreground')}>
              {openIncidents > 0 ? `${openIncidents} open incident${openIncidents !== 1 ? 's' : ''}` : 'All systems healthy'}
            </p>
            {allConnected
              ? <Wifi className="h-3.5 w-3.5 shrink-0 text-healthy/70" />
              : <WifiOff className="h-3.5 w-3.5 shrink-0 text-warning/70" />
            }
          </div>
        </div>
      </aside>
    </>
  )
}
