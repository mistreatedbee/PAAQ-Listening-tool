'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText, toneBg } from '@/lib/tones'
import { ArrowLeft, Bug, Terminal } from 'lucide-react'
import type { Tone } from '@/lib/data'

type DbError = {
  id: string
  error_type: string
  message: string
  severity: string
  status: string
  screen: string | null
  stack_trace: string | null
  context: Record<string, unknown> | null
  created_at: string
}

const severityTone: Record<string, Tone> = {
  fatal: 'critical', error: 'critical', warning: 'warning', info: 'intel',
}
const statusTone: Record<string, Tone> = {
  open: 'critical', resolved: 'healthy', ignored: 'intel',
}

export default function ErrorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [error, setError] = useState<DbError | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('errors')
      .select('id, error_type, message, severity, status, screen, stack_trace, context, created_at')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setError(data as DbError | null)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
  }

  if (!error) {
    return (
      <div className="space-y-4">
        <Link href="/errors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All errors
        </Link>
        <p className="text-muted-foreground">Error not found.</p>
      </div>
    )
  }

  const sevTone = severityTone[error.severity] ?? 'intel'
  const sTone = statusTone[error.status] ?? 'intel'
  const created = new Date(error.created_at).toLocaleString()

  return (
    <div className="space-y-6">
      <Link href="/errors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All errors
      </Link>

      <PageHeader
        icon={<Bug className="h-5 w-5 text-critical" />}
        title={error.message}
        desc={`${error.error_type} · ${created}`}
        actions={
          <div className="flex items-center gap-2">
            <ToneBadge tone={sevTone}>{error.severity}</ToneBadge>
            <ToneBadge tone={sTone}>{error.status}</ToneBadge>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Severity', value: error.severity, tone: sevTone },
          { label: 'Status', value: error.status, tone: sTone },
          { label: 'Type', value: error.error_type, tone: 'intel' as Tone },
          { label: 'Screen', value: error.screen ?? '—', tone: 'intel' as Tone },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={cn('mt-2 text-sm font-semibold', toneText[s.tone])}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHead title="Error Message" icon={<Bug className="h-4 w-4" />} />
            <div className="px-5 pb-5">
              <div className="rounded-lg border border-border/60 bg-background/60 p-4 font-mono text-sm break-all text-foreground/90">
                {error.message}
              </div>
            </div>
          </Card>

          {error.stack_trace && (
            <Card>
              <CardHead title="Stack Trace" icon={<Terminal className="h-4 w-4" />} />
              <div className="px-5 pb-5">
                <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-4 font-mono text-xs text-foreground/80 whitespace-pre-wrap break-all">
                  {error.stack_trace}
                </pre>
              </div>
            </Card>
          )}

          {error.context && Object.keys(error.context).length > 0 && (
            <Card>
              <CardHead title="Context" desc="Additional metadata captured at the time of the error" />
              <div className="px-5 pb-5">
                <div className="rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs">
                  {Object.entries(error.context).map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-0.5">
                      <span className="w-32 shrink-0 text-muted-foreground">{k}</span>
                      <span className="break-all text-foreground/90">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHead title="Details" />
            <div className="space-y-3 px-5 pb-5">
              {[
                { label: 'ID', value: error.id },
                { label: 'Type', value: error.error_type },
                { label: 'Severity', value: error.severity },
                { label: 'Status', value: error.status },
                { label: 'Screen', value: error.screen ?? '—' },
                { label: 'Captured', value: created },
              ].map((r) => (
                <div key={r.label} className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className="text-right text-xs font-medium text-foreground break-all max-w-[60%]">{r.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Status" />
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', toneBg[sTone], error.status === 'open' && 'animate-pulse-dot')} />
                <span className={cn('text-sm font-medium', toneText[sTone])}>{error.status}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
