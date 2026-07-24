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
}

function toConnectedApp(project: ProjectRow, sdkActive: boolean): ConnectedApp {
  const env = project.environment === 'production'
    ? 'Production'
    : project.environment === 'staging'
    ? 'Staging'
    : 'Development'

  const status = sdkActive ? 'connected' : ('disconnected' as const)

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
    connectedSince: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    sdkStatus: { frontend: status, backend: status, database: status },
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

    async function load() {
      const sb = createClient()

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
        .select('id, tenant_id, name, platform, environment, description, project_id_key, status')
        .in('tenant_id', tenantIds)
        .eq('status', 'active')
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (!projects?.length) {
        setLoading(false)
        return
      }

      // 4. Check SDK installation status for each project
      const { data: installs } = await sb
        .from('sdk_installations')
        .select('project_id')
        .in('project_id', projects.map((p) => p.id))
        .eq('status', 'active')

      const activeProjectIds = new Set((installs ?? []).map((i) => i.project_id))

      // 5. Map to ConnectedApp shape
      const mapped = projects.map((p) => toConnectedApp(p as ProjectRow, activeProjectIds.has(p.id)))

      if (!cancelled) {
        setApps(mapped)
        // Restore last-used project from localStorage, else default to first
        const saved = localStorage.getItem('paaq_active_project')
        const initial = mapped.find((a) => a.id === saved) ?? mapped[0]
        setActiveId(initial.id)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
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
