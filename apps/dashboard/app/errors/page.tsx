import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { Bug } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, Meter } from '@/components/kit'
import type { Tone } from '@/lib/data'

const severityTone: Record<string, Tone> = {
  fatal:   'critical',
  error:   'critical',
  warning: 'warning',
  info:    'intel',
}

const statusTone: Record<string, Tone> = {
  open:     'warning',
  resolved: 'healthy',
  ignored:  'intel',
}

type DbError = {
  id: string
  error_type: string
  message: string
  severity: string
  status: string
  screen: string | null
  created_at: string
}

export default async function ErrorsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [{ data: errors }, { count: totalCount }, { count: openCount }, { count: resolvedCount }] =
    await Promise.all([
      supabase
        .from('errors')
        .select('id, error_type, message, severity, status, screen, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('errors').select('*', { count: 'exact', head: true }),
      supabase.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    ])

  const rows = (errors ?? []) as DbError[]
  const maxCount = rows.length

  const stats = [
    { label: 'Total Errors', value: String(totalCount ?? 0), tone: 'warning' as Tone },
    { label: 'Open', value: String(openCount ?? 0), tone: 'critical' as Tone },
    { label: 'Resolved', value: String(resolvedCount ?? 0), tone: 'healthy' as Tone },
    { label: 'Fatal', value: String(rows.filter((e) => e.severity === 'fatal').length), tone: 'critical' as Tone },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Bug className="h-5 w-5" />}
        title="Error Tracking"
        desc="Errors captured by the PAAQ SDK, ranked by recency and severity."
        actions={<ToneBadge tone="critical" dot>{`${totalCount ?? 0} total errors`}</ToneBadge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHead title="Recent Errors" desc="Captured by the PAAQ SDK — most recent first." />
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Bug className="h-8 w-8 opacity-20" />
            <p className="text-sm">No errors captured yet.</p>
            <p className="text-xs">Errors from your app will appear here automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((e, idx) => (
              <div key={e.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ToneBadge tone={statusTone[e.status] ?? 'intel'}>{e.status}</ToneBadge>
                    <ToneBadge tone={severityTone[e.severity] ?? 'intel'}>{e.severity}</ToneBadge>
                    <span className="text-[11px] text-muted-foreground">{e.error_type}</span>
                  </div>
                  <p className="mt-1.5 truncate font-mono text-sm text-foreground">{e.message}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    {e.screen && <span>Screen: {e.screen}</span>}
                    <span>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-40">
                  <Meter value={Math.max(10, 100 - idx * (100 / maxCount))} tone={severityTone[e.severity] ?? 'intel'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
