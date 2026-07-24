'use client'

import { useState } from 'react'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, ToneBadge, PageHeader } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  Settings, Key, Layers, Route, Webhook, Database, BarChart2,
  Bell, Users, AlertTriangle, CheckCircle2, WifiOff, Wifi,
  Copy, Check, RefreshCw, Plus, Trash2, Terminal, Code2, Globe,
} from 'lucide-react'

type SettingsTab = {
  id: string
  label: string
  icon: typeof Settings
}

const TABS: SettingsTab[] = [
  { id: 'app',       label: 'App Registration',    icon: Key },
  { id: 'areas',     label: 'Feature Areas',        icon: Layers },
  { id: 'flows',     label: 'Critical Flows',       icon: Route },
  { id: 'webhooks',  label: 'Webhooks',             icon: Webhook },
  { id: 'schema',    label: 'Schema Map',           icon: Database },
  { id: 'signals',   label: 'Custom Signals',       icon: BarChart2 },
  { id: 'alerts',    label: 'Alert Rules',          icon: AlertTriangle },
  { id: 'team',      label: 'Team',                 icon: Users },
  { id: 'channels',  label: 'Notifications',        icon: Bell },
  { id: 'integrations', label: 'Integration Health', icon: Wifi },
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

function SdkStatusBadge({ status }: { status: 'connected' | 'disconnected' | 'degraded' }) {
  if (status === 'connected') return <ToneBadge tone="healthy" dot>Connected</ToneBadge>
  if (status === 'degraded') return <ToneBadge tone="warning" dot>Degraded</ToneBadge>
  return <ToneBadge tone="critical" dot>Disconnected</ToneBadge>
}

export default function SettingsPage() {
  const { app, allApps } = useConnectedApp()
  const [activeTab, setActiveTab] = useState('app')

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Settings className="h-5 w-5" />}
        title="Settings"
        desc="Configure connected digital products, feature areas, critical flows, integrations, alert rules, and team access."
        actions={
          <ToneBadge tone="intel" dot>
            {allApps.length} digital product{allApps.length !== 1 ? 's' : ''} connected
          </ToneBadge>
        }
      />

      <div className="flex flex-col gap-5 xl:flex-row">
        {/* Settings sub-nav */}
        <aside className="xl:w-52 shrink-0">
          <nav className="rounded-xl border border-border/70 bg-card/60 p-1.5">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all',
                    activeTab === t.id
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

        {/* Settings content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── App Registration ── */}
          {activeTab === 'app' && (
            <>
              <Card>
                <CardHead
                  title="App Registration"
                  desc="This is your connected digital product's identity within PAAQ Intelligence. Each project gets its own API key and environment."
                  icon={<Key className="h-4 w-4 text-intel" />}
                />
                <div className="divide-y divide-border/40 px-5 pb-5">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">App Name</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{app.name}</p>
                    </div>
                    <ToneBadge tone="intel">{app.environment}</ToneBadge>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">App ID</p>
                      <code className="text-xs text-muted-foreground font-mono">{app.id}</code>
                    </div>
                    <CopyButton text={app.id} />
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">API Key</p>
                      <code className="text-xs text-muted-foreground font-mono">{app.apiKey.slice(0, 16)}••••••••</code>
                    </div>
                    <CopyButton text={app.apiKey} />
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Connected Since</p>
                      <p className="text-xs text-muted-foreground">{app.connectedSince}</p>
                    </div>
                    <ToneBadge tone="healthy" dot>Active</ToneBadge>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Markets</p>
                      <p className="text-xs text-muted-foreground">{app.markets.join(' · ')}</p>
                    </div>
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>

              <Card>
                <CardHead
                  title="SDK Initialisation"
                  desc="Drop this into your frontend to start sending events immediately."
                  icon={<Terminal className="h-4 w-4 text-ai" />}
                />
                <div className="space-y-4 px-5 pb-5">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Web SDK (React / Next.js / Vue)</p>
                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-4 font-mono text-xs text-foreground whitespace-pre-wrap">{`import { PAAQProvider } from '@paaq/web-sdk';

<PAAQProvider sdkToken="${app.apiKey}" projectId="${app.id}">
  <YourApp />
</PAAQProvider>`}</pre>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mobile SDK (Flutter / React Native)</p>
                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-4 font-mono text-xs text-foreground whitespace-pre-wrap">{`// flutter pub add paaq_mobile_sdk
await PAAQ.initialize(
  sdkToken: '${app.apiKey}',
  projectId: '${app.id}',
);`}</pre>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Server SDK (Node.js / Python / Go)</p>
                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-4 font-mono text-xs text-foreground whitespace-pre-wrap">{`import { PAAQ } from '@paaq/server-sdk';

PAAQ.initialize({
  sdkToken: '${app.apiKey}',
  projectId: '${app.id}',
});
app.use(PAAQ.middleware());`}</pre>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Database Connector (PostgreSQL / Supabase)</p>
                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-4 font-mono text-xs text-foreground whitespace-pre-wrap">{`PAAQListening.connectDatabase({
  type: 'postgresql',
  connectionString: 'your-read-only-connection-string',
  schemaMapping: {
${app.schemaMappings.map((m) => `    ${m.category.toLowerCase()}: '${m.tables[0]}'`).join(',\n')},
  },
});`}</pre>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* ── Feature Areas ── */}
          {activeTab === 'areas' && (
            <Card>
              <CardHead
                title="Feature Areas"
                desc={`${app.name} has registered ${app.featureAreas.length} feature areas. These names appear throughout every tab.`}
                icon={<Layers className="h-4 w-4 text-intel" />}
              />
              <div className="divide-y divide-border/40 px-5 pb-5">
                {app.featureAreas.map((fa) => (
                  <div key={fa.id} className="flex items-center gap-3 py-3">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: fa.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{fa.label}</p>
                      <p className="text-xs text-muted-foreground">ID: {fa.id}</p>
                    </div>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', fa.softClass)}>
                      Active
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/40 px-5 py-3">
                <button className="flex items-center gap-2 text-xs font-medium text-intel hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Add feature area
                </button>
              </div>
            </Card>
          )}

          {/* ── Critical Flows ── */}
          {activeTab === 'flows' && (
            <div className="space-y-4">
              {app.criticalFlows.map((flow) => {
                const fa = app.featureAreas.find((a) => a.id === flow.featureAreaId)
                return (
                  <Card key={flow.id}>
                    <CardHead
                      title={flow.name}
                      desc={`${flow.steps.length} steps · Feature area: ${fa?.label ?? flow.featureAreaId}`}
                      icon={<Route className="h-4 w-4 text-intel" />}
                    />
                    <div className="px-5 pb-5">
                      <ol className="relative border-l border-border/40 space-y-3 ml-2">
                        {flow.steps.map((step, i) => (
                          <li key={i} className="pl-5 relative">
                            <span
                              className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background"
                              style={{ backgroundColor: step.isPaymentCritical ? '#F59E0B' : step.isAuthCritical ? '#EF4444' : fa?.color ?? '#51C9D3' }}
                            />
                            <p className="text-xs font-medium text-foreground">{step.label}</p>
                            <div className="flex gap-1 mt-0.5">
                              {step.isPaymentCritical && (
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-warning">Payment Critical</span>
                              )}
                              {step.isAuthCritical && (
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-critical">Auth Critical</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </Card>
                )
              })}
              <button className="flex items-center gap-2 text-xs font-medium text-intel hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add critical flow
              </button>
            </div>
          )}

          {/* ── Webhooks ── */}
          {activeTab === 'webhooks' && (
            <Card>
              <CardHead
                title="Webhook Registry"
                desc={`${app.name} has registered ${app.webhookProviders.length} webhook provider${app.webhookProviders.length !== 1 ? 's' : ''}. The tool monitors delivery rates and failure patterns for each.`}
                icon={<Webhook className="h-4 w-4 text-intel" />}
              />
              <div className="divide-y divide-border/40 px-5 pb-5">
                {app.webhookProviders.map((wp) => (
                  <div key={wp.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-intel/10 text-intel font-bold text-xs">
                        {wp.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{wp.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{wp.purpose}</p>
                      </div>
                      <ToneBadge tone="healthy" dot>Active</ToneBadge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 rounded border border-border/60 bg-muted/60 px-2 py-1 font-mono text-xs text-muted-foreground truncate">
                        {wp.endpoint}
                      </code>
                      <CopyButton text={wp.endpoint} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/40 px-5 py-3">
                <button className="flex items-center gap-2 text-xs font-medium text-intel hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Add webhook provider
                </button>
              </div>
            </Card>
          )}

          {/* ── Schema Map ── */}
          {activeTab === 'schema' && (
            <Card>
              <CardHead
                title="Schema Mapper"
                desc="Read-only mapping of the connected app's database tables to the tool's monitoring categories. The tool never writes to your database."
                icon={<Database className="h-4 w-4 text-intel" />}
              />
              <div className="divide-y divide-border/40 px-5 pb-5">
                {app.schemaMappings.map((m) => (
                  <div key={m.category} className="py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-foreground">{m.category}</span>
                      <span className="text-[10px] text-muted-foreground">({m.tables.length} table{m.tables.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.tables.map((t) => (
                        <code key={t} className="rounded border border-border/60 bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {t}
                        </code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Custom Signals ── */}
          {activeTab === 'signals' && (
            <Card>
              <CardHead
                title="Custom Signal Tracker"
                desc="App-specific metrics that aren't covered by the default monitoring. The tool raises an alert when any threshold is crossed."
                icon={<BarChart2 className="h-4 w-4 text-intel" />}
              />
              <div className="divide-y divide-border/40 px-5 pb-5">
                {app.customSignals.map((s) => (
                  <div key={s.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                      </div>
                      <ToneBadge tone="healthy" dot>Tracking</ToneBadge>
                    </div>
                    <p className="mt-1.5 text-[10px] font-semibold text-warning">{s.alertThreshold}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/40 px-5 py-3">
                <button className="flex items-center gap-2 text-xs font-medium text-intel hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Add custom signal
                </button>
              </div>
            </Card>
          )}

          {/* ── Alert Rules ── */}
          {activeTab === 'alerts' && (
            <Card>
              <CardHead
                title="Alert Rules"
                desc="Per-feature-area thresholds. When any metric crosses its limit for more than 60 seconds, the Incident Investigator agent opens an incident automatically."
                icon={<AlertTriangle className="h-4 w-4 text-intel" />}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="px-5 py-2.5 text-left font-semibold text-muted-foreground">Feature Area</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Error Rate</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Drop-off</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Latency</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Payment Fail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {app.alertRules.map((rule) => {
                      const fa = app.featureAreas.find((a) => a.id === rule.featureAreaId)
                      return (
                        <tr key={rule.featureAreaId}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: fa?.color }} />
                              <span className="font-semibold text-foreground">{fa?.label ?? rule.featureAreaId}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-warning">&gt;{rule.errorRateLimit}%</td>
                          <td className="px-3 py-3 text-right font-mono text-warning">&gt;{rule.dropOffRateLimit}%</td>
                          <td className="px-3 py-3 text-right font-mono text-warning">&gt;{rule.latencyLimitMs}ms</td>
                          <td className="px-3 py-3 text-right font-mono">
                            {rule.paymentFailureLimit > 0
                              ? <span className="text-critical">&gt;{rule.paymentFailureLimit}%</span>
                              : <span className="text-muted-foreground">N/A</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ── Team ── */}
          {activeTab === 'team' && (
            <Card>
              <CardHead
                title="Team & Permissions"
                desc="Team members and their access levels. Admins can change any setting. Engineers see all technical tabs. Analysts can read but not configure. Viewers see Overview only."
                icon={<Users className="h-4 w-4 text-intel" />}
              />
              <div className="divide-y divide-border/40 px-5 pb-5">
                {app.team.map((member) => (
                  <div key={member.email} className="flex items-center gap-3 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-intel/10 text-intel font-semibold text-sm">
                      {member.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{member.email}</p>
                    </div>
                    <ToneBadge
                      tone={member.role === 'Admin' ? 'critical' : member.role === 'Engineer' ? 'intel' : member.role === 'Analyst' ? 'warning' : 'healthy'}
                    >
                      {member.role}
                    </ToneBadge>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/40 px-5 py-3">
                <button className="flex items-center gap-2 text-xs font-medium text-intel hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Invite team member
                </button>
              </div>
            </Card>
          )}

          {/* ── Notification Channels ── */}
          {activeTab === 'channels' && (
            <div className="space-y-4">
              <Card>
                <CardHead
                  title="Notification Channels"
                  desc="Where PAAQ Intelligence sends alerts. Each channel can be scoped to specific severity levels."
                  icon={<Bell className="h-4 w-4 text-intel" />}
                />
                <div className="divide-y divide-border/40 px-5 pb-5">
                  {[
                    { name: 'Slack', scope: 'Critical + High severity — immediate', status: 'connected' as const, icon: '#' },
                    { name: 'Email digest', scope: 'All severities — daily summary', status: 'connected' as const, icon: '@' },
                    { name: 'Custom webhook', scope: 'All events — external processing', status: 'disconnected' as const, icon: '⚡' },
                  ].map((ch) => (
                    <div key={ch.name} className="flex items-center gap-3 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                        {ch.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{ch.name}</p>
                        <p className="text-[10px] text-muted-foreground">{ch.scope}</p>
                      </div>
                      <SdkStatusBadge status={ch.status} />
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHead
                  title="Alert Escalation"
                  desc="What happens if a critical incident is not acknowledged within the escalation window."
                />
                <div className="px-5 pb-5 space-y-3">
                  <div className="rounded-lg border border-border/50 bg-background/30 p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-critical" />
                      <span className="text-xs font-semibold text-foreground">Critical incident unacknowledged</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      If not acknowledged within <strong className="text-foreground">10 minutes</strong>, all Admin role members are notified via every connected channel simultaneously.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/30 p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <span className="text-xs font-semibold text-foreground">Retention settings</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Raw events: <strong className="text-foreground">90 days</strong> · Incident resolutions: <strong className="text-foreground">Unlimited</strong> · Product Memory: <strong className="text-foreground">Unlimited</strong>
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── Integration Health ── */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <Card>
                <CardHead
                  title="Integration Health"
                  desc="Live connection status for all three integration points. The tool works with any subset — gracefully shows what's available when an integration is missing."
                  icon={<Wifi className="h-4 w-4 text-intel" />}
                />
                <div className="divide-y divide-border/40 px-5 pb-5">
                  {[
                    {
                      label: 'Frontend SDK',
                      desc: 'User events, navigation flows, errors, and performance signals',
                      status: app.sdkStatus.frontend,
                      snippet: `PAAQListening.init({ apiKey: '${app.apiKey}', appName: '${app.name}' })`,
                    },
                    {
                      label: 'Backend SDK',
                      desc: 'Server-side errors, API response times, deployment events, and log signals',
                      status: app.sdkStatus.backend,
                      snippet: `PAAQListening.init({ apiKey: '${app.apiKey}', environment: '${app.environment.toLowerCase()}' })`,
                    },
                    {
                      label: 'Database Connector',
                      desc: 'Read-only access to monitored tables — the tool never writes to your database',
                      status: app.sdkStatus.database,
                      snippet: `PAAQListening.connectDatabase({ type: 'postgresql', ... })`,
                    },
                  ].map((integration) => (
                    <div key={integration.label} className="py-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{integration.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{integration.desc}</p>
                        </div>
                        <div className="shrink-0">
                          <SdkStatusBadge status={integration.status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded border border-border/60 bg-muted/60 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground truncate">
                          {integration.snippet}
                        </code>
                        <CopyButton text={integration.snippet} />
                        {integration.status === 'disconnected' && (
                          <button className="flex items-center gap-1 rounded-md border border-intel/30 bg-intel/10 px-2 py-1 text-[10px] font-medium text-intel hover:bg-intel/20 transition-colors">
                            <RefreshCw className="h-2.5 w-2.5" /> Connect
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                        Last seen: {new Date(app.lastSeen).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHead
                  title="API Endpoints"
                  desc="Supabase Edge Function endpoints for direct integration without the SDK."
                  icon={<Code2 className="h-4 w-4 text-ai" />}
                />
                <ul className="divide-y divide-border/40">
                  {[
                    { method: 'POST', path: '/functions/v1/events',      desc: 'Ingest user events (batch supported)' },
                    { method: 'POST', path: '/functions/v1/errors',      desc: 'Report application errors' },
                    { method: 'POST', path: '/functions/v1/sessions',    desc: 'Start or end user sessions' },
                    { method: 'POST', path: '/functions/v1/performance', desc: 'Send performance metrics' },
                  ].map((e) => (
                    <li key={e.path} className="flex items-center gap-4 px-5 py-3">
                      <span className="shrink-0 rounded border border-intel/30 bg-intel/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-intel">{e.method}</span>
                      <code className="flex-1 font-mono text-xs text-foreground">{e.path}</code>
                      <span className="text-xs text-muted-foreground hidden sm:block">{e.desc}</span>
                    </li>
                  ))}
                </ul>
                <div className="px-5 pb-4 pt-2">
                  <p className="text-[10px] text-muted-foreground">
                    All endpoints require <code className="rounded bg-muted px-1 py-0.5 font-mono">x-api-key: {app.apiKey.slice(0, 12)}••••</code>
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
