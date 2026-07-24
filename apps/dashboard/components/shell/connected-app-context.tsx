'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Loader2 } from 'lucide-react'
import type { ConnectedApp } from '@/lib/connected-app'

// ─── Map a tenant_projects DB row → ConnectedApp shape ───────────────────────
const PLATFORM_COLOR: Record<string, string> = {
  react:       '#61DAFB',
  nextjs:      '#51C9D3',
  vue:         '#42B883',
  angular:     '#DD0031',
  vanilla:     '#F7DF1E',
  flutter:     '#54C5F8',
  reactnative: '#61DAFB',
  ios:         '#007AFF',
  android:     '#3DDC84',
  nodejs:      '#68A063',
  python:      '#3776AB',
  go:          '#00ADD8',
  java:        '#ED8B00',
  dotnet:      '#512BD4',
  other:       '#51C9D3',
}

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
  project_id: string
  platform: string
  last_seen: string
  status: string
}

// Platforms that indicate a frontend SDK is present
const FRONTEND_PLATFORMS  = new Set(['react', 'nextjs', 'vue', 'angular', 'vanilla'])
// Platforms that indicate a mobile SDK is present (counts as frontend layer)
const MOBILE_PLATFORMS    = new Set(['flutter', 'reactnative', 'ios', 'android'])
// Platforms that indicate a backend SDK is present
const BACKEND_PLATFORMS   = new Set(['nodejs', 'python', 'go', 'java', 'dotnet', 'ruby', 'other'])
// Platforms that indicate a database connector is present
const DATABASE_PLATFORMS  = new Set(['postgres', 'mysql', 'supabase', 'mongodb', 'database', 'sqlite', 'redis'])

const MS_5MIN  = 5  * 60 * 1000
const MS_24HR  = 24 * 60 * 60 * 1000

function layerStatus(lastSeenStr: string | null): 'connected' | 'degraded' | 'disconnected' {
  if (!lastSeenStr) return 'disconnected'
  const ageMs = Date.now() - new Date(lastSeenStr).getTime()
  if (ageMs < MS_5MIN)  return 'connected'
  if (ageMs < MS_24HR)  return 'degraded'
  return 'disconnected'
}

function latestLastSeen(rows: InstallRow[]): string | null {
  if (!rows.length) return null
  return rows.reduce((best, r) =>
    new Date(r.last_seen) > new Date(best.last_seen) ? r : best,
  ).last_seen
}

