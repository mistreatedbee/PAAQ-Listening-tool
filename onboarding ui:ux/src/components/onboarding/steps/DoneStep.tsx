




import React from 'react';
import { ActivityIcon, BarChart3Icon, CheckCircle2Icon, FlameIcon, SparklesIcon } from 'lucide-react';
import { colors } from '../theme';
import { PrimaryButton, Rule } from '../ui';
import { StepShell } from '../StepShell';

const CARDS = [
{ icon: BarChart3Icon, title: 'Dashboard', desc: 'Overview of your product health & KPIs' },
{ icon: ActivityIcon, title: 'Live Events', desc: 'Real-time stream of events and sessions' },
{ icon: SparklesIcon, title: 'AI Insights', desc: 'AI-generated patterns and recommendations' },
{ icon: FlameIcon, title: 'Incidents', desc: 'Auto-detected issues and root causes' }];


export function DoneStep({ projectName, onFinish }: {projectName: string;onFinish: () => void;}) {
  return (
    <StepShell
      icon={<CheckCircle2Icon className="h-8 w-8" aria-hidden="true" />}
      iconTone="green"
      iconSize="lg"
      title="You're all set!"
      subtitle={
      <>
          <strong style={{ color: colors.textPrimary }}>{projectName || 'Your project'}</strong> is connected to PAAQ
          Intelligence. AI agents are already getting to work.
        </>
      }>
      
      <Rule />

      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map(({ icon: Icon, title, desc }) =>
        <div
          key={title}
          className="flex items-start gap-3 rounded-2xl border bg-white p-4"
          style={{ borderColor: colors.border }}>
          
            <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: colors.tealSoft, color: colors.teal }}>
            
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold" style={{ color: colors.textPrimary }}>
                {title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: colors.textMuted }}>
                {desc}
              </span>
            </span>
          </div>
        )}
      </div>

      <Rule />

      <PrimaryButton onClick={onFinish} className="w-full">
        <CheckCircle2Icon className="h-4 w-4" aria-hidden="true" />
        Open my dashboard
      </PrimaryButton>

      <p className="text-center text-xs" style={{ color: colors.textMuted }}>
        Your credentials and install guide are always available in Settings → SDK Setup.
      </p>
    </StepShell>);

}