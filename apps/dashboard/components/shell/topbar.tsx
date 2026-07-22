'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/utils/supabase/client'
import { flatNav } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { toneBg, toneText } from '@/lib/tones'
import type { Tone } from '@/lib/data'
import {
  Menu,
  Search,
  Bell,
  Sparkles,
  ChevronDown,
  PanelRightOpen,
  AlertTriangle,
  Users,
  Command,
  Sun,
  Moon,
  LogOut,
  Settings,
  UserCircle,
} from 'lucide-react'

type DbNotification = {
  id: string
  message: string | null
  type: string | null
  created_at: string
}

function notifTone(type: string | null): Tone {
  if (type === 'critical' || type === 'error') return 'critical'
  if (type === 'warning') return 'warning'
  if (type === 'success') return 'healthy'
  return 'intel'
}

export function Topbar({
  onMenu,
  onToggleAssistant,
}: {
  onMenu: () => void
  onToggleAssistant: () => void
}) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<DbNotification[]>([])
  const [criticalCount, setCriticalCount] = useState<number | null>(null)
  const [sessionCount, setSessionCount] = useState<number | null>(null)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('notifications')
        .select('id, message, type, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      sb.from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .neq('status', 'resolved'),
      sb.from('sessions')
        .select('*', { count: 'exact', head: true }),
    ]).then(([{ data }, { count: critical }, { count: sessions }]) => {
      setNotifications((data ?? []) as DbNotification[])
      setCriticalCount(critical ?? 0)
      setSessionCount(sessions ?? 0)
    })
  }, [])

  const results = search
    ? flatNav.filter((n) => n.label.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : flatNav.slice(0, 6)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl sm:px-5">
      <button
        onClick={onMenu}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Global search */}
      <div className="relative flex-1 max-w-md">
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Search PAAQ modules, incidents, insights…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden items-center gap-0.5 rounded border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>
        {searchOpen && (
          <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-lg border border-border/70 bg-popover shadow-xl animate-rise">
            <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Quick navigation
            </p>
            <ul className="p-1.5">
              {results.map((r) => {
                const Icon = r.icon
                return (
                  <li key={r.href}>
                    <button
                      onMouseDown={() => { router.push(r.href); setSearch('') }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-accent"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {r.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Status chips */}
      <div className="hidden items-center gap-2 xl:flex">
        <StatusChip icon={<Sparkles className="h-3.5 w-3.5" />} label="AI" value="Active" tone="ai" />
        <StatusChip
          icon={<Users className="h-3.5 w-3.5" />}
          label="Sessions"
          value={sessionCount === null ? '—' : String(sessionCount)}
          tone="intel"
        />
        <Link href="/incidents">
          <StatusChip
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Critical"
            value={criticalCount === null ? '—' : String(criticalCount)}
            tone={criticalCount ? 'critical' : 'healthy'}
          />
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Environment */}
        <button className="hidden items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-healthy" />
          Production
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative rounded-lg border border-border/70 bg-card/60 p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-critical opacity-70 animate-pulse-dot" />
                <span className="relative h-2 w-2 rounded-full bg-critical" />
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-lg border border-border/70 bg-popover shadow-xl animate-rise">
                <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
                  <p className="text-sm font-semibold">Notifications</p>
                  {notifications.length > 0 && (
                    <span className="rounded-full bg-critical/15 px-1.5 py-0.5 text-[10px] font-semibold text-critical">
                      {notifications.length} new
                    </span>
                  )}
                </div>
                <ul className="max-h-80 overflow-y-auto scrollbar-thin">
                  {notifications.length === 0 ? (
                    <li className="px-3 py-4 text-center text-sm text-muted-foreground">No notifications</li>
                  ) : (
                    notifications.map((n) => {
                      const tone = notifTone(n.type)
                      const timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      return (
                        <li key={n.id} className="flex gap-3 border-b border-border/40 px-3 py-2.5 last:border-0 hover:bg-accent/50">
                          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneBg[tone])} />
                          <div className="flex-1">
                            <p className={cn('text-sm font-medium', toneText[tone])}>{n.message ?? 'Notification'}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="rounded-lg border border-border/70 bg-card/60 p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* AI assistant toggle */}
        <button
          onClick={onToggleAssistant}
          className="rounded-lg border border-ai/30 bg-ai/10 p-2 text-ai hover:bg-ai/20"
          aria-label="Toggle AI assistant"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>

        {/* Profile dropdown */}
        <ProfileMenu />
      </div>
    </header>
  )
}

function ProfileMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  const initials = email ? email.slice(0, 2).toUpperCase() : 'AC'

  const handleSignOut = async () => {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/60 p-1 pr-2 hover:bg-accent"
        aria-label="Account menu"
      >
        <span className="paaq-gradient flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold text-white">
          {initials}
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-lg border border-border/70 bg-popover shadow-xl animate-rise">
            {email && (
              <div className="border-b border-border/60 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground">Signed in as</p>
                <p className="truncate text-xs font-medium text-foreground">{email}</p>
              </div>
            )}
            <ul className="p-1">
              <li>
                <button
                  onClick={() => { router.push('/settings'); setOpen(false) }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-accent"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Settings
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setOpen(false) }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-accent"
                >
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  Account
                </button>
              </li>
              <li className="border-t border-border/60 mt-1 pt-1">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-critical hover:bg-critical/8"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function StatusChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'intel' | 'healthy' | 'warning' | 'critical' | 'ai'
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1.5">
      <span className={toneText[tone]}>{icon}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold', toneText[tone])}>{value}</span>
    </div>
  )
}
