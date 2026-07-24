'use client'

import { useState } from 'react'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, ToneBadge, PageHeader } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  SlidersHorizontal, Building2, Users, Bell, Shield, ChevronDown,
  Copy, Check, Plus, Trash2, Key, Eye, EyeOff, CheckCircle2,
  Mail, Hash, MessageSquare, Webhook, Globe, Layers,
  Route, Database, BarChart2, AlertTriangle, Hand, Zap,
  RefreshCw,
} from 'lucide-react'
import { useApprovalMode } from '@/components/dashboard/approval-policy'

type Tab = 'workspace' | 'team' | 'notifications' | 'security' | 'advanced'

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: 'workspace',     label: 'Workspace',     icon: Building2 },
  { id: 'team',          label: 'Team',           icon: Users },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'security',      label: 'Security',        icon: Shield },
  { id: 'advanced',      label: 'Advanced',        icon: SlidersHorizontal },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-healthy" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function SettingsRow({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-0.5">{value}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

type ToggleProps = { on: boolean; onChange: (v: boolean) => void }
function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        on ? 'bg-ai' : 'bg-border/60',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-4.5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

const NOTIFICATION_CHANNELS = [
  { id: 'email',   label: 'Email',              desc: 'Daily summaries and critical alerts',               icon: Mail,         defaultOn: true  },
  { id: 'slack',   label: 'Slack',              desc: 'Critical and high-severity incidents',              icon: Hash,         defaultOn: false },
  { id: 'teams',   label: 'Microsoft Teams',    desc: 'Team-wide alerts and escalations',                 icon: MessageSquare, defaultOn: false },
  { id: 'discord', label: 'Discord',            desc: 'Development team alerts',                          icon: Globe,        defaultOn: false },
  { id: 'webhook', label: 'Custom Webhook',     desc: 'All events — pipe to any external system',         icon: Webhook,      defaultOn: false },
]

const APPROVAL_MODES = [
  { id: 'advisory',   label: 'Advisory',      desc: 'AI detects and recommends only — no execution ever',                icon: Eye,  color: 'text-intel' },
  { id: 'assisted',   label: 'Assisted',      desc: 'Every action requires your approval before execution',              icon: Hand, color: 'text-ai' },
  { id: 'team',       label: 'Team Approval', desc: 'High-impact changes require two approvers',                         icon: Users, color: 'text-warning' },
  { id: 'autonomous', label: 'Autonomous',    desc: 'AI auto-resolves low-risk issues — you approve medium and high risk', icon: Zap,  color: 'text-healthy' },
]

