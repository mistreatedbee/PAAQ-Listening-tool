import { PlaySquare } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function SessionReplayPage() {
  return (
    <ModuleScaffold
      icon={PlaySquare}
      title="Session Replay"
      desc="Reconstruct real user sessions frame-by-frame. The AI auto-tags rage clicks, dead clicks and the exact moment things went wrong."
      stats={[
        { label: 'Sessions (24h)', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Rage Clicks', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Dead Clicks', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Avg Duration', value: '—', tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
      ]}
      capabilities={[
        'Frame-accurate DOM replay with network waterfall',
        'Automatic rage-click and dead-click tagging',
        'Console and error correlation per session',
        'Jump straight to the friction moment',
        'Privacy masking of sensitive fields',
        'Link sessions to incidents and insights',
      ]}
      aiNote="No data yet. Once sessions are being captured by the PAAQ SDK, replay analysis will appear here automatically."
    />
  )
}
