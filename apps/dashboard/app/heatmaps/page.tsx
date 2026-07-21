import { Flame } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function HeatmapsPage() {
  return (
    <ModuleScaffold
      icon={Flame}
      title="Heatmaps"
      desc="Click, scroll and attention heatmaps across every screen, with AI callouts on where users struggle or lose interest."
      stats={[
        { label: 'Screens Tracked', value: '128', tone: 'intel', spark: [110, 114, 118, 120, 124, 126, 127, 128] },
        { label: 'Avg Scroll Depth', value: '68%', tone: 'healthy', spark: [60, 62, 64, 65, 66, 67, 68, 68] },
        { label: 'Dead Zones', value: '14', tone: 'warning', spark: [8, 9, 10, 11, 12, 13, 14, 14] },
        { label: 'Frustration Hot Spots', value: '3', tone: 'critical', spark: [1, 1, 2, 2, 2, 3, 3, 3] },
      ]}
      capabilities={[
        'Click, tap and scroll heatmaps',
        'Attention and engagement mapping',
        'Dead-zone and unused-element detection',
        'Frustration hot-spot highlighting',
        'Compare heatmaps across releases',
        'Segment heatmaps by cohort or device',
      ]}
      aiNote="The upload screen shows an intense frustration hot spot on the retry button — the top interaction on that screen is now users repeatedly tapping a control that fails."
    />
  )
}
