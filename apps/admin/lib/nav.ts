import {
  LayoutDashboard,
  Building2,
  Key,
  Activity,
  BrainCircuit,
  Cpu,
  HeartPulse,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

export type AdminNavItem = {
  label: string
  href: string
  icon: LucideIcon
  desc: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Platform Overview', href: '/',           icon: LayoutDashboard, desc: 'Platform-wide KPIs and health' },
  { label: 'Tenants',           href: '/tenants',    icon: Building2,       desc: 'Manage companies and projects' },
  { label: 'Access Tokens',     href: '/tokens',     icon: Key,             desc: 'SDK keys, API secrets, webhooks' },
  { label: 'Event Monitor',     href: '/monitor',    icon: Activity,        desc: 'Real-time platform event stream' },
  { label: 'AI Monitor',        href: '/ai-monitor', icon: BrainCircuit,    desc: 'AI usage, cost, and latency' },
  { label: 'SDK Management',    href: '/sdk',        icon: Cpu,             desc: 'SDK releases and compatibility' },
  { label: 'System Health',     href: '/health',     icon: HeartPulse,      desc: 'Infrastructure and service status' },
  { label: 'Audit Center',      href: '/audit',      icon: ScrollText,      desc: 'All admin actions logged' },
]
