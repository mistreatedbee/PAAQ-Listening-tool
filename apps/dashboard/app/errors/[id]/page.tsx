'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText, toneBg } from '@/lib/tones'
import { ArrowLeft, Bug, Terminal, CheckCircle2, EyeOff, Sparkles } from 'lucide-react'
import { GenerateFix } from '@/components/dashboard/generate-fix'
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
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

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

  const handleUpdateStatus = async (newStatus: string) => {
    if (!error || error.status === newStatus) return
    setUpdating(true)
    const sb = createClient()
    const { error: dbErr } = await sb.from('errors').update({ status: newStatus }).eq('id', id)
    if (!dbErr) {
      setError({ ...error, status: newStatus })
      showToast(`Error marked as ${newStatus}`)
    }
    setUpdating(false)
  }

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
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <Link href="/errors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All errors
      </Link>

      <PageHeader
        icon={<Bug className="h-5 w-5 text-critical" />}
        title={error.message}
        desc={`${error.error_type} · ${created}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={sevTone}>{error.severity}</ToneBadge>
            <ToneBadge tone={sTone}>{error.status}</ToneBadge>
            {error.status !== 'resolved' && (
              <button
                onClick={() => handleUpdateStatus('resolved')}
                disabled={updating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-healthy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {updating ? 'Updating…' : 'Mark resolved'}
              </button>
            )}
            {error.status === 'open' && (
              <button
                onClick={() => handleUpdateStatus('ignored')}
                disabled={updating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Ignore
              </button>
            )}
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

      {/* AI Fix — shown for open/unresolved errors */}
      {error.status !== 'resolved' && (
        <Card>
          <CardHead
            title="Generate Fix"
            desc="AI agent analyses the error and returns root cause, fix steps, and a code example"
            icon={<Sparkles className="h-4 w-4 text-ai" />}
          />
          <div className="px-5 pb-5">
            <GenerateFix
              payload={{
                errorId: error.id,
                message: error.message,
                errorType: error.error_type,
                severity: error.severity,
                screen: error.screen,
                stackTrace: error.stack_trace,
                context: error.context,
              }}
            />
          </div>
        </Card>
      )}

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