function toConnectedApp(project: ProjectRow, installs: InstallRow[]): ConnectedApp {
  const env = project.environment === 'production'
    ? 'Production'
    : project.environment === 'staging'
    ? 'Staging'
    : 'Development'

  const projectInstalls = installs.filter(
    (i) => i.project_id === project.id && i.status === 'active',
  )

  const frontendInstalls  = projectInstalls.filter(
    (i) => FRONTEND_PLATFORMS.has(i.platform) || MOBILE_PLATFORMS.has(i.platform),
  )
  const backendInstalls   = projectInstalls.filter((i) => BACKEND_PLATFORMS.has(i.platform))
  const databaseInstalls  = projectInstalls.filter((i) => DATABASE_PLATFORMS.has(i.platform))

  // Derive most-recent last_seen from any active installation
  const lastSeenMs = projectInstalls.map((i) => new Date(i.last_seen).getTime())
  const lastSeen = lastSeenMs.length > 0
    ? new Date(Math.max(...lastSeenMs)).toISOString()
    : project.created_at

  return {
    id: project.id,
    tenantId: project.tenant_id,
    name: project.name,
    environment: env as 'Production' | 'Staging' | 'Development',
    apiKey: project.project_id_key,
    accentColor: PLATFORM_COLOR[project.platform] ?? '#51C9D3',
    featureAreas: [],
    criticalFlows: [],
    webhookProviders: [],
    schemaMappings: [],
    customSignals: [],
    alertRules: [],
    team: [],
    markets: [],
    connectedSince: project.created_at,
    lastSeen,
    sdkStatus: {
      frontend:           layerStatus(latestLastSeen(frontendInstalls)),
      backend:            layerStatus(latestLastSeen(backendInstalls)),
      database:           layerStatus(latestLastSeen(databaseInstalls)),
      frontendLastSeen:   latestLastSeen(frontendInstalls),
      backendLastSeen:    latestLastSeen(backendInstalls),
      databaseLastSeen:   latestLastSeen(databaseInstalls),
    },
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
type ConnectedAppCtx = {
  app: ConnectedApp
  setApp: (id: string) => void
  allApps: ConnectedApp[]
  loading: boolean
}

// Minimal placeholder used only during initial load to avoid null errors
const LOADING_APP: ConnectedApp = {
  id: '__loading__',
  tenantId: '',
  name: 'Loading…',
  environment: 'Production',
  apiKey: '',
  accentColor: '#51C9D3',
  featureAreas: [],
  criticalFlows: [],
  webhookProviders: [],
  schemaMappings: [],
  customSignals: [],
  alertRules: [],
  team: [],
  markets: [],
  connectedSince: '',
  lastSeen: '',
  sdkStatus: { frontend: 'disconnected', backend: 'disconnected', database: 'disconnected' },
}

const ConnectedAppContext = createContext<ConnectedAppCtx>({
  app: LOADING_APP,
  setApp: () => {},
  allApps: [],
  loading: true,
})

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ConnectedAppProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<ConnectedApp[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const sb = createClient()

    async function load() {
      // 1. Get current auth user
      const { data: { user } } = await sb.auth.getUser()
      if (!user || cancelled) { setLoading(false); return }

      // 2. Find all tenants this user belongs to
      const { data: tenantUsers } = await sb
        .from('tenant_users')
        .select('tenant_id')
        .eq('auth_user_id', user.id)

      if (!tenantUsers?.length || cancelled) { setLoading(false); return }

      const tenantIds = tenantUsers.map((tu) => tu.tenant_id)

      // 3. Load all active projects for those tenants
      const { data: projects } = await sb
        .from('tenant_projects')
        .select('id, tenant_id, name, platform, environment, description, project_id_key, status, created_at')
        .in('tenant_id', tenantIds)
        .eq('status', 'active')
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (!projects?.length) {
        setLoading(false)
        return
      }

      // 4. Fetch per-platform SDK installation status for each project
      const { data: installs } = await sb
        .from('sdk_installations')
        .select('project_id, platform, last_seen, status')
        .in('project_id', projects.map((p) => p.id))

      // 5. Map to ConnectedApp shape — with granular per-layer status
      const mapped = projects.map((p) => toConnectedApp(p as ProjectRow, (installs ?? []) as InstallRow[]))

      if (!cancelled) {
        setApps(mapped)
        // Preserve current selection on refresh; restore from localStorage on first load
        setActiveId((prev) => {
          if (prev) return prev
          const saved = localStorage.getItem('paaq_active_project')
          return (mapped.find((a) => a.id === saved) ?? mapped[0])?.id ?? null
        })
        setLoading(false)
      }
    }

    load()

    // Refresh status in real-time whenever an SDK installation is updated/inserted
    const channel = sb
      .channel('sdk-installations-status-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sdk_installations' }, () => { if (!cancelled) load() })
      .subscribe()

    // 60s interval fallback in case Realtime is unavailable
    const timer = setInterval(() => { if (!cancelled) load() }, 60_000)

    return () => {
      cancelled = true
      clearInterval(timer)
      sb.removeChannel(channel)
    }
  }, [])

  const setApp = useCallback((id: string) => {
    setActiveId(id)
    localStorage.setItem('paaq_active_project', id)
  }, [])

  const app = apps.find((a) => a.id === activeId) ?? LOADING_APP

  return (
    <ConnectedAppContext.Provider value={{ app, setApp, allApps: apps, loading }}>
      {loading ? (
        <LoadingShell />
      ) : apps.length === 0 ? (
        <NoProjectsShell />
      ) : (
        children
      )}
    </ConnectedAppContext.Provider>
  )
}

export function useConnectedApp() {
  return useContext(ConnectedAppContext)
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    </div>
  )
}

// ─── No projects onboarding screen ───────────────────────────────────────────
function NoProjectsShell() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mx-auto max-w-md text-center">
        <Image src="/logo.png" alt="PAAQ Intelligence" width={64} height={64} className="mx-auto mb-6 rounded-2xl" />
        <h1 className="text-2xl font-black tracking-tight">Welcome to PAAQ Intelligence</h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          You're in — now let's connect your digital product. The setup takes about 2 minutes.
        </p>
        <div className="mt-8">
          <Link
            href="/onboarding"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Set up my workspace
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Already have an invite? Ask your workspace admin to add your email to the project.
        </p>
      </div>
    </div>
  )
}
