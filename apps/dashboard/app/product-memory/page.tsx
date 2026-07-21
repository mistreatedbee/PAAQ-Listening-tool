import { BrainCircuit } from 'lucide-react'
import { PageHeader, Card, CardHead } from '@/components/kit'

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

      <Card>
        <CardHead title="Knowledge Timeline" desc="Institutional memory, newest first." />
        <div className="p-10 text-center">
          <BrainCircuit className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">
            No entries yet. Decisions and launches will be recorded here automatically.
          </p>
        </div>
      </Card>
    </div>
  )
}
