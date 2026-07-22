'use client'

import { Card, CardHead } from '@/components/kit'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { SystemMap } from '@/components/dashboard/system-map'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { HomeInsights } from '@/components/dashboard/home-insights'
import { DashboardActions } from '@/components/dashboard/dashboard-actions'
import { AgentStatusBar } from '@/components/dashboard/agent-status-bar'
import { CriticalFlows } from '@/components/dashboard/critical-flows'
import { HomeIncidents } from '@/components/dashboard/home-incidents'
import { HomeRecommendations } from '@/components/dashboard/home-recommendations'
import { AppSwitcher } from '@/components/dashboard/app-switcher'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Sparkles, ArrowRight, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { app } = useConnectedApp()

  const allConnected = app.sdkStatus.frontend === 'connected'
    && app.sdkStatus.backend === 'connected'
    && app.sdkStatus.database === 'connected'

  return (
    <div className="space-y-5">
      {/* Top bar: App switcher left, agent status right */}
      <div className="flex flex-wrap items-center gap-3">
        <AppSwitcher />
        <div className="flex-1">
          <AgentStatusBar />
        </div>
      </div>

      {/* Page header — adapts to connected app */}
      <div className="flex flex-col gap-1 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {app.name} · Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Real-time intelligence across{' '}
            {app.featureAreas.map((fa, i) => (
              <span key={fa.id}>
                <span style={{ color: fa.color }} className="font-semibold">{fa.label}</span>
                {i < app.featureAreas.length - 1 ? (i === app.featureAreas.length - 2 ? ' and ' : ', ') : ''}
              </span>
            ))}
            {' '}— every session, error, AI signal and incident in one surface.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DashboardActions />
        </div>
      </div>

      {/* Integration warning if not all connected */}
      {!allConnected && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3">
          <WifiOff className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Partial integration — some data is unavailable</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[
                app.sdkStatus.frontend !== 'connected' && 'Frontend SDK not connected — user journey data unavailable.',
                app.sdkStatus.backend !== 'connected' && 'Backend SDK not connected — deployment and latency data unavailable.',
                app.sdkStatus.database !== 'connected' && 'Database connector not connected — security and memory tabs are limited.',
              ].filter(Boolean).join(' ')}
              {' '}
              <Link href="/settings?tab=integrations" className="font-medium text-intel hover:underline">Connect in Settings →</Link>
            </p>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <KpiGrid />

      {/* Feature area health map + Incidents */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <SystemMap />
        <HomeIncidents />
      </div>

      {/* Critical flows + AI recommendations */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <CriticalFlows />
        <HomeRecommendations />
      </div>

      {/* Activity feed */}
      <ActivityFeed />

      {/* AI Insights */}
      <Card>
        <CardHead
          title="AI Insights"
          desc={`What is happening across ${app.name}, why, and what to do about it`}
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
    </div>
  )
}
