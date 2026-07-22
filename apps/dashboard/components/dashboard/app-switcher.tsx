'use client'

import { useConnectedApp } from '@/components/shell/connected-app-context'
import { cn } from '@/lib/utils'
import { CheckCircle2, WifiOff, Wifi, ChevronDown, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export function AppSwitcher() {
  const { app, setApp, allApps } = useConnectedApp()
  const [open, setOpen] = useState(false)

  const isConnected = (a: typeof app) =>
    a.sdkStatus.frontend === 'connected' ||
    a.sdkStatus.backend === 'connected'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 px-3.5 py-2 text-sm transition-all hover:border-border hover:bg-card"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: app.accentColor }}
        />
        <span className="font-semibold text-foreground">{app.name}</span>
        <span className="text-xs text-muted-foreground">{app.environment}</span>
        {allApps.length > 1 && (
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && allApps.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border/80 bg-card shadow-lg shadow-black/20">
            <div className="px-3 pt-3 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Your Projects
              </p>
            </div>

            {allApps.map((a) => {
              const active = a.id === app.id
              const connected = isConnected(a)
              return (
                <button
                  key={a.id}
                  onClick={() => { setApp(a.id); setOpen(false) }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40',
                    active && 'bg-intel/5',
                  )}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: a.accentColor }}
                  >
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">{a.name}</p>
                      {active && <CheckCircle2 className="h-3 w-3 text-intel shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {a.environment} · {a.apiKey ? a.apiKey.split('_').slice(0, 2).join('_') + '_…' : 'No SDK key'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1">
                      {connected
                        ? <Wifi className="h-3 w-3 text-healthy" />
                        : <WifiOff className="h-3 w-3 text-warning" />
                      }
                      <span className={cn('text-[10px] font-semibold', connected ? 'text-healthy' : 'text-warning')}>
                        {connected ? 'Live' : 'No SDK'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{a.environment}</p>
                  </div>
                </button>
              )
            })}

            <div className="border-t border-border/50 p-2">
              <Link
                href="/admin/tenants/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add new project
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
