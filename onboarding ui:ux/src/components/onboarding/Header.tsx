
import React from 'react';
import { SparklesIcon } from 'lucide-react';
import { TEAL_GRADIENT, colors } from './theme';

export function Header({ stepName }: {stepName?: string;}) {
  return (
    <header
      className="sticky top-0 z-20 h-14 w-full border-b backdrop-blur-md"
      style={{ background: 'rgba(255,255,255,0.85)', borderColor: colors.border }}>
      
      <div className="mx-auto flex h-full max-w-2xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: TEAL_GRADIENT }}>
            
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-bold" style={{ color: colors.textPrimary }}>
            PAAQ Intelligence
          </span>
        </div>
        {stepName &&
        <span className="text-xs font-medium" style={{ color: colors.textMuted }}>
            Setup · {stepName}
          </span>
        }
      </div>
    </header>);

}