'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { AIAssistant } from './ai-assistant'
import { ConnectedAppProvider } from './connected-app-context'

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false)
  const [assistant, setAssistant] = useState(false)

  useEffect(() => {
    const handler = () => setAssistant(true)
    window.addEventListener('open-assistant', handler)
    return () => window.removeEventListener('open-assistant', handler)
  }, [])

  return (
    <ConnectedAppProvider>
      <div className="min-h-screen bg-background">
        <Sidebar mobileOpen={mobileNav} onClose={() => setMobileNav(false)} />

        <div className="lg:pl-64">
          <Topbar onMenu={() => setMobileNav(true)} onToggleAssistant={() => setAssistant((a) => !a)} />
          <main
            className={cn(
              'mx-auto w-full max-w-[1600px] px-3 py-5 transition-[padding] duration-300 sm:px-5 lg:px-6',
              assistant && 'sm:pr-5 xl:pr-[25rem]',
            )}
          >
            {children}
          </main>
        </div>

        <AIAssistant open={assistant} onClose={() => setAssistant(false)} />
      </div>
    </ConnectedAppProvider>
  )
}
