import { PlaySquare } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function SessionReplayPage() {
  return (
    <ModuleScaffold
      icon={PlaySquare}
      title="Session Replay"
      desc="Reconstruct real user sessions frame-by-frame. The AI auto-tags rage clicks, dead clicks and the exact moment things went wrong."
      stats={[
        { label: 'Sessions (24h)', value: '48.2k', tone: 'intel', spark: [30, 34, 38, 40, 44, 46, 47, 48] },
        { label: 'Rage Clicks', value: '1,204', tone: 'critical', spark: [4, 5, 6, 7, 8, 9, 11, 12] },
        { label: 'Dead Clicks', value: '860', tone: 'warning', spark: [6, 6, 7, 8, 8, 9, 8, 9] },
        { label: 'Avg Duration', value: '3m 42s', tone: 'healthy', spark: [3, 3, 4, 4, 4, 4, 4, 4] },
      ]}
      capabilities={[
        'Frame-accurate DOM replay with network waterfall',
        'Automatic rage-click and dead-click tagging',
        'Console and error correlation per session',
        'Jump straight to the friction moment',
        'Privacy masking of sensitive fields',
        'Link sessions to incidents and insights',
      ]}
      aiNote="184 sessions in the last hour ended at the document-upload step with repeated rage clicks on the retry button — strongly consistent with incident INC-1042."
    />
  )
}
