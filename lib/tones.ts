import type { Tone } from './data'

export const toneText: Record<Tone, string> = {
  intel: 'text-intel',
  healthy: 'text-healthy',
  warning: 'text-warning',
  critical: 'text-critical',
  ai: 'text-ai',
}

export const toneBg: Record<Tone, string> = {
  intel: 'bg-intel',
  healthy: 'bg-healthy',
  warning: 'bg-warning',
  critical: 'bg-critical',
  ai: 'bg-ai',
}

export const toneSoft: Record<Tone, string> = {
  intel: 'bg-intel/12 text-intel border-intel/25',
  healthy: 'bg-healthy/12 text-healthy border-healthy/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  critical: 'bg-critical/12 text-critical border-critical/25',
  ai: 'bg-ai/12 text-ai border-ai/25',
}

export const toneVar: Record<Tone, string> = {
  intel: 'var(--intel)',
  healthy: 'var(--healthy)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
  ai: 'var(--ai)',
}
