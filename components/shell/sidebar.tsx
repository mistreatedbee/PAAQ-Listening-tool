'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navGroups } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { toneSoft } from '@/lib/tones'
import { Activity, X } from 'lucide-react'

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean
  onClose: () => void
}) {
  const pathname = usePathname()

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
                        {item.badge &&
                          (item.badge === 'live' ? (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-healthy">
                              <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-dot" />
                              live
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'rounded-full border px-1.5 py-0 text-[10px] font-semibold',
                                item.badgeTone && toneSoft[item.badgeTone],
                              )}
                            >
                              {item.badge}
                            </span>
                          ))}
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
            <span className="h-2 w-2 rounded-full bg-healthy animate-pulse-dot" />
            <div className="flex-1 leading-tight">
              <p className="text-xs font-medium text-sidebar-foreground">All systems operational</p>
              <p className="text-[10px] text-muted-foreground">Production · us-east-1</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
