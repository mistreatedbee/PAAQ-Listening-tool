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
  Cpu,
  Network,
  FileSearch,
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
    title: 'Monitoring',
    items: [
      { label: 'Overview',       href: '/dashboard',      icon: LayoutDashboard },
      { label: 'Incidents',      href: '/incidents',      icon: AlertTriangle },
      { label: 'Errors',         href: '/errors',         icon: Bug },
      { label: 'User Journeys',  href: '/user-journey',   icon: Route },
      { label: 'Deployments',    href: '/deployments',    icon: Rocket },
      { label: 'Security',       href: '/security',       icon: Shield },
    ],
  },
  {
    title: 'Knowledge',
    items: [
      { label: 'App Knowledge',  href: '/knowledge',            icon: BookOpen, badge: 'New', badgeTone: 'ai' },
      { label: 'Features',       href: '/knowledge/features',   icon: Cpu },
      { label: 'APIs',           href: '/knowledge/apis',       icon: Network },
      { label: 'Journeys',       href: '/knowledge/journeys',   icon: Route },
      { label: 'Services',       href: '/knowledge/services',   icon: Sparkles },
      { label: 'Deployments',    href: '/knowledge/deployments',icon: Rocket },
      { label: 'Knowledge Graph',href: '/knowledge/graph',      icon: BrainCircuit },
      { label: 'Docs & Specs',   href: '/knowledge/docs',       icon: FileSearch },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'AI Insights',    href: '/ai-insights',    icon: Sparkles },
      { label: 'Product Memory', href: '/product-memory', icon: BrainCircuit },
      { label: 'Agents',         href: '/ai-agents',      icon: Bot },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings',       href: '/settings',       icon: Settings },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = navGroups.flatMap((g) => g.items)
export const flatNav: NavItem[] = NAV_ITEMS
