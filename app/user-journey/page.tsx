import { Route, ArrowRight } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, ProgressRing } from '@/components/kit'
import { journeySteps, journeyScores, type JourneyStep, type Tone } from '@/lib/data'

const stepTone: Record<JourneyStep['status'], Tone> = {
  ok: 'healthy',
  friction: 'warning',
  fail: 'critical',
  exit: 'critical',
}

const stepLabel: Record<JourneyStep['status'], string> = {
  ok: 'Completed',
  friction: 'High friction',
  fail: 'Failed',
  exit: 'Abandoned',
}

export default function UserJourneyPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Route className="h-5 w-5" />}
        title="User Journey Explorer"
        desc="Reconstructed session path for a representative onboarding cohort. The AI flags friction, failures and the exact abandonment point."
        actions={<ToneBadge tone="critical" dot>Abandonment at step 4</ToneBadge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {journeyScores.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <ProgressRing value={s.value} tone={s.tone} label="%" />
            <div>
              <p className="text-sm font-medium text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">score</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHead title="Session Path" desc="Step-by-step flow with dwell time and interaction count." />
        <div className="flex flex-col gap-3 px-5 pb-5">
          {journeySteps.map((step, i) => (
            <div key={`${step.label}-${i}`} className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-xs font-medium tabular-nums text-muted-foreground">
                {i + 1}
              </div>
              <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border/70 bg-card/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{step.label}</span>
                  <ToneBadge tone={stepTone[step.status]}>{stepLabel[step.status]}</ToneBadge>
                </div>
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span>
                    Dwell <span className="font-mono text-foreground">{step.time}</span>
                  </span>
                  <span>
                    Clicks <span className="font-mono text-foreground">{step.clicks}</span>
                  </span>
                </div>
              </div>
              {i < journeySteps.length - 1 && (
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-ai/30 bg-ai/5">
        <CardHead title="AI Journey Analysis" desc="Product Analyst agent" />
        <div className="space-y-2 px-5 pb-5 text-sm text-muted-foreground">
          <p>
            Users breeze through login and registration but stall on <span className="text-foreground">Identity Verification</span>{' '}
            (4m 12s dwell, 21 clicks) before hitting repeated <span className="text-critical">upload failures</span>.
          </p>
          <p>
            After three failed upload attempts, 66% of the cohort abandons. Resolving the storage timeout would recover an
            estimated <span className="text-foreground">$12.4k MRR</span>.
          </p>
          <div className="pt-1">
            <ToneBadge tone="ai" dot>94% confidence</ToneBadge>
          </div>
        </div>
      </Card>
    </div>
  )
}
