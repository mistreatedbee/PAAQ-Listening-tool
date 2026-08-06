import {
  LayoutDashboard,
  AlertTriangle,
  Bug,
  Route,
  Rocket,
  Shield,
  Sparkles,
  BrainCircuit,
  Bot,
  Settings,
  BookOpen,
  Gauge,
  Activity,
  Lightbulb,
  Brain,
  Cable,
  SlidersHorizontal,
  Plug2,
  PlaySquare,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  badgeTone?: 'intel' | 'healthy' | 'warning' | 'critical' | 'ai'
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

// Base nav configuration — the full static superset used for search (topbar)
// and as the source groups `getNavGroups` starts from. Kept exported as
// `navGroups` for backwards compatibility with anything doing a flat lookup
// of every possible nav item (see NAV_ITEMS/flatNav below), but page chrome
// (the sidebar) should call `getNavGroups(...)` instead so the System group
// can collapse once an app is fully connected.
export const navGroups: NavGroup[] = [
  {
    title: 'Intelligence',
    items: [
      { label: 'Overview',          href: '/dashboard',        icon: LayoutDashboard },
      { label: 'AI Insights',       href: '/ai-insights',      icon: Sparkles },
      { label: 'Recommendations',   href: '/recommendations',  icon: Lightbulb },
      { label: 'Emerging Risks',    href: '/incidents',        icon: AlertTriangle },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'User Experience',   href: '/user-journey',     icon: Route },
      { label: 'Session Replay',    href: '/session-replay',   icon: PlaySquare, badge: 'AI', badgeTone: 'ai' },
      { label: 'Error Tracking',    href: '/errors',           icon: Activity },
      { label: 'Performance',       href: '/performance',      icon: Gauge },
      { label: 'Security',          href: '/security',         icon: Shield },
      { label: 'Deployments',       href: '/deployments',      icon: Rocket },
    ],
  },
  {
    title: 'Knowledge',
    items: [
      { label: 'Knowledge Base',    href: '/knowledge',        icon: BookOpen, badge: 'AI', badgeTone: 'ai' },
      { label: 'Knowledge Graph',   href: '/knowledge/graph',  icon: BrainCircuit },
      { label: 'AI Agents',         href: '/ai-agents',        icon: Bot },
      { label: 'Product Memory',    href: '/product-memory',   icon: Brain },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Setup & Integrations', href: '/setup',    icon: Cable },
      { label: 'Connect',              href: '/connect',  icon: Plug2, badge: 'MCP', badgeTone: 'ai' },
      { label: 'Settings',             href: '/settings', icon: SlidersHorizontal },
    ],
  },
]

// Once at least one app is fully connected (frontend + backend + database),
// the "Connect" / "Setup & Integrations" entry points are no longer the
// primary thing a user needs — replaced by a single "Manage Application"
// link into that app's lifecycle page.
export function getNavGroups(anyAppFullyConnected: boolean, activeAppId?: string): NavGroup[] {
  if (!anyAppFullyConnected) return navGroups

  const manageHref = activeAppId ? `/apps/${activeAppId}` : '/setup'

  return navGroups.map((group) => {
    if (group.title !== 'System') return group
    return {
      ...group,
      items: [
        { label: 'Manage Application', href: manageHref, icon: LayoutGrid },
        ...group.items.filter((item) => item.href !== '/connect' && item.href !== '/setup'),
      ],
    }
  })
}

// Full static superset of every nav item, regardless of connection state —
// used by the topbar's quick-search, which should still be able to jump to
// /connect or /setup even when they're hidden from the sidebar.
export const NAV_ITEMS: NavItem[] = navGroups.flatMap((g) => g.items)
export const flatNav: NavItem[] = NAV_ITEMS
