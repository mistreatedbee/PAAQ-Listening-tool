'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { PageHeader, Card, CardHead, ToneBadge, ProgressRing } from '@/components/kit'
import { useBulkSelection, RowCheckbox, BulkActionsBar, ConfirmDeleteDialog } from '@/components/kit-bulk-actions'
import { JourneyMap, type JourneyMapNode, type JourneyMapEdge } from '@/components/journey/journey-map'
import {
  Route, RefreshCw, Users, CheckCircle2, XCircle, Clock, TimerReset, Skull, Flame,
  Smartphone, Monitor, Tablet, AlertTriangle, ExternalLink, Filter, Gauge, GitPullRequest, Rocket, Bug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

// ── Types ────────────────────────────────────────────────────────────────
type Metrics = {
  totalSessions: number
  activeUsers: number
  completionPct: number | null
  abandonmentPct: number | null
  avgDurationSeconds: number | null
  avgTimeToCompletionSeconds: number | null
  topDropOffPage: string | null
  highestFrictionPage: string | null
}

type PathStat = {
  signature: string
  steps: string[]
  sessionCount: number
  completedCount: number
  abandonedCount: number
  completionRate: number
  errorDensity: number
}

type AnalyticsResult = {
  ok: boolean
  metrics: Metrics
  journeyHealthScore: number | null
  journeyMap: { nodes: JourneyMapNode[]; edges: JourneyMapEdge[] }
  paths: { common: PathStat[]; abandoned: PathStat[]; successful: PathStat[]; problematic: PathStat[] }
  deviceIntel: {
    platform: { value: string; count: number; pct: number }[]
    deviceType: { value: string; count: number; pct: number }[]
    osName: { value: string; count: number; pct: number }[]
    browserName: { value: string; count: number; pct: number }[]
  }
  errorCorrelation: { screen: string; count: number }[]
}

type SessionListRow = {
  id: string
  user_id: string | null
  started_at: string
  duration: number | null
  status: string
  outcome: string | null
  platform: string | null
  device_type: string | null
  os_name: string | null
  browser_name: string | null
  rage_click_count: number
  dead_click_count: number
  page_count: number | null
}

type UserMeta = { id: string; external_user_id: string; email: string | null }

const outcomeTone: Record<string, Tone> = {
  completed: 'healthy', abandoned: 'warning', timed_out: 'warning',
  logged_out: 'intel', crashed: 'critical', force_closed: 'critical',
}
const deviceIcon: Record<string, typeof Monitor> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet }

const RANGE_OPTIONS = [
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: '90d', label: '90d', ms: 90 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All time', ms: null as number | null },
] as const

function fmtDuration(seconds: number | null) {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  return `${m}m ${seconds % 60}s`
}

function healthTone(score: number | null): Tone {
  if (score == null) return 'intel'
  if (score >= 75) return 'healthy'
  if (score >= 50) return 'warning'
  return 'critical'
}

