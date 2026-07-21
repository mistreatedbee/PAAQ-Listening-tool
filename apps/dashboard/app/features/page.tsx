import { Blocks } from 'lucide-react'
import { PageHeader, Card } from '@/components/kit'

export default function FeaturesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Blocks className="h-5 w-5" />}
        title="Feature Health"
        desc="Every feature scored on success, completion and satisfaction — with an AI recommendation to improve each one."
      />

      <Card className="p-10 text-center">
        <Blocks className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
        <p className="text-sm font-medium text-foreground">No features tracked yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Feature health scores will appear once the PAAQ SDK is sending feature usage events.
        </p>
      </Card>
    </div>
  )
}
