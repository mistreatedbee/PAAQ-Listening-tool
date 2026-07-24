'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, CheckCircle2, Loader2, Copy, Check,
  Eye, EyeOff, RefreshCw, Globe, Server, Database, Sparkles,
  LayoutDashboard, Clock, Users, Activity, AlertTriangle,
  GitBranch, Zap, Package, ArrowRight, Shield,
  BrainCircuit, TrendingUp, X, Link2, CloudCog,
} from 'lucide-react'
import { SiGithub, SiGitlab, SiBitbucket } from 'react-icons/si'
import type { Tone } from '@/lib/data'

// ── Types ─────────────────────────────────────────────────────────────
type ProjectRow = {
  id: string
  tenant_id: string
  name: string
  platform: string
  environment: string
  description: string | null
  project_id_key: string
  status: string
  created_at: string
}

type InstallRow = {
  id: string
  platform: string
  sdk_version: string
  last_seen: string
  first_seen: string
  status: string
}

type AppLifecycle =
  | 'not_connected'
  | 'sdk_installed'
  | 'connection_verified'
  | 'discovery_running'
  | 'monitoring_active'
  | 'disconnected'

type SdkStatus = 'connected' | 'disconnected' | 'degraded'
type LayerKey = 'frontend' | 'backend' | 'database'

// ── Lifecycle derivation ──────────────────────────────────────────────
const FRONTEND_PLATFORMS = new Set(['react', 'nextjs', 'vue', 'angular', 'vanilla'])
const MOBILE_PLATFORMS   = new Set(['flutter', 'reactnative', 'ios', 'android'])
const BACKEND_PLATFORMS  = new Set(['nodejs', 'python', 'go', 'java', 'dotnet', 'ruby', 'other'])

function deriveLifecycle(
  installs: InstallRow[],
  totalEvents: number,
  events24h: number,
  knowledgeCount: number,
): AppLifecycle {
  const hasActiveInstall = installs.some((i) => i.status === 'active')
  if (!hasActiveInstall && totalEvents === 0) return 'not_connected'
  if (hasActiveInstall && totalEvents === 0)  return 'sdk_installed'
  if (totalEvents > 0 && events24h === 0)      return 'disconnected'
  if (events24h > 0 && knowledgeCount === 0)   return 'discovery_running'
  if (knowledgeCount > 0 && events24h > 0)     return 'monitoring_active'
  return 'connection_verified'
}

const LIFECYCLE_META: Record<AppLifecycle, { label: string; tone: Tone; desc: string }> = {
  not_connected:      { label: 'Not Connected',      tone: 'intel',    desc: 'No SDK has authenticated yet. Follow the setup steps below.' },
  sdk_installed:      { label: 'SDK Installed',      tone: 'ai',       desc: 'SDK is installed and authenticated. Waiting for first events.' },
  connection_verified: { label: 'Connection Verified', tone: 'ai',     desc: 'Events are being received. AI discovery is starting.' },
  discovery_running:  { label: 'Discovery Running',  tone: 'warning',  desc: 'AI agents are actively learning your application.' },
  monitoring_active:  { label: 'Monitoring Active',  tone: 'healthy',  desc: 'Fully operational — AI is continuously monitoring and learning.' },
  disconnected:       { label: 'Disconnected',       tone: 'critical', desc: 'Was connected but no events received in the last 24 hours.' },
}

