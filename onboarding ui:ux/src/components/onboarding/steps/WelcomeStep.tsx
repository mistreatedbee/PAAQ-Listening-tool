

import React from 'react';
import { ArrowRightIcon, SparklesIcon } from 'lucide-react';
import { colors } from '../theme';
import { PrimaryButton } from '../ui';

const BENEFITS = [
{ n: '01', title: 'Set up your org', body: 'Add your company details to create your PAAQ account.' },
{ n: '02', title: 'Connect your digital product', body: 'Pick your stack and grab the right SDK in seconds.' },
{ n: '03', title: 'Start getting AI insights in minutes', body: 'Agents begin analysing your product right away.' }];


export function WelcomeStep({ onNext }: {onNext: () => void;}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center">
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: colors.tealSoft, color: colors.teal, border: `1px solid rgba(39,166,206,0.25)` }}>
          
          <SparklesIcon className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: colors.textPrimary }}>
          Welcome to PAAQ Intelligence
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed" style={{ color: colors.textSecondary }}>
          AI that listens to your digital product and tells you what's happening — and why.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {BENEFITS.map((b) =>
        <div
          key={b.n}
          className="rounded-2xl border bg-white p-5"
          style={{ borderColor: colors.border }}>
          
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors.teal }}>
              {b.n}
            </div>
            <div className="mt-2 text-sm font-bold" style={{ color: colors.textPrimary }}>
              {b.title}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: colors.textMuted }}>
              {b.body}
            </p>
          </div>
        )}
      </div>

      <PrimaryButton onClick={onNext} className="w-full">
        Get started
        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
      </PrimaryButton>

      <p className="text-center text-xs" style={{ color: colors.textMuted }}>
        Takes about 3 minutes · No credit card needed
      </p>
    </div>);

}