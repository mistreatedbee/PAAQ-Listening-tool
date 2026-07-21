import { Users } from 'lucide-react'
import { ModuleScaffold } from '@/components/module-scaffold'

export default function UsersPage() {
  return (
    <ModuleScaffold
      icon={Users}
      title="Users"
      desc="A unified view of every user with cohort behaviour, health scores and AI-detected churn and expansion signals."
      stats={[
        { label: 'Total Users', value: '482k', tone: 'intel', spark: [40, 42, 44, 45, 46, 47, 47, 48] },
        { label: 'Online Now', value: '18.4k', tone: 'healthy', spark: [12, 13, 14, 15, 16, 17, 18, 18] },
        { label: 'At-Risk (churn)', value: '2,140', tone: 'critical', spark: [1, 1.2, 1.5, 1.7, 1.9, 2, 2.1, 2.1] },
        { label: 'D7 Retention', value: '44%', tone: 'healthy', spark: [38, 39, 40, 41, 42, 43, 44, 44] },
      ]}
      capabilities={[
        'Per-user timeline of events and sessions',
        'Cohort and segment builder',
        'AI churn and expansion scoring',
        'Health score by engagement and outcomes',
        'Plan, region and device breakdowns',
        'One-click jump to a user\u2019s sessions',
      ]}
      aiNote="2,140 users are newly at-risk today — 78% of them hit the onboarding upload failure. Resolving INC-1042 is projected to recover most of this cohort."
    />
  )
}
