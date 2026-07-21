import {
  LayoutDashboard,
  Radio,
  Sparkles,
  AlertTriangle,
  Route,
  Users,
  Blocks,
  BarChart3,
  Flame,
  PlaySquare,
  Gauge,
  Bug,
  Shield,
  Rocket,
  Database,
  Activity,
  Server,
  Bot,
  BrainCircuit,
  FileText,
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

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Live Monitoring', href: '/live-monitoring', icon: Radio, badge: 'live', badgeTone: 'healthy' },
      { label: 'AI Insights', href: '/ai-insights', icon: Sparkles, badge: '7', badgeTone: 'ai' },
      { label: 'Incidents', href: '/incidents', icon: AlertTriangle, badge: '3', badgeTone: 'critical' },
    ],
  },
  {
    title: 'Experience',
    items: [
      { label: 'User Journey Explorer', href: '/user-journey', icon: Route },
      { label: 'Session Replay', href: '/session-replay', icon: PlaySquare },
      { label: 'Users', href: '/users', icon: Users },
      { label: 'Features', href: '/features', icon: Blocks },
      { label: 'Product Analytics', href: '/product-analytics', icon: BarChart3 },
      { label: 'Heatmaps', href: '/heatmaps', icon: Flame },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Performance', href: '/performance', icon: Gauge },
      { label: 'Errors', href: '/errors', icon: Bug, badge: '12', badgeTone: 'warning' },
      { label: 'Security', href: '/security', icon: Shield },
      { label: 'Deployments', href: '/deployments', icon: Rocket },
      { label: 'Database', href: '/database', icon: Database },
      { label: 'API Health', href: '/api-health', icon: Activity },
      { label: 'Infrastructure', href: '/infrastructure', icon: Server },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'AI Agents', href: '/ai-agents', icon: Bot, badge: '8', badgeTone: 'ai' },
      { label: 'Product Memory', href: '/product-memory', icon: BrainCircuit },
      { label: 'Reports', href: '/reports', icon: FileText },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

export const flatNav: NavItem[] = navGroups.flatMap((g) => g.items)
