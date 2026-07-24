'use client'

import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { DashboardActions } from '@/components/dashboard/dashboard-actions'
import { AgentStatusBar } from '@/components/dashboard/agent-status-bar'
import { HomeIncidents } from '@/components/dashboard/home-incidents'
import { HomeRecommendations } from '@/components/dashboard/home-recommendations'
import { AppSwitcher } from '@/components/dashboard/app-switcher'
import { AiSummary } from '@/components/dashboard/ai-summary'
import { JourneyHealth } from '@/components/dashboard/journey-health'
import { KnowledgeCoverage } from '@/components/dashboard/knowledge-coverage'
import { AiDiscoveries } from '@/components/dashboard/ai-discoveries'
import { PredictedRisks } from '@/components/dashboard/predicted-risks'
import { LiveUsers } from '@/components/dashboard/live-users'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { WifiOff } from 'lucide-react'
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
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <AppSwitcher />
        <div className="flex-1">
          <AgentStatusBar />
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Organisation Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            What should I care about today — AI-powered intelligence across all connected applications, workflows, and systems.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DashboardActions />
        </div>
      </div>

      {/* Connect prompt */}
      {!anyConnected && (
        <div className="flex items-start gap-3 rounded-xl border border-ai/30 bg-ai/8 px-4 py-3">
          <WifiOff className="h-4 w-4 shrink-0 text-ai mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Connect your first application to get started</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PAAQ Intelligence will automatically begin learning your organisation's digital ecosystem within minutes.{' '}
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
                app.sdkStatus.backend  !== 'connected' && 'Server SDK not connected — API and performance intelligence limited.',
                app.sdkStatus.database !== 'connected' && 'Database connector missing — data-layer intelligence unavailable.',
              ].filter(Boolean).join(' ')}{' '}
              <Link href="/settings?tab=integrations" className="font-medium text-intel hover:underline">Connect in Settings →</Link>
            </p>
          </div>
        </div>
      )}

      {/* 1 — Live Users + Connection Status */}
      <LiveUsers />

      {/* 2 — AI Summary (most prominent, full width) */}
      <AiSummary />

      {/* 2 — KPI strip */}
      <KpiGrid />

      {/* 3 — Journey Health | Predicted Issues */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <JourneyHealth />
        <PredictedRisks />
      </div>

      {/* 4 — AI Discoveries Today | AI Recommendations */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <AiDiscoveries />
        <HomeRecommendations />
      </div>

      {/* 5 — Knowledge Coverage (full width) */}
      <KnowledgeCoverage />

      {/* 6 — Emerging Risks | Activity Feed */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
        <HomeIncidents />
        <ActivityFeed />
      </div>
    </div>
  )
}
