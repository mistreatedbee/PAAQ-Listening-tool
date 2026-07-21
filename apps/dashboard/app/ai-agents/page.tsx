import { Bot } from 'lucide-react'
import { PageHeader, Card } from '@/components/kit'

export default function AiAgentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="AI Agent Fleet"
        desc="Autonomous agents continuously watch, investigate and act across the platform. Each reports its current task and confidence."
      />

      <Card className="p-10 text-center">
        <Bot className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
        <p className="text-sm font-medium text-foreground">AI Agent Fleet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Autonomous agents will appear here once connected to live data streams.
        </p>
      </Card>
    </div>
  )
}
