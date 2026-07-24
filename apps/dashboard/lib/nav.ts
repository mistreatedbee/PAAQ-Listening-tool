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
      { label: 'Settings',             href: '/settings', icon: SlidersHorizontal },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = navGroups.flatMap((g) => g.items)
export const flatNav: NavItem[] = NAV_ITEMS
