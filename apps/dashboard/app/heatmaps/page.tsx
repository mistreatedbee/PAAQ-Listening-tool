import { Flame } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function HeatmapsPage() {
  return (
    <ModuleScaffold
      icon={Flame}
      title="Heatmaps"
      desc="Click, scroll and attention heatmaps across every screen, with AI callouts on where users struggle or lose interest."
      stats={[
        { label: 'Screens Tracked', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Avg Scroll Depth', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Dead Zones', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Frustration Hot Spots', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
      ]}
      capabilities={[
        'Click, tap and scroll heatmaps',
        'Attention and engagement mapping',
        'Dead-zone and unused-element detection',
        'Frustration hot-spot highlighting',
        'Compare heatmaps across releases',
        'Segment heatmaps by cohort or device',
      ]}
      aiNote="No data yet. Once users are interacting with your app and the PAAQ SDK is installed, heatmap analysis will appear here automatically."
    />
  )
}