function sdkLayerStatus(installs: InstallRow[]): { frontend: SdkStatus; backend: SdkStatus; database: SdkStatus } {
  const platforms = new Set(installs.filter((i) => i.status === 'active').map((i) => i.platform))
  const hasFrontend = [...FRONTEND_PLATFORMS, ...MOBILE_PLATFORMS].some((p) => platforms.has(p))
  const hasBackend  = [...BACKEND_PLATFORMS].some((p) => platforms.has(p))
  return {
    frontend: hasFrontend ? 'connected' : 'disconnected',
    backend:  hasBackend  ? 'connected' : 'disconnected',
    database: 'disconnected',
  }
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── CopyButton ─────────────────────────────────────────────────────────
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-healthy" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// ── SDK status row ─────────────────────────────────────────────────────
function SdkRow({
  label, desc, icon: Icon, status, detail, layerKey, onSetup,
}: {
  label: string; desc: string; icon: typeof Globe
  status: SdkStatus; detail?: string; layerKey: LayerKey
  onSetup: (layer: LayerKey) => void
}) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-border/40 last:border-0">
      <div className={cn(
        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
        status === 'connected' ? 'border-healthy/30 bg-healthy/10 text-healthy'
          : status === 'degraded' ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-border/50 bg-muted/40 text-muted-foreground',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {status === 'connected' && <ToneBadge tone="healthy" dot>Connected</ToneBadge>}
          {status === 'degraded'  && <ToneBadge tone="warning" dot>Degraded</ToneBadge>}
          {status === 'disconnected' && <ToneBadge tone="intel" dot>Not connected</ToneBadge>}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{status === 'connected' && detail ? detail : desc}</p>
      </div>
      {status === 'disconnected' && (
        <button
          onClick={() => onSetup(layerKey)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-ai/30 bg-ai/10 px-2.5 py-1.5 text-[10px] font-semibold text-ai hover:bg-ai/20 transition-colors"
        >
          Setup <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ── Discovery layer ────────────────────────────────────────────────────
type DiscoverLayer = { label: string; coverage: number; detail: string }

function DiscoveryRow({ layer }: { layer: DiscoverLayer }) {
  const tone: Tone = layer.coverage >= 80 ? 'healthy' : layer.coverage >= 40 ? 'ai' : layer.coverage > 0 ? 'warning' : 'intel'
  const barColor = tone === 'healthy' ? 'bg-healthy' : tone === 'ai' ? 'bg-ai' : tone === 'warning' ? 'bg-warning' : 'bg-border/40'
  return (
    <div className="space-y-1.5 py-2.5 border-b border-border/40 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-foreground">{layer.label}</span>
          <span className="ml-2 text-[10px] text-muted-foreground/70">{layer.detail}</span>
        </div>
        <span className={cn('shrink-0 text-xs font-bold tabular-nums',
          tone === 'healthy' ? 'text-healthy' : tone === 'ai' ? 'text-ai' : tone === 'warning' ? 'text-warning' : 'text-muted-foreground',
        )}>{layer.coverage}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-[width] duration-700', barColor)} style={{ width: `${layer.coverage}%` }} />
      </div>
    </div>
  )
}

// ── Repo provider config ───────────────────────────────────────────────
const REPO_PROVIDERS = [
  { id: 'github',    label: 'GitHub',       Icon: SiGithub,   iconColor: 'text-foreground',    description: 'Connect your GitHub repositories' },
  { id: 'gitlab',    label: 'GitLab',       Icon: SiGitlab,   iconColor: 'text-[#FC6D26]',     description: 'Connect your GitLab repositories' },
  { id: 'azure',     label: 'Azure DevOps', Icon: GitBranch,  iconColor: 'text-[#0078D4]',     description: 'Connect Azure DevOps repositories' },
  { id: 'bitbucket', label: 'Bitbucket',    Icon: SiBitbucket, iconColor: 'text-[#0052CC]',   description: 'Connect your Bitbucket repositories' },
]

// ── Main Page ─────────────────────────────────────────────────────────
export default function AppManagementPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const searchParams = useSearchParams()

  const [project,  setProject]  = useState<ProjectRow | null>(null)
  const [installs, setInstalls] = useState<InstallRow[]>([])
  const [totalEvents,  setTotalEvents]  = useState(0)
  const [events24h,    setEvents24h]    = useState(0)
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  const [openErrors,   setOpenErrors]   = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [activeUsers,  setActiveUsers]  = useState(0)
  const [lastEventAt,  setLastEventAt]  = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // Setup layer expansion
  const [setupLayer, setSetupLayer] = useState<LayerKey | null>(null)

  // Repository connection state
  const [connectedRepos, setConnectedRepos] = useState<Set<string>>(new Set())
  const [repoConnecting, setRepoConnecting] = useState<string | null>(null)
  const [repoNotice, setRepoNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Handle OAuth callback params (e.g. ?repo_connected=github or ?repo_error=not_configured)
  useEffect(() => {
    const connected = searchParams.get('repo_connected')
    const repoError = searchParams.get('repo_error')
    if (connected) {
      setConnectedRepos((prev) => new Set([...prev, connected]))
      const provider = REPO_PROVIDERS.find((p) => p.id === connected)
      setRepoNotice({ type: 'success', msg: `${provider?.label ?? connected} connected successfully` })
      router.replace(`/apps/${id}`, { scroll: false })
    }
    if (repoError) {
      const msg = repoError === 'not_configured' ? 'Integration not configured — contact your admin'
        : repoError === 'auth_failed' ? 'Authentication failed — please try again'
        : 'Connection failed — please try again'
      setRepoNotice({ type: 'error', msg })
      router.replace(`/apps/${id}`, { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to setup panel when a layer is selected via "Setup →"
  useEffect(() => {
    if (setupLayer) {
      setTimeout(() => {
        document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }, [setupLayer])

  // Load project data
  useEffect(() => {
    if (!id) return
    const sb = createClient()
    const since24h = new Date(Date.now() - 86400000).toISOString()

    Promise.all([
      sb.from('tenant_projects')
        .select('id, tenant_id, name, platform, environment, description, project_id_key, status, created_at')
        .eq('id', id).single(),
      sb.from('sdk_installations')
        .select('id, platform, sdk_version, last_seen, first_seen, status')
        .eq('project_id', id).order('last_seen', { ascending: false }),
      sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', id),
      sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', id).gte('created_at', since24h),
      sb.from('knowledge_nodes').select('*', { count: 'exact', head: true }).eq('project_id', id),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', id).eq('status', 'open'),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', id),
      sb.from('events').select('user_id', { count: 'exact', head: true }).eq('project_id', id).gte('created_at', since24h).not('user_id', 'is', null),
      sb.from('events').select('created_at').eq('project_id', id).order('created_at', { ascending: false }).limit(1),
      // Load connected repository providers
      sb.from('project_repositories').select('provider').eq('project_id', id).eq('status', 'active'),
    ]).then(([
      { data: proj, error },
      { data: insts },
      { count: totEv },
      { count: ev24 },
      { count: kn },
      { count: errs },
      { count: ses },
      { count: au },
      { data: lastEv },
      { data: repos },
    ]) => {
      if (error || !proj) { setNotFound(true); setLoading(false); return }
      setProject(proj as ProjectRow)
      setInstalls((insts ?? []) as InstallRow[])
      setTotalEvents(totEv ?? 0)
      setEvents24h(ev24 ?? 0)
      setKnowledgeCount(kn ?? 0)
      setOpenErrors(errs ?? 0)
      setSessionCount(ses ?? 0)
      setActiveUsers(au ?? 0)
      setLastEventAt((lastEv ?? [])[0]?.created_at ?? null)
      if (repos) setConnectedRepos(new Set(repos.map((r: { provider: string }) => r.provider)))
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading application…
    </div>
  )

  if (notFound || !project) return (
    <div className="space-y-4">
      <Link href="/setup" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All applications
      </Link>
      <p className="text-muted-foreground">Application not found or you don't have access.</p>
    </div>
  )

  const lifecycle = deriveLifecycle(installs, totalEvents, events24h, knowledgeCount)
  const meta      = LIFECYCLE_META[lifecycle]
  const sdkStatus = sdkLayerStatus(installs)
  const apiKey    = project.project_id_key

  const webCoverage = sdkStatus.frontend === 'connected'
    ? Math.min(100, totalEvents > 0 ? Math.round((Math.min(totalEvents, 500) / 500) * 100) : 5) : 0
  const apiCoverage = sdkStatus.backend === 'connected'
    ? Math.min(100, knowledgeCount > 0 ? Math.round((Math.min(knowledgeCount, 30) / 30) * 100) : 8) : 0
  const knCoverage = knowledgeCount > 0
    ? Math.min(100, Math.round((Math.min(knowledgeCount, 100) / 100) * 100)) : 0
  const journeyCoverage = sessionCount > 0
    ? Math.min(100, Math.round((Math.min(sessionCount, 100) / 100) * 100)) : 0

  const discoveryLayers: DiscoverLayer[] = [
    { label: 'Frontend',       coverage: webCoverage,     detail: sdkStatus.frontend === 'connected' ? `${totalEvents.toLocaleString()} interactions captured` : 'SDK not connected' },
    { label: 'Backend / APIs', coverage: apiCoverage,     detail: sdkStatus.backend  === 'connected' ? `${knowledgeCount} service patterns discovered` : 'SDK not connected' },
    { label: 'User Journeys',  coverage: journeyCoverage, detail: sessionCount > 0 ? `${sessionCount.toLocaleString()} sessions analysed` : 'Awaiting session data' },
    { label: 'Knowledge Base', coverage: knCoverage,      detail: knowledgeCount > 0 ? `${knowledgeCount} entities indexed` : 'Awaiting discovery' },
    { label: 'Database',       coverage: 0,               detail: 'Connector not configured' },
  ]

  const activeInstall = installs.find((i) => i.status === 'active')
  const lastSeen = activeInstall?.last_seen ?? lastEventAt

  const platform = project.platform
  const isWeb    = ['react', 'nextjs', 'vue', 'angular', 'vanilla'].includes(platform)
  const isMobile = ['flutter', 'reactnative', 'ios', 'android'].includes(platform)
  const isBack   = ['nodejs', 'python', 'go', 'java', 'dotnet'].includes(platform)

  // Which layer to show instructions for in the setup panel
  const activeSetupLayer: LayerKey = setupLayer ?? (isBack ? 'backend' : 'frontend')

  // Per-layer setup content
  const LAYER_SETUP: Record<LayerKey, { installCmd: string | null; initCode: string | null }> = {
    frontend: {
      installCmd: platform === 'flutter'
        ? 'flutter pub add paaq_mobile_sdk'
        : platform === 'reactnative'
        ? 'npm install @paaq/react-native-sdk'
        : 'npm install @paaq/web-sdk',
      initCode: platform === 'flutter'
        ? `import 'package:paaq_mobile_sdk/paaq.dart';\n\nawait PAAQ.initialize(\n  sdkToken: '${apiKey}',\n  projectId: '${project.id}',\n);`
        : platform === 'reactnative'
        ? `import { PAAQProvider } from '@paaq/react-native-sdk';\n\n<PAAQProvider sdkToken="${apiKey}" projectId="${project.id}">\n  <YourApp />\n</PAAQProvider>`
        : `import { PAAQProvider } from '@paaq/web-sdk';\n\n<PAAQProvider sdkToken="${apiKey}" projectId="${project.id}">\n  <YourApp />\n</PAAQProvider>`,
    },
    backend: {
      installCmd: platform === 'python'
        ? 'pip install paaq-server-sdk'
        : platform === 'go'
        ? 'go get github.com/paaqintelligence/go-sdk'
        : 'npm install @paaq/server-sdk',
      initCode: platform === 'python'
        ? `from paaq import PAAQ\n\nPAAQ.initialize(\n  sdk_token="${apiKey}",\n  project_id="${project.id}",\n)\n\n# FastAPI / Flask middleware\napp.add_middleware(PAAQ.middleware())`
        : platform === 'go'
        ? `import paaq "github.com/paaqintelligence/go-sdk"\n\npaaq.Initialize(paaq.Config{\n  SDKToken:  "${apiKey}",\n  ProjectID: "${project.id}",\n})\n\n// Gin / Echo / Chi — add middleware\nr.Use(paaq.Middleware())`
        : `import { PAAQ } from '@paaq/server-sdk';\n\nPAAQ.initialize({\n  sdkToken: '${apiKey}',\n  projectId: '${project.id}',\n});\n\n// Express / Fastify / Hono — add middleware\napp.use(PAAQ.middleware());`,
    },
    database: {
      installCmd: null,
      initCode: null,
    },
  }

  const layerConfig = LAYER_SETUP[activeSetupLayer]
  const showSetup = lifecycle === 'not_connected' || lifecycle === 'sdk_installed' || setupLayer !== null

  // Initiate OAuth for a repository provider
  function handleRepoConnect(providerId: string) {
    if (!project || connectedRepos.has(providerId)) return
    setRepoConnecting(providerId)
    window.location.href = `/api/auth/${providerId}?project_id=${project.id}`
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/setup" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> All applications
      </Link>

      {/* Application header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md"
            style={{ backgroundColor: '#51C9D3' }}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">{project.name}</h1>
              <ToneBadge tone="intel">{project.environment}</ToneBadge>
              <ToneBadge tone={meta.tone} dot>{meta.label}</ToneBadge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{meta.desc}</p>
            {lastSeen && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Clock className="h-3 w-3" />
                Last seen {timeAgo(lastSeen)} · Connected since {new Date(project.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-xl border border-ai/30 bg-ai/10 px-4 py-2 text-sm font-semibold text-ai hover:bg-ai/20 transition-colors"
        >
          <LayoutDashboard className="h-4 w-4" />
          View Intelligence
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">

          {/* Connection Status */}
          <div className="rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/60 px-5 py-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-ai" />
                <h2 className="text-sm font-semibold text-foreground">Connection Status</h2>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {installs.filter((i) => i.status === 'active').length} active SDK installation{installs.filter((i) => i.status === 'active').length !== 1 ? 's' : ''} detected
              </p>
            </div>
            <div className="px-5 pb-2">
              <SdkRow
                label="Frontend SDK"
                desc="Captures user events, navigation flows, errors, and performance signals"
                icon={Globe}
                status={sdkStatus.frontend}
                layerKey="frontend"
                onSetup={setSetupLayer}
                detail={activeInstall ? `${activeInstall.platform} v${activeInstall.sdk_version} · last seen ${timeAgo(activeInstall.last_seen)}` : undefined}
              />
              <SdkRow
                label="Backend SDK"
                desc="Server-side errors, API response times, deployment events, and log signals"
                icon={Server}
                status={sdkStatus.backend}
                layerKey="backend"
                onSetup={setSetupLayer}
                detail={activeInstall ? `Middleware active · ${events24h.toLocaleString()} events in last 24h` : undefined}
              />
              <SdkRow
                label="Database Connector"
                desc="Read-only access to monitored tables — AI uses this for schema understanding"
                icon={Database}
                status={sdkStatus.database}
                layerKey="database"
                onSetup={setSetupLayer}
              />
            </div>
          </div>

          {/* AI Discovery */}
          <div className="rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/60 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-ai" />
                <h2 className="text-sm font-semibold text-foreground">AI Discovery</h2>
              </div>
              {knowledgeCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {knowledgeCount} knowledge entities indexed
                </span>
              )}
            </div>
            <div className="px-5 py-2 pb-4">
              {discoveryLayers.map((layer) => (
                <DiscoveryRow key={layer.label} layer={layer} />
              ))}
              {lifecycle === 'not_connected' && (
                <p className="mt-3 text-xs text-muted-foreground text-center py-2">
                  Connect the SDK below to start AI discovery
                </p>
              )}
              {lifecycle !== 'not_connected' && (
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                  <Sparkles className="h-3 w-3 text-ai" />
                  AI agents are continuously learning — coverage improves automatically over time
                </p>
              )}
            </div>
          </div>

          {/* SDK Setup — shown when not yet connected OR when a layer is explicitly selected */}
          {showSetup && (
            <div id="setup" className="rounded-2xl border border-ai/20 bg-ai/5">
              <div className="border-b border-ai/15 px-5 py-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-ai" />
                <h2 className="text-sm font-semibold text-foreground">SDK Setup</h2>
                {lifecycle === 'not_connected' && (
                  <span className="ml-1 rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-bold text-warning">Action required</span>
                )}
                {setupLayer && (
                  <button
                    onClick={() => setSetupLayer(null)}
                    className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    aria-label="Close setup panel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Layer selector tabs */}
              <div className="px-5 pt-4 flex gap-2 flex-wrap">
                {([
                  { key: 'frontend' as LayerKey, label: 'Frontend SDK', icon: Globe },
                  { key: 'backend'  as LayerKey, label: 'Backend SDK',  icon: Server },
                  { key: 'database' as LayerKey, label: 'Database',     icon: Database },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSetupLayer(key)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                      activeSetupLayer === key
                        ? 'bg-ai/20 text-ai border border-ai/30'
                        : 'text-muted-foreground border border-border/40 hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Frontend or Backend SDK */}
                {activeSetupLayer !== 'database' && layerConfig.installCmd && layerConfig.initCode && (
                  <>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        1. Install
                      </p>
                      <div className="flex items-center gap-2">
                        <pre className="flex-1 overflow-x-auto rounded-lg border border-border/50 bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                          {layerConfig.installCmd}
                        </pre>
                        <CopyButton text={layerConfig.installCmd} />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        2. Your API Key
                      </p>
                      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2">
                        <code className="flex-1 font-mono text-xs text-foreground">
                          {showKey ? apiKey : `${apiKey.slice(0, 14)}${'•'.repeat(16)}`}
                        </code>
                        <button onClick={() => setShowKey((s) => !s)} className="text-muted-foreground hover:text-foreground">
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <CopyButton text={apiKey} />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        3. Initialise
                      </p>
                      <div className="relative">
                        <pre className="overflow-x-auto rounded-lg border border-border/50 bg-muted/50 p-3 font-mono text-[11px] text-foreground whitespace-pre-wrap">
                          {layerConfig.initCode}
                        </pre>
                        <div className="absolute right-2 top-2">
                          <CopyButton text={layerConfig.initCode} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-lg border border-healthy/25 bg-healthy/5 px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-healthy shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground">
                        Once your app starts, this page will automatically update to show the connection as verified. You do not need to refresh.
                      </p>
                    </div>
                  </>
                )}

                {/* Database connector instructions */}
                {activeSetupLayer === 'database' && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border border-ai/20 bg-ai/5 p-4">
                      <Database className="h-5 w-5 text-ai shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Read-Only Database Connector</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PAAQ uses read-only access to understand your schema and data patterns. No data is stored — only structure and relationship metadata is indexed.
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Supported databases
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Redis', 'Supabase'].map((db) => (
                          <span key={db} className="rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {db}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Connection string format
                      </p>
                      <div className="flex items-center gap-2">
                        <pre className="flex-1 overflow-x-auto rounded-lg border border-border/50 bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                          postgresql://readonly_user:password@host:5432/dbname
                        </pre>
                        <CopyButton text="postgresql://readonly_user:password@host:5432/dbname" />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Your project ID (for the connector config)
                      </p>
                      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2">
                        <code className="flex-1 truncate font-mono text-xs text-foreground">{project.id}</code>
                        <CopyButton text={project.id} label="ID" />
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5">
                      <CloudCog className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground">
                        Create a read-only database user before connecting. PAAQ only needs SELECT permissions. Database connector configuration is managed in Settings.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Repository connections */}
          <div className="rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/60 px-5 py-4 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Repository</h2>
              {connectedRepos.size > 0 && (
                <span className="ml-auto text-[10px] text-healthy font-semibold">
                  {connectedRepos.size} connected
                </span>
              )}
            </div>

            {/* OAuth notice (success / error) */}
            {repoNotice && (
              <div className={cn(
                'mx-5 mt-4 flex items-center gap-2.5 rounded-lg border px-3 py-2.5',
                repoNotice.type === 'success'
                  ? 'border-healthy/25 bg-healthy/5 text-healthy'
                  : 'border-critical/25 bg-critical/5 text-critical',
              )}>
                {repoNotice.type === 'success'
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <X className="h-4 w-4 shrink-0" />
                }
                <p className="flex-1 text-xs font-medium">{repoNotice.msg}</p>
                <button onClick={() => setRepoNotice(null)} className="text-current/50 hover:text-current">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="grid gap-2 p-5 sm:grid-cols-2">
              {REPO_PROVIDERS.map((repo) => {
                const isConnected = connectedRepos.has(repo.id)
                const isConnecting = repoConnecting === repo.id
                const Icon = repo.Icon
                return (
                  <button
                    key={repo.id}
                    onClick={() => !isConnected && handleRepoConnect(repo.id)}
                    disabled={isConnecting}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                      isConnected
                        ? 'border-healthy/30 bg-healthy/5 cursor-default'
                        : 'border-border/50 bg-background/30 hover:border-border hover:bg-accent/30 cursor-pointer',
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                      isConnected ? 'border-healthy/30 bg-healthy/10' : 'border-border/50 bg-muted/50',
                    )}>
                      <Icon className={cn('h-4 w-4', isConnected ? 'text-healthy' : repo.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{repo.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {isConnected ? 'Connected' : isConnecting ? 'Connecting…' : 'Click to connect'}
                      </p>
                    </div>
                    {isConnected && <CheckCircle2 className="h-4 w-4 shrink-0 text-healthy" />}
                    {isConnecting && <Loader2 className="h-4 w-4 shrink-0 text-muted-foreground animate-spin" />}
                    {!isConnected && !isConnecting && <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
                  </button>
                )
              })}
            </div>

            <p className="px-5 pb-4 text-[10px] text-muted-foreground/60">
              Connecting your repository lets PAAQ correlate deployments with error spikes and performance changes.
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Analytics strip */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground">Analytics</h3>
              <span className="text-[9px] text-muted-foreground/50">last 24h</span>
            </div>
            {[
              { label: 'Active Users',  value: activeUsers.toLocaleString(),  icon: Users,         color: 'text-ai' },
              { label: 'Events',        value: events24h.toLocaleString(),    icon: Activity,      color: 'text-intel' },
              { label: 'Sessions',      value: sessionCount.toLocaleString(), icon: Clock,         color: 'text-healthy' },
              { label: 'Open Errors',   value: openErrors.toLocaleString(),   icon: AlertTriangle, color: openErrors > 0 ? 'text-critical' : 'text-muted-foreground' },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-3.5 w-3.5', stat.color)} />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <span className={cn('text-sm font-bold tabular-nums', stat.color)}>{stat.value}</span>
                </div>
              )
            })}
            <Link href="/dashboard" className="block pt-1 text-center text-[10px] font-medium text-ai hover:underline">
              View full intelligence →
            </Link>
          </div>

          {/* SDK info */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground">Project Details</h3>
            </div>
            <div className="space-y-2.5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Project ID</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate text-[10px] font-mono text-muted-foreground">{project.id}</code>
                  <CopyButton text={project.id} label="ID" />
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">API Key</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate text-[10px] font-mono text-muted-foreground">
                    {apiKey.slice(0, 10)}••••
                  </code>
                  <CopyButton text={apiKey} label="Key" />
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Platform</p>
                <p className="mt-1 text-[10px] text-foreground capitalize">{project.platform}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Created</p>
                <p className="mt-1 text-[10px] text-foreground">{new Date(project.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" /> Rotate API Key
            </button>
          </div>

          {/* Installations */}
          {installs.length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">SDK Installations</h3>
                <span className="ml-auto text-[10px] text-muted-foreground">{installs.length}</span>
              </div>
              {installs.slice(0, 5).map((inst) => (
                <div key={inst.id} className="flex items-center gap-2.5">
                  <div className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    inst.status === 'active' ? 'bg-healthy' : inst.status === 'stale' ? 'bg-warning' : 'bg-muted',
                  )} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-foreground capitalize truncate">{inst.platform} v{inst.sdk_version}</p>
                    <p className="text-[9px] text-muted-foreground/60">{timeAgo(inst.last_seen)}</p>
                  </div>
                  <span className={cn(
                    'text-[9px] font-bold capitalize',
                    inst.status === 'active' ? 'text-healthy' : inst.status === 'stale' ? 'text-warning' : 'text-muted-foreground',
                  )}>{inst.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
