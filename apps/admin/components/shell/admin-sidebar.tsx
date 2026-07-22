'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { Sparkles, X } from 'lucide-react'

export function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col transition-transform duration-300 lg:z-30 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: '#09111a', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div
          className="flex h-14 items-center justify-between px-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)' }}
            >
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="leading-none">
              <p className="text-xs font-black tracking-tight" style={{ color: 'var(--text)' }}>PAAQ</p>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Super Admin</p>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <p className="px-2 pb-2 text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Platform
          </p>
          <ul className="space-y-0.5">
            {ADMIN_NAV.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all relative',
                    )}
                    style={{
                      background: active ? 'color-mix(in oklch, var(--accent) 10%, transparent)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: active ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                        e.currentTarget.style.color = 'var(--text)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-muted)'
                      }
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full"
                        style={{ background: 'var(--accent)' }}
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            <p className="font-semibold" style={{ color: 'var(--text)' }}>PAAQ Admin Platform</p>
            <p style={{ color: 'var(--text-dim)' }}>v1.0 · Super Admin only</p>
          </div>
        </div>
      </aside>
    </>
  )
}
