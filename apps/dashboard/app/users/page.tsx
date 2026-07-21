import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { Users } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import type { Tone } from '@/lib/data'

type DbUser = {
  id: string
  external_user_id: string
  email: string | null
  created_at: string
}

type DbSession = {
  id: string
  user_id: string
  status: string
  duration: number | null
  started_at: string
}

export default async function UsersPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [
    { data: users },
    { count: totalUsers },
    { data: sessions },
    { count: activeSessions },
  ] = await Promise.all([
    supabase.from('users').select('id, external_user_id, email, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('sessions').select('id, user_id, status, duration, started_at').order('started_at', { ascending: false }).limit(50),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const userRows = (users ?? []) as DbUser[]
  const sessionRows = (sessions ?? []) as DbSession[]

  const stats = [
    { label: 'Total Users', value: String(totalUsers ?? 0), tone: 'intel' as Tone },
    { label: 'Active Sessions', value: String(activeSessions ?? 0), tone: 'healthy' as Tone },
    { label: 'Sessions Captured', value: String(sessionRows.length), tone: 'intel' as Tone },
    { label: 'Avg Duration', value: (() => {
        const withDuration = sessionRows.filter((s) => s.duration)
        if (!withDuration.length) return '—'
        const avg = withDuration.reduce((a, s) => a + (s.duration ?? 0), 0) / withDuration.length
        return `${Math.round(avg)}s`
      })(), tone: 'intel' as Tone },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title="Users"
        desc="All users and sessions captured by the PAAQ SDK."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Users" desc="Registered application users" />
          {userRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Users className="h-8 w-8 opacity-20" />
              <p className="text-sm">No users yet.</p>
              <p className="text-xs">Call Listening.identify() from your app.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {userRows.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-colors">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-intel to-ai text-xs font-semibold text-white">
                    {(u.email ?? u.external_user_id)[0]?.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.email ?? u.external_user_id}</p>
                    <p className="text-xs text-muted-foreground">{u.external_user_id}</p>
                  </div>
                  <time className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="Recent Sessions" desc="Latest user sessions" />
          {sessionRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <p className="text-sm">No sessions yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {sessionRows.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground truncate">{s.id}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.duration && <span className="text-xs text-muted-foreground">{s.duration}s</span>}
                    <ToneBadge tone={s.status === 'active' ? 'healthy' : s.status === 'abandoned' ? 'critical' : 'intel'}>
                      {s.status}
                    </ToneBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
