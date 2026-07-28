
import React from 'react';
import { CheckIcon } from 'lucide-react';
import { TEAL_GRADIENT, colors } from './theme';

const STEPS = ['Org', 'Product', 'Keys', 'Done'];

// currentStep is 1-based (1..4)
export function ProgressBar({ currentStep }: {currentStep: number;}) {
  return (
    <div className="mx-auto mb-10 flex max-w-md items-start">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const isLast = i === STEPS.length - 1;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
                style={
                isDone ?
                { background: colors.green, color: '#fff' } :
                isActive ?
                { background: TEAL_GRADIENT, color: '#fff', boxShadow: `0 0 0 4px ${colors.tealSoft}` } :
                { background: 'rgba(15,27,42,0.05)', color: colors.textMuted }
                }>
                
                {isDone ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : stepNum}
              </div>
              <span
                className="text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]"
                style={{ color: isActive ? colors.textPrimary : colors.textMuted }}>
                
                <span className="hidden sm:inline">{label}</span>
              </span>
            </div>
            {!isLast &&
            <div
              className="mt-3.5 h-px flex-1"
              style={{ background: stepNum < currentStep ? colors.green : colors.border }} />

            }
          </React.Fragment>);

      })}
    </div>);

}