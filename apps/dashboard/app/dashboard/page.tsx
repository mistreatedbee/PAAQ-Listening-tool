'use client'

import { Card, CardHead } from '@/components/kit'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { SystemMap } from '@/components/dashboard/system-map'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { HomeInsights } from '@/components/dashboard/home-insights'
import { DashboardActions } from '@/components/dashboard/dashboard-actions'
import { AgentStatusBar } from '@/components/dashboard/agent-status-bar'
import { HomeIncidents } from '@/components/dashboard/home-incidents'
import { HomeRecommendations } from '@/components/dashboard/home-recommendations'
import { AppSwitcher } from '@/components/dashboard/app-switcher'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Sparkles, ArrowRight, WifiOff } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { app } = useConnectedApp()

  const anyConnected = app.sdkStatus.frontend === 'connected'
    || app.sdkStatus.backend === 'connected'
    || app.sdkStatus.database === 'connected'

  const connectedCount = [app.sdkStatus.frontend, app.sdkStatus.backend, app.sdkStatus.database]
    .filter((s) => s === 'connected').length

  return (
    <div className="space-y-5">
      {/* Top bar: App switcher left, agent status right */}
      <div className="flex flex-wrap items-center gap-3">
        <AppSwitcher />
        <div className="flex-1">
          <AgentStatusBar />
        </div>
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-1 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Organisation Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            How is your organisation operating right now — AI-powered intelligence across all connected applications, workflows, and systems.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DashboardActions />
        </div>
      </div>

      {/* Prompt to connect if nothing is wired up */}
      {!anyConnected && (
        <div className="flex items-start gap-3 rounded-xl border border-ai/30 bg-ai/8 px-4 py-3">
          <WifiOff className="h-4 w-4 shrink-0 text-ai mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Connect your first application to get started</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Once connected, PAAQ Intelligence will automatically begin learning how your organisation's digital ecosystem operates.{' '}
              <Link href="/settings?tab=integrations" className="font-medium text-ai hover:underline">Connect in Settings →</Link>
            </p>
          </div>
        </div>
      )}

      {/* Partial connection notice */}
      {anyConnected && connectedCount < 3 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3">
          <WifiOff className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{connectedCount}/3 systems connected — expand coverage for deeper intelligence</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[
                app.sdkStatus.frontend !== 'connected' && 'Web SDK not connected — user journey intelligence unavailable.',
                app.sdkStatus.backend !== 'connected' && 'Server SDK not connected — API and performance intelligence limited.',
                app.sdkStatus.database !== 'connected' && 'Database connector missing — data-layer intelligence unavailable.',
              ].filter(Boolean).join(' ')}{' '}
              <Link href="/settings?tab=integrations" className="font-medium text-intel hover:underline">Connect in Settings →</Link>
            </p>
          </div>
        </div>
      )}

      {/* Operational KPI strip */}
      <KpiGrid />

      {/* Primary grid: Connected systems overview + AI Recommendations */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <SystemMap />
        <HomeRecommendations />
      </div>

      {/* Secondary grid: AI Insights + Emerging Risks */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHead
            title="AI Insights"
            desc="What is happening across your organisation, why it matters, and what to do about it"
            icon={<Sparkles className="h-4 w-4 text-ai" />}
            action={
              <Link href="/ai-insights" className="flex items-center gap-1 text-xs font-medium text-intel hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="px-5 pb-5">
            <HomeInsights />
          </div>
        </Card>
        <HomeIncidents />
      </div>

      {/* Activity feed */}
      <ActivityFeed />
    </div>
  )
}
