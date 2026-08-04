import { Card, CardHead, ToneBadge } from '@/components/kit'
import type { Tone } from '@/lib/data'
import { User, Smartphone, Globe, LayoutGrid, Zap } from 'lucide-react'

export type SessionRow = {
  id: string
  user_id: string | null
  started_at: string
  ended_at: string | null
  duration: number | null
  status: string
  outcome: string | null
  platform: string | null
  browser_name: string | null
  browser_version: string | null
  os_name: string | null
  os_version: string | null
  device_type: string | null
  device_model: string | null
  screen_width: number | null
  screen_height: number | null
  timezone: string | null
  locale: string | null
  app_version: string | null
  entry_url: string | null
  active_seconds: number | null
  idle_seconds: number | null
  time_to_first_interaction_ms: number | null
  page_count: number | null
  interaction_count: number | null
  rage_click_count: number | null
  dead_click_count: number | null
  form_abandon_count: number | null
}

export type SessionUser = {
  id: string
  external_user_id: string | null
  email: string | null
  created_at: string
}

const outcomeTone: Record<string, Tone> = {
  completed: 'healthy',
  abandoned: 'warning',
  timed_out: 'warning',
  logged_out: 'intel',
  crashed: 'critical',
  force_closed: 'critical',
}

function fmtDuration(seconds: number | null) {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function fmtMs(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

export function SessionOverviewCard({
  session,
  user,
  isReturning,
  lifetimeSessionCount,
  environment,
}: {
  session: SessionRow
  user: SessionUser | null
  isReturning: boolean | null
  lifetimeSessionCount: number | null
  environment: string | null
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHead title="User" icon={<User className="h-4 w-4" />} />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <Field label="Identity" value={user?.external_user_id ?? 'Anonymous'} />
          <Field label="Email" value={user?.email ?? '—'} />
          <Field label="Type" value={isReturning == null ? '—' : isReturning ? 'Returning' : 'New'} />
          <Field label="Lifetime sessions" value={lifetimeSessionCount != null ? String(lifetimeSessionCount) : '—'} />
        </div>
      </Card>

      <Card>
        <CardHead
          title="Session"
          icon={<LayoutGrid className="h-4 w-4" />}
          action={<ToneBadge tone={outcomeTone[session.outcome ?? ''] ?? 'intel'}>{session.outcome ?? session.status}</ToneBadge>}
        />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <Field label="Started" value={new Date(session.started_at).toLocaleString()} />
          <Field label="Duration" value={fmtDuration(session.duration)} />
          <Field label="Active time" value={fmtDuration(session.active_seconds)} />
          <Field label="Idle time" value={fmtDuration(session.idle_seconds)} />
          <Field label="Time to first interaction" value={fmtMs(session.time_to_first_interaction_ms)} />
          <Field label="Pages / interactions" value={`${session.page_count ?? 0} / ${session.interaction_count ?? 0}`} />
        </div>
      </Card>

      <Card>
        <CardHead title="Device" icon={<Smartphone className="h-4 w-4" />} />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <Field label="Type" value={session.device_type ?? '—'} />
          <Field label="Model" value={session.device_model ?? '—'} />
          <Field label="OS" value={session.os_name ? `${session.os_name} ${session.os_version ?? ''}`.trim() : '—'} />
          <Field label="Screen" value={session.screen_width && session.screen_height ? `${session.screen_width}×${session.screen_height}` : '—'} />
          <Field label="Timezone" value={session.timezone ?? '—'} />
          <Field label="Locale" value={session.locale ?? '—'} />
        </div>
      </Card>

      <Card>
        <CardHead title="App" icon={<Globe className="h-4 w-4" />} />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <Field label="Platform" value={session.platform ?? '—'} />
          <Field label="Browser" value={session.browser_name ? `${session.browser_name} ${session.browser_version ?? ''}`.trim() : '—'} />
          <Field label="App version" value={session.app_version ?? '—'} />
          <Field label="Environment" value={environment ?? '—'} />
          <div className="col-span-2">
            <Field label="Entry URL" value={session.entry_url ?? '—'} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Behavior" icon={<Zap className="h-4 w-4" />} />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <Field label="Rage clicks" value={String(session.rage_click_count ?? 0)} />
          <Field label="Dead clicks" value={String(session.dead_click_count ?? 0)} />
          <Field label="Forms abandoned" value={String(session.form_abandon_count ?? 0)} />
        </div>
      </Card>
    </div>
  )
}