export default function UserJourneyPage() {
  const { app } = useConnectedApp()
  const router = useRouter()

  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]['id']>('30d')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [deviceFilter, setDeviceFilter] = useState<string>('all')
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all')
  const [hasErrorFilter, setHasErrorFilter] = useState(false)
  const [pageFilter, setPageFilter] = useState('')

  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  const [sessions, setSessions] = useState<SessionListRow[]>([])
  const [users, setUsers] = useState<Record<string, UserMeta>>({})
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const [pathTab, setPathTab] = useState<'common' | 'abandoned' | 'successful' | 'problematic'>('common')
  const bulk = useBulkSelection()
  const [confirmMode, setConfirmMode] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filters = useMemo(() => {
    const opt = RANGE_OPTIONS.find((r) => r.id === range)!
    return {
      from: opt.ms ? new Date(Date.now() - opt.ms).toISOString() : undefined,
      platform: platformFilter === 'all' ? undefined : platformFilter,
      deviceType: deviceFilter === 'all' ? undefined : deviceFilter,
      outcome: outcomeFilter === 'all' ? undefined : outcomeFilter,
      hasError: hasErrorFilter || undefined,
      page: pageFilter.trim() || undefined,
    }
  }, [range, platformFilter, deviceFilter, outcomeFilter, hasErrorFilter, pageFilter])

  // ── Aggregate analytics (health score, metrics, map, paths, device, errors) ──
  const fetchAnalytics = async () => {
    if (app.id === '__loading__') return
    setAnalyticsLoading(true)
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/journey-analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ project_id: app.id, filters }),
    }).then((r) => r.json()).catch(() => null)
    if (res?.ok) setAnalytics(res)
    setAnalyticsLoading(false)
  }

  useEffect(() => { void fetchAnalytics() }, [app.id, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session Explorer: live query against real sessions, same filters ────
  useEffect(() => {
    if (app.id === '__loading__') return
    setSessionsLoading(true)
    const sb = createClient()
    let q = sb.from('sessions')
      .select('id, user_id, started_at, duration, status, outcome, platform, device_type, os_name, browser_name, rage_click_count, dead_click_count, page_count')
      .eq('project_id', app.id)
      .order('started_at', { ascending: false })
      .limit(200)
    if (filters.from) q = q.gte('started_at', filters.from)
    if (filters.platform) q = q.eq('platform', filters.platform)
    if (filters.deviceType) q = q.eq('device_type', filters.deviceType)
    if (filters.outcome) q = q.eq('outcome', filters.outcome)
    q.then(async ({ data }) => {
      const rows = (data ?? []) as SessionListRow[]
      setSessions(rows)
      setSessionsLoading(false)
      const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))]
      if (userIds.length > 0) {
        const { data: userRows } = await sb.from('users').select('id, external_user_id, email').in('id', userIds)
        const map: Record<string, UserMeta> = {}
        for (const u of (userRows ?? []) as UserMeta[]) map[u.id] = u
        setUsers(map)
      } else {
        setUsers({})
      }
    })
  }, [app.id, filters.from, filters.platform, filters.deviceType, filters.outcome])

  const platforms = [...new Set(sessions.map((s) => s.platform).filter(Boolean))] as string[]
  const devices = [...new Set(sessions.map((s) => s.device_type).filter(Boolean))] as string[]

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const sb = createClient()
    if (confirmMode === 'selected') {
      await sb.from('sessions').delete().in('id', [...bulk.selected])
      setSessions((prev) => prev.filter((s) => !bulk.selected.has(s.id)))
      bulk.clear()
    } else if (confirmMode === 'all') {
      await sb.from('sessions').delete().eq('project_id', app.id)
      setSessions([])
      bulk.clear()
    }
    setDeleting(false)
    setConfirmMode(null)
    void fetchAnalytics()
  }

  const m = analytics?.metrics
  const health = analytics?.journeyHealthScore ?? null
  const pathList = analytics?.paths[pathTab] ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Route className="h-5 w-5" />}
        title="User Journey Explorer"
        desc="Real, live-computed cohort intelligence — health score, funnels, and paths across every captured session. No cached snapshots."
        actions={
          <button
            onClick={() => void fetchAnalytics()}
            disabled={analyticsLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', analyticsLoading && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {/* Health score + Key Metrics */}
      <div className="grid gap-3 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={health ?? 0} tone={healthTone(health)} size={72} stroke={6} label="Health" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Journey Health Score</p>
            <p className="mt-0.5 text-2xl font-semibold text-foreground">{health != null ? `${health}/100` : '—'}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Completion, friction, errors &amp; AI drop-off risk, weighted</p>
          </div>
        </Card>

        <MetricCard icon={<Users className="h-4 w-4" />} label="Total sessions / active users" value={m ? `${m.totalSessions}` : '—'} sub={m ? `${m.activeUsers} active users` : undefined} />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Completion rate" value={m?.completionPct != null ? `${m.completionPct}%` : '—'} tone="healthy" />
        <MetricCard icon={<XCircle className="h-4 w-4" />} label="Abandonment rate" value={m?.abandonmentPct != null ? `${m.abandonmentPct}%` : '—'} tone="warning" />

        <MetricCard icon={<Clock className="h-4 w-4" />} label="Avg session duration" value={fmtDuration(m?.avgDurationSeconds ?? null)} />
        <MetricCard icon={<TimerReset className="h-4 w-4" />} label="Avg time-to-completion" value={fmtDuration(m?.avgTimeToCompletionSeconds ?? null)} />
        <MetricCard icon={<Skull className="h-4 w-4" />} label="Top drop-off page" value={m?.topDropOffPage ?? '—'} mono />
        <MetricCard icon={<Flame className="h-4 w-4" />} label="Highest-friction page" value={m?.highestFrictionPage ?? '—'} tone="critical" mono />
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <FilterGroup options={RANGE_OPTIONS.map((r) => ({ id: r.id, label: r.label }))} value={range} onChange={(v) => setRange(v as typeof range)} />
        {platforms.length > 0 && <FilterGroup options={[{ id: 'all', label: 'All platforms' }, ...platforms.map((p) => ({ id: p, label: p }))]} value={platformFilter} onChange={setPlatformFilter} />}
        {devices.length > 0 && <FilterGroup options={[{ id: 'all', label: 'All devices' }, ...devices.map((d) => ({ id: d, label: d }))]} value={deviceFilter} onChange={setDeviceFilter} />}
        <FilterGroup options={[{ id: 'all', label: 'All outcomes' }, { id: 'completed', label: 'Completed' }, { id: 'abandoned', label: 'Abandoned' }, { id: 'crashed', label: 'Crashed' }]} value={outcomeFilter} onChange={setOutcomeFilter} />
        <button
          onClick={() => setHasErrorFilter((v) => !v)}
          className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors', hasErrorFilter ? 'bg-critical text-white' : 'text-muted-foreground hover:text-foreground')}
        >
          <AlertTriangle className="h-3 w-3" /> Has errors
        </button>
        <input
          value={pageFilter}
          onChange={(e) => setPageFilter(e.target.value)}
          placeholder="Filter by page path…"
          className="ml-auto w-48 rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ai/30"
        />
      </Card>

      {/* Visual Journey Map */}
      {analytics && <JourneyMap nodes={analytics.journeyMap.nodes} edges={analytics.journeyMap.edges} />}

      {/* Path Analytics */}
      {analytics && (
        <Card>
          <CardHead
            title="Journey Path Analytics"
            desc="Real multi-session paths, grouped by identical page sequences."
            action={
              <div className="flex gap-1">
                {(['common', 'abandoned', 'successful', 'problematic'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPathTab(t)}
                    className={cn('rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors', pathTab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            }
          />
          <div className="space-y-2 px-5 pb-5">
            {pathList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No {pathTab} paths with enough sessions in this range yet.</p>
            ) : (
              pathList.map((p) => (
                <div key={p.signature} className="rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-foreground">
                    {p.steps.map((step, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-muted-foreground">→</span>}
                        {step}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{p.sessionCount} sessions</span>
                    <span>{p.completionRate}% completed</span>
                    {p.abandonedCount > 0 && <span className="text-warning">{p.abandonedCount} abandoned</span>}
                    {p.errorDensity > 0 && <span className="text-critical">{p.errorDensity} errors/session</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Device Intelligence */}
      {analytics && (
        <Card>
          <CardHead title="Device Intelligence" desc="Real platform/device/OS/browser mix for sessions in this range." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
            <DeviceRollup title="Platform" rows={analytics.deviceIntel.platform} />
            <DeviceRollup title="Device type" rows={analytics.deviceIntel.deviceType} />
            <DeviceRollup title="OS" rows={analytics.deviceIntel.osName} />
            <DeviceRollup title="Browser" rows={analytics.deviceIntel.browserName} />
          </div>
        </Card>
      )}

      {/* Session Explorer */}
      <Card>
        <CardHead
          title="Session Explorer"
          desc="Every real session in this range — click through for full replay, timeline and AI summary."
        />
        {!sessionsLoading && sessions.length > 0 && (
          <div className="px-5 pb-3">
            <BulkActionsBar
              selectedCount={bulk.count}
              totalCount={sessions.length}
              itemLabel="session"
              onDeleteSelected={() => setConfirmMode('selected')}
              onClearAll={() => setConfirmMode('all')}
              onDeselectAll={bulk.clear}
            />
          </div>
        )}
        <ConfirmDeleteDialog
          open={confirmMode !== null}
          loading={deleting}
          title={confirmMode === 'all' ? 'Delete all sessions?' : `Delete ${bulk.count} session${bulk.count === 1 ? '' : 's'}?`}
          description={confirmMode === 'all'
            ? `This permanently deletes all ${sessions.length} sessions in scope, along with their pages, events, errors, and AI summaries. This can't be undone.`
            : `This permanently deletes the selected session(s), along with their pages, events, errors, and AI summaries. This can't be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmMode(null)}
        />
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Route className="h-8 w-8 opacity-20" />
            <p className="text-sm">No sessions match these filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {sessions.slice(0, 50).map((s) => {
              const Icon = deviceIcon[s.device_type ?? ''] ?? Monitor
              const user = s.user_id ? users[s.user_id] : undefined
              return (
                <button
                  key={s.id}
                  onClick={() => router.push(`/sessions/${s.id}`)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/20"
                >
                  <RowCheckbox checked={bulk.isSelected(s.id)} onChange={() => bulk.toggle(s.id)} />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ToneBadge tone={outcomeTone[s.outcome ?? ''] ?? 'intel'}>{s.outcome ?? s.status}</ToneBadge>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email ?? user?.external_user_id ?? 'Anonymous'} · {[s.platform, s.os_name, s.browser_name].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground">{new Date(s.started_at).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {(s.rage_click_count > 0 || s.dead_click_count > 0) && (
                      <ToneBadge tone="warning" dot>Friction</ToneBadge>
                    )}
                    <span>{fmtDuration(s.duration)}</span>
                    <span>{s.page_count ?? 0} pages</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {/* Error correlation */}
      {analytics && analytics.errorCorrelation.length > 0 && (
        <Card>
          <CardHead icon={<Bug className="h-4 w-4" />} title="Error Correlation" desc="Real errors, grouped by the page/screen they occurred on." action={
            <Link href="/errors" className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
              <ExternalLink className="h-3.5 w-3.5" /> Error Tracking
            </Link>
          } />
          <div className="flex flex-wrap gap-1.5 px-5 pb-5">
            {analytics.errorCorrelation.map((e) => (
              <ToneBadge key={e.screen} tone="critical">{e.screen} · {e.count}</ToneBadge>
            ))}
          </div>
        </Card>
      )}

      {/* Connections to other modules */}
      <Card className="flex flex-wrap items-center gap-2 px-5 py-4">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Related intelligence:</span>
        {[
          { href: '/errors', label: 'Error Tracking', icon: Bug },
          { href: '/performance', label: 'Performance Monitoring', icon: Gauge },
          { href: '/deployments', label: 'Deployment Intelligence', icon: Rocket },
          { href: '/recommendations', label: 'AI Recommendations', icon: GitPullRequest },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent">
            <l.icon className="h-3.5 w-3.5" /> {l.label}
          </Link>
        ))}
      </Card>
    </div>
  )
}

function MetricCard({ icon, label, value, sub, tone = 'intel', mono }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: Tone; mono?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className={cn('mt-1.5 truncate text-xl font-semibold', mono ? 'font-mono text-base text-foreground' : tone === 'critical' ? 'text-critical' : tone === 'healthy' ? 'text-healthy' : tone === 'warning' ? 'text-warning' : 'text-foreground')}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  )
}

function FilterGroup({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn('rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors', value === o.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function DeviceRollup({ title, rows }: { title: string; rows: { value: string; count: number; pct: number }[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <div className="space-y-1">
          {rows.slice(0, 5).map((r) => (
            <div key={r.value} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{r.value}</span>
              <span className="shrink-0 text-muted-foreground">{r.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
