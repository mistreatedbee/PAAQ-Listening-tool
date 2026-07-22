export type Tone = 'intel' | 'healthy' | 'warning' | 'critical' | 'ai'

export type Insight = {
  id: string
  title: string
  summary: string
  confidence: number
  impact: string
  affected: string
  severity: Tone
  actions: string[]
  priority?: string
  recommendedAction?: string
  evidence?: Record<string, unknown>
}
