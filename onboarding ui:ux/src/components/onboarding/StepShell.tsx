

import React from 'react';
import { colors } from './theme';

interface StepShellProps {
  icon: React.ReactNode;
  iconTone?: 'teal' | 'green';
  iconSize?: 'md' | 'lg';
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}

export function StepShell({ icon, iconTone = 'teal', iconSize = 'md', title, subtitle, children }: StepShellProps) {
  const box = iconSize === 'lg' ? 'h-16 w-16' : 'h-14 w-14';
  const tone =
  iconTone === 'green' ?
  { background: colors.greenSoft, color: colors.green, border: `1px solid rgba(22,163,74,0.25)` } :
  { background: colors.tealSoft, color: colors.teal, border: `1px solid rgba(39,166,206,0.25)` };
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className={`mb-5 flex ${box} items-center justify-center rounded-2xl`} style={tone}>
          {icon}
        </div>
        <h1
          className={`${iconSize === 'lg' ? 'text-3xl' : 'text-2xl'} font-black tracking-tight`}
          style={{ color: colors.textPrimary }}>
          
          {title}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: colors.textSecondary }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>);

}