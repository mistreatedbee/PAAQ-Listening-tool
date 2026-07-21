import { PageHeader, Card, CardHead } from '@/components/kit'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { SystemMap } from '@/components/dashboard/system-map'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { HomeInsights } from '@/components/dashboard/home-insights'
import { Sparkles, Download, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        desc="A single operating surface for monitoring, understanding, predicting and resolving everything across your ecosystem."
        actions={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90">
              <Zap className="h-4 w-4" /> Ask AI
            </button>
          </>
        }
      />

      <KpiGrid />

      <SystemMap />

      <ActivityFeed />

      <Card>
        <CardHead
          title="AI Insights"
          desc="What is happening, why, and what to do about it"
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
