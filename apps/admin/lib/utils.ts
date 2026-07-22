export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function fmtBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function planBadgeClass(plan: string): string {
  const map: Record<string, string> = {
    starter: 'badge-plan-starter',
    growth: 'badge-plan-growth',
    business: 'badge-plan-business',
    enterprise: 'badge-plan-enterprise',
  }
  return map[plan] ?? 'badge-muted'
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-healthy',
    trial: 'badge-accent',
    suspended: 'badge-warning',
    churned: 'badge-critical',
    healthy: 'badge-healthy',
    degraded: 'badge-warning',
    down: 'badge-critical',
    rotating: 'badge-warning',
    revoked: 'badge-critical',
    expired: 'badge-muted',
  }
  return map[status] ?? 'badge-muted'
}

export function maskToken(token: string): string {
  if (token.length <= 8) return token
  const prefix = token.split('_').slice(0, 2).join('_') + '_'
  return prefix + '•'.repeat(12) + token.slice(-4)
}

export function platformIcon(platform: string): string {
  const map: Record<string, string> = {
    flutter: '🦋', react: '⚛️', nextjs: '▲', android: '🤖', ios: '🍎', nodejs: '🟢', other: '📦',
  }
  return map[platform] ?? '📦'
}
