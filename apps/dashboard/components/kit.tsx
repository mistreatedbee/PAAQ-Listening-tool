import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'
import { toneBg, toneSoft, toneText, toneVar } from '@/lib/tones'

/* ---------- Card ---------- */
export function Card({
  className,
  children,
  glass,
}: {
  className?: string
  children: ReactNode
  glass?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card/60 shadow-sm',
        glass && 'glass',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHead({
  title,
  desc,
  action,
  icon,
}: {
  title: string
  desc?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-muted-foreground">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

/* ---------- Status dot ---------- */
export function StatusDot({ tone, pulse = true }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {pulse && (
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-dot', toneBg[tone])} />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', toneBg[tone])} />
    </span>
  )
}

/* ---------- Tone badge ---------- */
export function ToneBadge({
  tone,
  children,
  className,
  dot,
}: {
  tone: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        toneSoft[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', toneBg[tone])} />}
      {children}
    </span>
  )
}

/* ---------- Sparkline ---------- */
export function Sparkline({
  data,
  tone,
  width = 96,
  height = 32,
}: {
  data: number[]
  tone: Tone
  width?: number
  height?: number
}) {
  const uid = useId()
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d - min) / range) * (height - 4) - 2
    return [x, y] as const
  })
  const line = pts.map((p) => `${p[0]},${p[1]}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`
  const id = `sp-${uid}`
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={toneVar[tone]} stopOpacity="0.35" />
          <stop offset="100%" stopColor={toneVar[tone]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={toneVar[tone]} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ---------- Area chart ---------- */
export function AreaChart({
  data,
  tone,
  height = 140,
  labels,
}: {
  data: number[]
  tone: Tone
  height?: number
  labels?: string[]
}) {
  const uid = useId()
  const width = 520
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d - min) / range) * (height - 24) - 12
    return [x, y] as const
  })
  const line = pts.map((p) => `${p[0]},${p[1]}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`
  const id = `area-${uid}`
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={toneVar[tone]} stopOpacity="0.28" />
            <stop offset="100%" stopColor={toneVar[tone]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={width} y1={height * g} y2={height * g} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 6" />
        ))}
        <polygon points={area} fill={`url(#${id})`} />
        <polyline points={line} fill="none" stroke={toneVar[tone]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {labels && (
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Progress ring ---------- */
export function ProgressRing({
  value,
  tone,
  size = 56,
  stroke = 5,
  label,
}: {
  value: number
  tone: Tone
  size?: number
  stroke?: number
  label?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneVar[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-center">
        <span className={cn('block text-sm font-semibold tabular-nums', toneText[tone])}>{value}</span>
        {label && <span className="block text-[9px] text-muted-foreground">{label}</span>}
      </span>
    </div>
  )
}

/* ---------- Meter bar ---------- */
export function Meter({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full', toneBg[tone])} style={{ width: `${value}%`, transition: 'width 0.6s ease' }} />
    </div>
  )
}

/* ---------- Confidence pill ---------- */
export function Confidence({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ai/25 bg-ai/10 px-2 py-0.5 text-[11px] font-medium text-ai">
      <span className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse-dot" />
      {value}% confidence
    </span>
  )
}

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  desc,
  actions,
  icon,
}: {
  title: string
  desc?: string
  actions?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-intel">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {desc && <p className="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
