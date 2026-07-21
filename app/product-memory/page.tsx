import { BrainCircuit } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { memoryEntries, type Tone } from '@/lib/data'

const catTone: Record<string, Tone> = {
  Decision: 'ai',
  Infrastructure: 'intel',
  Launch: 'healthy',
}

export default function ProductMemoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<BrainCircuit className="h-5 w-5" />}
        title="Product Memory"
        desc="A living knowledge graph of decisions, launches and infrastructure changes — so the platform remembers why things are the way they are."
        actions={
          <div className="w-64 max-w-full">
            <input
              type="text"
              placeholder="Ask the product's memory..."
              className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ai/50"
            />
          </div>
        }
      />

      <Card className="border-ai/30 bg-ai/5">
        <div className="flex flex-col gap-2 p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ai">Memory recall</p>
          <p className="text-pretty text-sm text-foreground">
            The onboarding flow was reordered to verify identity before document upload in March 2035, after data showed a
            40% drop at the upload step. The current upload failures are a regression against that decision.
          </p>
          <ToneBadge tone="ai" dot>Linked to INC-1042 · 3 related decisions</ToneBadge>
        </div>
      </Card>

      <Card>
        <CardHead title="Knowledge Timeline" desc="Institutional memory, newest first." />
        <div className="relative px-5 pb-5">
          <div className="absolute left-[27px] top-0 bottom-5 w-px bg-border" />
          <div className="flex flex-col gap-5">
            {memoryEntries.map((m) => (
              <div key={m.title} className="relative flex gap-4 pl-4">
                <div className="relative z-10 mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-card">
                  <BrainCircuit className="h-3 w-3 text-ai" />
                </div>
                <div className="flex-1 rounded-lg border border-border/70 bg-card/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ToneBadge tone={catTone[m.category] ?? 'intel'}>{m.category}</ToneBadge>
                      <h3 className="text-sm font-medium text-foreground">{m.title}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">{m.date}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{m.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="text-healthy">{m.metrics}</span>
                    <span>{m.people.join(' · ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
