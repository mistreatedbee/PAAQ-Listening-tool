
import React, { useState } from 'react';
import { ArrowRightIcon, CheckIcon, CopyIcon, Loader2Icon } from 'lucide-react';
import { TEAL_GRADIENT, colors } from './theme';

// ---------- PrimaryButton ----------
interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  type?: 'button' | 'submit';
  className?: string;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  loadingLabel = 'Working…',
  type = 'button',
  className = ''
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{ background: TEAL_GRADIENT }}
      className={`flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>
      
      {loading ?
      <>
          <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
          {loadingLabel}
        </> :

      children
      }
    </button>);

}

// ---------- SecondaryButton ----------
interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function SecondaryButton({ children, onClick, className = '' }: SecondaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ borderColor: colors.borderStrong, color: colors.textSecondary }}
      className={`flex h-12 items-center justify-center gap-2 rounded-xl border bg-white px-5 text-sm font-semibold transition-colors hover:bg-slate-50 ${className}`}>
      
      {children}
    </button>);

}

// ---------- Field label ----------
export function FieldLabel({
  children,
  required,
  optional




}: {children: React.ReactNode;required?: boolean;optional?: boolean;}) {
  return (
    <label className="mb-2 flex items-center gap-1 text-sm font-semibold" style={{ color: colors.textPrimary }}>
      {children}
      {required && <span style={{ color: colors.teal }}>*</span>}
      {optional &&
      <span className="text-xs font-normal" style={{ color: colors.textMuted }}>
          (optional)
        </span>
      }
    </label>);

}

// ---------- TextInput ----------
interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  onEnter?: () => void;
  ariaLabel?: string;
  type?: string;
}

export function TextInput({ value, onChange, placeholder, icon, onEnter, ariaLabel, type = 'text' }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      {icon &&
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
          {icon}
        </span>
      }
      <input
        type={type}
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter();
        }}
        style={{
          borderColor: focused ? colors.focus : colors.border,
          boxShadow: focused ? `0 0 0 3px ${colors.tealSoft}` : 'none',
          paddingLeft: icon ? '2.5rem' : '1rem'
        }}
        className="h-12 w-full rounded-xl border bg-white pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400" />
      
    </div>);

}

// ---------- SelectDropdown ----------
interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  ariaLabel?: string;
}

export function SelectDropdown({ value, onChange, options, placeholder, ariaLabel }: SelectProps) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        borderColor: focused ? colors.focus : colors.border,
        boxShadow: focused ? `0 0 0 3px ${colors.tealSoft}` : 'none',
        color: value ? colors.textPrimary : colors.textPlaceholder
      }}
      className="h-12 w-full appearance-none rounded-xl border bg-white bg-[length:16px] bg-[right_1rem_center] bg-no-repeat px-4 text-sm outline-none transition-all">
      
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) =>
      <option key={o} value={o} style={{ color: colors.textPrimary }}>
          {o}
        </option>
      )}
    </select>);

}

// ---------- Divider ----------
export function LabeledDivider({ children }: {children: React.ReactNode;}) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="h-px flex-1" style={{ background: colors.border }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textMuted }}>
        {children}
      </span>
      <span className="h-px flex-1" style={{ background: colors.border }} />
    </div>);

}

export function Rule() {
  return <hr className="border-0 border-t" style={{ borderColor: colors.border }} />;
}

// ---------- CopyButton ----------
export function CopyButton({ text, label = 'Copy' }: {text: string;label?: string;}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      style={{ borderColor: colors.borderStrong, color: copied ? colors.green : colors.textSecondary }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-50">
      
      {copied ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? 'Copied!' : label}
    </button>);

}

// ---------- StepFooter (Back / Continue) ----------
interface StepFooterProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  backLabel?: string;
}

export function StepFooter({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  loading,
  loadingLabel,
  backLabel = 'Back'
}: StepFooterProps) {
  return (
    <div className="flex gap-3">
      {onBack &&
      <SecondaryButton onClick={onBack}>
          <ArrowRightIcon className="h-4 w-4 rotate-180" aria-hidden="true" />
          {backLabel}
        </SecondaryButton>
      }
      <PrimaryButton
        onClick={onNext}
        disabled={nextDisabled}
        loading={loading}
        loadingLabel={loadingLabel}
        className="flex-1">
        
        {nextLabel}
        {!loading && <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />}
      </PrimaryButton>
    </div>);

}