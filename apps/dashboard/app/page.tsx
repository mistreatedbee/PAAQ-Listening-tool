import { PageHeader, Card, CardHead } from '@/components/kit'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { SystemMap } from '@/components/dashboard/system-map'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { HomeInsights } from '@/components/dashboard/home-insights'
import { DashboardActions } from '@/components/dashboard/dashboard-actions'
import { Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        desc="Real-time intelligence across Ask, Book, Attend and Learn — every session, error, AI signal and incident in one surface."
        actions={<DashboardActions />}
      />

      <KpiGrid />

      <SystemMap />

      <ActivityFeed />

      <Card>
        <CardHead
          title="AI Insights"
          desc="What is happening across the PAAQ platform, why, and what to do about it"
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
