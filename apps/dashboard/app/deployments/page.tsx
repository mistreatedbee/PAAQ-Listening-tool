import { Rocket } from 'lucide-react'
import { PageHeader, Card, CardHead } from '@/components/kit'

export default function DeploymentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Rocket className="h-5 w-5" />}
        title="Deployment Intelligence"
        desc="Every release scored for health impact. AI correlates deploys with error and latency changes to catch regressions instantly."
      />

      <Card>
        <CardHead title="Recent Deployments" desc="Health-scored release history across all services." />
        <div className="p-10 text-center">
          <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">
            No deployments tracked yet. Connect your CI/CD pipeline to get started.
          </p>
        </div>
      </Card>
    </div>
  )
}
