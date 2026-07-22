'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Menu, LogOut, ChevronDown } from 'lucide-react'

export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = email ? email.slice(0, 2).toUpperCase() : 'SA'

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center gap-3 px-4 sm:px-5"
      style={{
        background: 'rgba(8,13,18,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <button onClick={onMenu} className="p-1.5 rounded-lg lg:hidden" style={{ color: 'var(--text-muted)' }}>
        <Menu className="h-5 w-5" />
      </button>

      {/* Status chip */}
      <div
        className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1 sm:flex"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--healthy)' }} />
        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
          All systems operational
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Admin badge */}
        <span
          className="hidden rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:block"
          style={{ background: 'color-mix(in oklch, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)' }}
        >
          Super Admin
        </span>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg p-1 pr-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)' }}
            >
              {initials}
            </span>
            <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden />
              <div
                className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl shadow-2xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-hi)' }}
              >
                {email && (
                  <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Signed in as</p>
                    <p className="truncate text-xs font-medium" style={{ color: 'var(--text)' }}>{email}</p>
                  </div>
                )}
                <div className="p-1">
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all"
                    style={{ color: 'var(--critical)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in oklch, var(--critical) 10%, transparent)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
