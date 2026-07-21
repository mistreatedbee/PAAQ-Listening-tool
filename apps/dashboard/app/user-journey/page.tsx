import { Route } from 'lucide-react'
import { PageHeader, Card, CardHead } from '@/components/kit'

export default function UserJourneyPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Route className="h-5 w-5" />}
        title="User Journey Explorer"
        desc="Reconstructed session path for a representative onboarding cohort. The AI flags friction, failures and the exact abandonment point."
      />

      <Card>
        <CardHead title="Session Path" desc="Step-by-step flow with dwell time and interaction count." />
        <div className="p-10 text-center">
          <Route className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">
            No journey data yet. Session paths will appear once users are being tracked.
          </p>
        </div>
      </Card>
    </div>
  )
}
