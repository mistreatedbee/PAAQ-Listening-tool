import {
  LayoutDashboard,
  AlertTriangle,
  Route,
  Rocket,
  Shield,
  Sparkles,
  BrainCircuit,
  Bot,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  badgeTone?: 'intel' | 'healthy' | 'warning' | 'critical' | 'ai'
}

// Nine fixed tabs — the PAAQ Listening Tool shell never changes.
// What changes is the content inside each tab, driven by the connected app's config.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',       href: '/',               icon: LayoutDashboard },
  { label: 'Incidents',      href: '/incidents',      icon: AlertTriangle },
  { label: 'User Journeys',  href: '/user-journey',   icon: Route },
  { label: 'Deployments',    href: '/deployments',    icon: Rocket },
  { label: 'Security',       href: '/security',       icon: Shield },
  { label: 'AI Insights',    href: '/ai-insights',    icon: Sparkles },
  { label: 'Product Memory', href: '/product-memory', icon: BrainCircuit },
  { label: 'Agents',         href: '/ai-agents',      icon: Bot },
  { label: 'Settings',       href: '/settings',       icon: Settings },
]

// Keep flatNav for backwards compat with any components that import it
export const flatNav: NavItem[] = NAV_ITEMS
export const navGroups = [{ title: 'Navigation', items: NAV_ITEMS }]