export default function SettingsPage() {
  const { app } = useConnectedApp()
  const [tab, setTab]       = useState<Tab>('workspace')
  const [showKey, setShowKey] = useState(false)
  const [channels, setChannels] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [c.id, c.defaultOn]))
  )
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('Engineer')
  const [advOpen, setAdvOpen] = useState<Record<string, boolean>>({})
  const { mode: approvalMode, setMode: setApprovalMode } = useApprovalMode()

  const toggleAdv = (key: string) => setAdvOpen((p) => ({ ...p, [key]: !p[key] }))

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        icon={<SlidersHorizontal className="h-5 w-5" />}
        title="Settings"
        desc="Manage your workspace, team, notifications, and security preferences."
        actions={<ToneBadge tone="healthy" dot>Active</ToneBadge>}
      />

      <div className="flex flex-col gap-5 md:flex-row">
        {/* Sidebar nav */}
        <aside className="md:w-44 shrink-0">
          <nav className="rounded-xl border border-border/70 bg-card/60 p-1.5 space-y-0.5">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all',
                    tab === t.id
                      ? 'bg-intel/10 font-semibold text-intel'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Workspace ─────────────────────────────────────────────── */}
          {tab === 'workspace' && (
            <Card>
              <CardHead
                title="Workspace"
                desc="Basic information about this workspace."
                icon={<Building2 className="h-4 w-4 text-intel" />}
              />
              <div className="px-5 pb-5">
                <SettingsRow
                  label="Workspace name"
                  value={<p className="text-sm font-semibold text-foreground">{app.name}</p>}
                />
                <SettingsRow
                  label="Environment"
                  value={<ToneBadge tone="intel">{app.environment}</ToneBadge>}
                />
                <SettingsRow
                  label="Region"
                  value={<p className="text-sm text-foreground">EU West-1</p>}
                />
                <SettingsRow
                  label="Time zone"
                  value={<p className="text-sm text-foreground">UTC+2 (Africa/Johannesburg)</p>}
                />
                <SettingsRow
                  label="Markets"
                  value={<p className="text-sm text-foreground">{app.markets.join(' · ')}</p>}
                />
                <SettingsRow
                  label="Connected since"
                  value={<p className="text-sm text-foreground">{app.connectedSince}</p>}
                  action={<ToneBadge tone="healthy" dot>Active</ToneBadge>}
                />
                <SettingsRow
                  label="Project ID"
                  value={<code className="text-xs font-mono text-muted-foreground">{app.id}</code>}
                  action={<CopyButton text={app.id} />}
                />
              </div>
            </Card>
          )}

          {/* ── Team ──────────────────────────────────────────────────── */}
          {tab === 'team' && (
            <Card>
              <CardHead
                title="Team members"
                desc="Invite people and assign their access level."
                icon={<Users className="h-4 w-4 text-intel" />}
              />
              <div className="divide-y divide-border/40 px-5 pb-1">
                {app.team.map((member) => {
                  const roleTone = member.role === 'Admin' ? 'critical' : member.role === 'Engineer' ? 'intel' : member.role === 'Analyst' ? 'warning' : 'healthy'
                  return (
                    <div key={member.email} className="flex items-center gap-3 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-intel/10 text-intel font-semibold text-sm">
                        {member.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{member.email}</p>
                      </div>
                      <ToneBadge tone={roleTone}>{member.role}</ToneBadge>
                    </div>
                  )
                })}
              </div>

              {/* Invite row */}
              <div className="border-t border-border/40 px-5 py-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Invite a team member</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ai/30"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="rounded-lg border border-border/60 bg-background px-2 py-2 text-sm text-foreground focus:outline-none"
                  >
                    {['Admin', 'Engineer', 'Analyst', 'Viewer'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button
                    disabled={!inviteEmail}
                    className="flex items-center gap-1.5 rounded-lg border border-ai/30 bg-ai/10 px-3 py-2 text-xs font-semibold text-ai hover:bg-ai/20 disabled:opacity-40 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Invite
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    { role: 'Admin',    desc: 'Full access to all settings and data' },
                    { role: 'Engineer', desc: 'All technical pages — cannot change team' },
                    { role: 'Analyst',  desc: 'Read-only access to all dashboards' },
                    { role: 'Viewer',   desc: 'Overview page only' },
                  ].map((r) => (
                    <div key={r.role} className="rounded-lg border border-border/40 bg-background/40 px-2.5 py-2">
                      <p className="text-[10px] font-semibold text-foreground">{r.role}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* ── Notifications ─────────────────────────────────────────── */}
          {tab === 'notifications' && (
            <Card>
              <CardHead
                title="Notification channels"
                desc="Toggle which channels receive alerts. Critical incidents always reach all active channels."
                icon={<Bell className="h-4 w-4 text-intel" />}
              />
              <div className="divide-y divide-border/40 px-5 pb-5">
                {NOTIFICATION_CHANNELS.map((ch) => {
                  const Icon = ch.icon
                  const on   = channels[ch.id] ?? false
                  return (
                    <div key={ch.id} className="flex items-center gap-4 py-4">
                      <div className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                        on ? 'border-ai/30 bg-ai/10 text-ai' : 'border-border/50 bg-muted/40 text-muted-foreground',
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{ch.label}</p>
                        <p className="text-[10px] text-muted-foreground">{ch.desc}</p>
                      </div>
                      <Toggle on={on} onChange={(v) => setChannels((p) => ({ ...p, [ch.id]: v }))} />
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-border/40 px-5 py-4 rounded-b-xl bg-background/30">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground">
                    If a critical incident is not acknowledged within <span className="font-semibold text-foreground">10 minutes</span>, all Admin members are notified across every active channel simultaneously.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* ── Security ──────────────────────────────────────────────── */}
          {tab === 'security' && (
            <div className="space-y-4">
              {/* API Key */}
              <Card>
                <CardHead
                  title="API Key"
                  desc="Use this token to authenticate your SDK and API calls. Keep it secret."
                  icon={<Key className="h-4 w-4 text-intel" />}
                />
                <div className="px-5 pb-5 space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2.5">
                    <code className="flex-1 font-mono text-xs text-foreground">
                      {showKey ? app.apiKey : `${app.apiKey.slice(0, 12)}${'•'.repeat(24)}`}
                    </code>
                    <button
                      onClick={() => setShowKey((s) => !s)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <CopyButton text={app.apiKey} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                      <RefreshCw className="h-3 w-3" /> Rotate key
                    </button>
                    <p className="text-[10px] text-muted-foreground">Rotating generates a new key — update all SDK installations.</p>
                  </div>
                </div>
              </Card>

              {/* Approval policies */}
              <Card>
                <CardHead
                  title="AI Approval Policy"
                  desc="Control how much autonomy AI agents have when executing recommendations."
                  icon={<Shield className="h-4 w-4 text-intel" />}
                />
                <div className="space-y-2 px-5 pb-5">
                  {APPROVAL_MODES.map((m) => {
                    const Icon  = m.icon
                    const active = m.id === approvalMode
                    return (
                      <button
                        key={m.id}
                        onClick={() => setApprovalMode(m.id as typeof approvalMode)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                          active
                            ? 'border-ai/40 bg-ai/8 ring-1 ring-ai/20'
                            : 'border-border/50 bg-background/30 hover:bg-accent/30',
                        )}
                      >
                        <div className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border mt-0.5',
                          active ? 'border-ai/30 bg-ai/15 text-ai' : 'border-border/50 bg-muted/50 text-muted-foreground',
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-foreground">{m.label}</p>
                            {active && (
                              <div className="flex items-center gap-0.5 rounded-full bg-ai/15 px-1.5 py-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5 text-ai" />
                                <span className="text-[9px] font-bold text-ai">Active</span>
                              </div>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{m.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                  <p className="text-[10px] text-muted-foreground/60 px-1 pt-1">
                    Medium and high-risk actions always require human approval, regardless of mode.
                  </p>
                </div>
              </Card>

              {/* Audit */}
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-healthy/30 bg-healthy/10">
                    <CheckCircle2 className="h-4 w-4 text-healthy" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Audit Logging</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Every approval, rejection, fix execution, and team action is logged with a timestamp and actor. Logs are retained for 365 days and cannot be deleted.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── Advanced ──────────────────────────────────────────────── */}
          {tab === 'advanced' && (
            <div className="space-y-2">
              <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Advanced settings</span> — These configure how PAAQ Intelligence monitors your application. Changes here can affect what data is collected and how alerts are triggered. Most users never need to change these.
                </p>
              </div>

              {[
                {
                  id: 'areas', label: 'Feature Areas', icon: Layers,
                  content: (
                    <div className="divide-y divide-border/40">
                      {app.featureAreas.map((fa) => (
                        <div key={fa.id} className="flex items-center gap-3 py-3 px-5">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: fa.color }} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{fa.label}</p>
                            <p className="text-[10px] text-muted-foreground">{fa.id}</p>
                          </div>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', fa.softClass)}>Active</span>
                        </div>
                      ))}
                      <div className="px-5 py-3">
                        <button className="flex items-center gap-2 text-xs font-medium text-intel hover:underline">
                          <Plus className="h-3.5 w-3.5" /> Add feature area
                        </button>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'flows', label: 'Critical Flows', icon: Route,
                  content: (
                    <div className="divide-y divide-border/40">
                      {app.criticalFlows.map((flow) => {
                        const fa = app.featureAreas.find((a) => a.id === flow.featureAreaId)
                        return (
                          <div key={flow.id} className="px-5 py-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: fa?.color }} />
                              <p className="text-sm font-semibold text-foreground">{flow.name}</p>
                              <span className="text-[10px] text-muted-foreground">{flow.steps.length} steps</span>
                            </div>
                            <ol className="pl-4 space-y-1">
                              {flow.steps.map((s, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <span className="text-[9px] font-mono text-muted-foreground/40">{i + 1}.</span>
                                  {s.label}
                                  {s.isPaymentCritical && <span className="text-[9px] font-bold text-warning">Payment</span>}
                                  {s.isAuthCritical && <span className="text-[9px] font-bold text-critical">Auth</span>}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )
                      })}
                    </div>
                  ),
                },
                {
                  id: 'webhooks', label: 'Webhooks', icon: Webhook,
                  content: (
                    <div className="divide-y divide-border/40">
                      {app.webhookProviders.map((wp) => (
                        <div key={wp.id} className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-foreground">{wp.name}</p>
                            <ToneBadge tone="healthy" dot>Active</ToneBadge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{wp.purpose}</p>
                          <code className="mt-1.5 block text-[10px] font-mono text-muted-foreground/70">{wp.endpoint}</code>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: 'schema', label: 'Schema Mapping', icon: Database,
                  content: (
                    <div className="divide-y divide-border/40">
                      {app.schemaMappings.map((m) => (
                        <div key={m.category} className="px-5 py-3">
                          <p className="text-xs font-bold text-foreground mb-1.5">{m.category}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {m.tables.map((t) => (
                              <code key={t} className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{t}</code>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: 'signals', label: 'Custom Signals', icon: BarChart2,
                  content: (
                    <div className="divide-y divide-border/40">
                      {app.customSignals.map((s) => (
                        <div key={s.id} className="px-5 py-3">
                          <p className="text-sm font-semibold text-foreground">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                          <p className="text-[10px] font-semibold text-warning mt-1">{s.alertThreshold}</p>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  id: 'alerts', label: 'Alert Rules', icon: AlertTriangle,
                  content: (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/40">
                            <th className="px-5 py-2.5 text-left font-semibold text-muted-foreground">Feature Area</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Error Rate</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Drop-off</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Latency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {app.alertRules.map((rule) => {
                            const fa = app.featureAreas.find((a) => a.id === rule.featureAreaId)
                            return (
                              <tr key={rule.featureAreaId}>
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: fa?.color }} />
                                    <span className="font-semibold text-foreground">{fa?.label ?? rule.featureAreaId}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-warning">&gt;{rule.errorRateLimit}%</td>
                                <td className="px-3 py-3 text-right font-mono text-warning">&gt;{rule.dropOffRateLimit}%</td>
                                <td className="px-3 py-3 text-right font-mono text-warning">&gt;{rule.latencyLimitMs}ms</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ),
                },
              ].map(({ id, label, icon: Icon, content }) => (
                <div key={id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                  <button
                    onClick={() => toggleAdv(id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', advOpen[id] && 'rotate-180')} />
                  </button>
                  {advOpen[id] && (
                    <div className="border-t border-border/40 bg-background/20">
                      {content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
