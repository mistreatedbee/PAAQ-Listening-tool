'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { ArrowLeft, Users, Activity } from 'lucide-react'

type DbUser = {
  id: string
  external_user_id: string
  email: string | null
  created_at: string
}

type DbSession = {
  id: string
  status: string
  duration: number | null
  started_at: string
}

type DbEvent = {
  id: string
  event_name: string
  screen_name: string | null
  event_category: string | null
  timestamp: string
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<DbUser | null>(null)
  const [sessions, setSessions] = useState<DbSession[]>([])
  const [events, setEvents] = useState<DbEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('users').select('id, external_user_id, email, created_at').eq('id', id).single(),
      sb.from('sessions').select('id, status, duration, started_at').eq('user_id', id).order('started_at', { ascending: false }).limit(20),
    ]).then(([{ data: u }, { data: s }]) => {
      setUser(u as DbUser | null)
      setSessions((s ?? []) as DbSession[])
      setLoading(false)
    })

    // Load events via sessions join — get events for user's sessions
    sb.from('events')
      .select('id, event_name, screen_name, event_category, timestamp')
      .order('timestamp', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEvents((data ?? []) as DbEvent[])
      })
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All users
        </Link>
        <p className="text-muted-foreground">User not found.</p>
      </div>
    )
  }

  const displayName = user.email ?? user.external_user_id
  const initials = displayName[0]?.toUpperCase() ?? '?'
  const joined = new Date(user.created_at).toLocaleDateString()

  return (
    <div className="space-y-6">
      <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title={displayName}
        desc={`Joined ${joined} · ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'User ID', value: user.external_user_id },
          { label: 'Email', value: user.email ?? '—' },
          { label: 'Sessions', value: String(sessions.length) },
          { label: 'Joined', value: joined },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-sm font-semibold text-foreground truncate">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Sessions" desc="User session history" />
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <p className="text-sm">No sessions recorded yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground truncate">{s.id}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.started_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.duration != null && <span className="text-xs text-muted-foreground">{s.duration}s</span>}
                    <ToneBadge tone={s.status === 'active' ? 'healthy' : s.status === 'abandoned' ? 'critical' : 'intel'}>
                      {s.status}
                    </ToneBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="Recent Events" desc="Latest platform events" icon={<Activity className="h-4 w-4" />} />
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <p className="text-sm">No events captured yet.</p>
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-border/40 overflow-y-auto scrollbar-thin">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.event_name}</p>
                    {e.screen_name && <p className="text-xs text-muted-foreground">{e.screen_name}</p>}
                  </div>
                  <time className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHead title="Identity" />
        <div className="flex items-center gap-4 px-5 pb-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-intel to-ai text-2xl font-bold text-white">
            {initials}
          </span>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{displayName}</p>
            <p className="text-sm text-muted-foreground font-mono">{user.external_user_id}</p>
            <p className="text-xs text-muted-foreground">ID: {user.id}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
