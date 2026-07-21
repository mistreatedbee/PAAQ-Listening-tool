export type Tone = 'intel' | 'healthy' | 'warning' | 'critical' | 'ai'

/* ---------- Dashboard KPIs ---------- */
export type Kpi = {
  label: string
  value: string
  unit?: string
  delta: number
  tone: Tone
  spark: number[]
}

export const kpis: Kpi[] = [
  { label: 'System Health', value: '98.4', unit: '%', delta: 0.6, tone: 'healthy', spark: [90, 92, 91, 94, 95, 97, 96, 98] },
  { label: 'User Experience', value: '91.2', unit: '%', delta: 1.8, tone: 'healthy', spark: [82, 84, 86, 85, 88, 89, 90, 91] },
  { label: 'Application Health', value: '94.7', unit: '%', delta: -0.4, tone: 'intel', spark: [96, 95, 95, 94, 96, 95, 94, 95] },
  { label: 'AI Confidence', value: '96.1', unit: '%', delta: 2.3, tone: 'ai', spark: [88, 90, 91, 92, 93, 95, 95, 96] },
  { label: 'Open Incidents', value: '3', delta: 1, tone: 'critical', spark: [1, 1, 2, 1, 2, 2, 3, 3] },
  { label: 'Users Online', value: '18.4', unit: 'k', delta: 4.2, tone: 'intel', spark: [12, 13, 14, 15, 16, 17, 18, 18] },
  { label: 'Error Rate', value: '0.42', unit: '%', delta: 0.11, tone: 'warning', spark: [0.2, 0.25, 0.3, 0.28, 0.35, 0.38, 0.4, 0.42] },
  { label: 'Avg Response', value: '186', unit: 'ms', delta: -12, tone: 'healthy', spark: [220, 210, 205, 200, 195, 190, 188, 186] },
  { label: 'Database Health', value: '99.1', unit: '%', delta: 0.2, tone: 'healthy', spark: [98, 98, 99, 99, 98, 99, 99, 99] },
  { label: 'Security Status', value: 'Secure', delta: 0, tone: 'healthy', spark: [1, 1, 1, 1, 1, 1, 1, 1] },
  { label: 'Deployments', value: '14', unit: 'today', delta: 3, tone: 'intel', spark: [8, 9, 10, 11, 12, 13, 13, 14] },
  { label: 'AI Agents Active', value: '8', unit: '/ 8', delta: 0, tone: 'ai', spark: [8, 8, 8, 8, 8, 8, 8, 8] },
]

/* ---------- Live System Map ---------- */
export type ServiceNode = {
  id: string
  name: string
  status: 'healthy' | 'degraded' | 'critical'
  latency: string
  errors: string
  requests: string
  health: number
  detail: string
}

export const systemMap: ServiceNode[] = [
  { id: 'app', name: 'Flutter App', status: 'healthy', latency: '42ms', errors: '0.01%', requests: '128k/min', health: 99, detail: 'Client shell rendering nominally across iOS, Android and Web builds.' },
  { id: 'api', name: 'API Gateway', status: 'healthy', latency: '88ms', errors: '0.12%', requests: '96k/min', health: 97, detail: 'Edge gateway routing traffic to 24 upstream services.' },
  { id: 'auth', name: 'Authentication', status: 'degraded', latency: '312ms', errors: '1.4%', requests: '18k/min', health: 78, detail: 'Elevated latency on token refresh — correlated with deploy #1482.' },
  { id: 'db', name: 'Database', status: 'healthy', latency: '11ms', errors: '0.00%', requests: '210k/min', health: 99, detail: 'Primary + 3 read replicas. Connection pool at 62%.' },
  { id: 'storage', name: 'Storage', status: 'critical', latency: '1.2s', errors: '6.8%', requests: '9k/min', health: 41, detail: 'Object storage upload failures spiking — likely cause of onboarding drop-off.' },
  { id: 'workers', name: 'Background Workers', status: 'healthy', latency: '—', errors: '0.20%', requests: '42k/min', health: 95, detail: 'Queue depth 1,240 jobs. 12 workers scaled up automatically.' },
  { id: 'ai', name: 'AI Engine', status: 'healthy', latency: '640ms', errors: '0.30%', requests: '6k/min', health: 96, detail: 'Inference cluster running 8 active agents. GPU utilisation 71%.' },
  { id: 'notify', name: 'Notifications', status: 'healthy', latency: '120ms', errors: '0.05%', requests: '31k/min', health: 98, detail: 'Push, email and in-app channels operating normally.' },
]

/* ---------- Activity Feed ---------- */
export type ActivityEvent = {
  id: string
  time: string
  title: string
  meta: string
  severity: Tone
  category: string
}

export const activityFeed: ActivityEvent[] = [
  { id: 'a1', time: '12:04:21', title: 'Security alert: unusual login pattern', meta: 'Auth · 3 accounts flagged · US-East', severity: 'critical', category: 'Security' },
  { id: 'a2', time: '12:03:58', title: 'AI investigation started', meta: 'Incident Agent · Storage upload failures', severity: 'ai', category: 'AI' },
  { id: 'a3', time: '12:03:12', title: 'Document upload failed', meta: 'Storage · user_84f2 · timeout after 30s', severity: 'warning', category: 'Feature' },
  { id: 'a4', time: '12:02:40', title: 'Payment failed', meta: 'Billing · card declined · $49.00', severity: 'warning', category: 'Feature' },
  { id: 'a5', time: '12:01:55', title: 'Deployment completed', meta: 'CI/CD · deploy #1483 · api-gateway', severity: 'healthy', category: 'Deploy' },
  { id: 'a6', time: '12:01:10', title: 'API timeout', meta: 'API · /v2/verify · 502 · 14 requests', severity: 'critical', category: 'Feature' },
  { id: 'a7', time: '12:00:33', title: 'Database recovered', meta: 'Database · replica-2 rejoined pool', severity: 'healthy', category: 'Infra' },
  { id: 'a8', time: '11:59:48', title: 'User registered', meta: 'Auth · plan: Pro · Germany', severity: 'intel', category: 'User' },
  { id: 'a9', time: '11:59:02', title: 'Feature flag enabled', meta: 'Product · new-onboarding · 25% rollout', severity: 'intel', category: 'Deploy' },
  { id: 'a10', time: '11:58:20', title: 'AI insight generated', meta: 'Product Analyst · registration abandonment', severity: 'ai', category: 'AI' },
]

export const activityCategories = ['All', 'Security', 'AI', 'Feature', 'Deploy', 'Infra', 'User']

/* ---------- AI Insights ---------- */
export type Insight = {
  id: string
  title: string
  summary: string
  confidence: number
  impact: string
  affected: string
  severity: Tone
  actions: string[]
}

export const insights: Insight[] = [
  {
    id: 'i1',
    title: 'Registration abandonment increased 18% today',
    summary: 'A regression in the identity verification step is causing users to drop off before completing signup. The pattern started at 09:12 UTC.',
    confidence: 94,
    impact: 'High — est. $12.4k MRR at risk',
    affected: '2,140 users',
    severity: 'critical',
    actions: ['Roll back deploy #1482', 'Notify onboarding team', 'Open incident'],
  },
  {
    id: 'i2',
    title: 'Document upload failures started after deployment',
    summary: 'Storage service latency crossed 1s immediately following deploy #1482. Upload success rate dropped from 98% to 62%.',
    confidence: 91,
    impact: 'High — core onboarding flow',
    affected: '1,380 users',
    severity: 'critical',
    actions: ['Increase upload timeout', 'Scale storage workers', 'Investigate'],
  },
  {
    id: 'i3',
    title: 'Users spend 4m 12s on verification screen',
    summary: 'Average dwell time on the verification screen is 3x higher than the healthy baseline, indicating confusion in the flow.',
    confidence: 87,
    impact: 'Medium — friction & drop-off',
    affected: '5,600 users',
    severity: 'warning',
    actions: ['Review copy', 'A/B test layout', 'Add inline help'],
  },
  {
    id: 'i4',
    title: 'Authentication latency increased 42%',
    summary: 'Token refresh endpoint p95 latency climbed from 210ms to 312ms over the last 3 hours, correlated with connection pool saturation.',
    confidence: 89,
    impact: 'Medium — session experience',
    affected: '18k users',
    severity: 'warning',
    actions: ['Expand pool size', 'Enable caching', 'Investigate'],
  },
  {
    id: 'i5',
    title: 'Storage service likely causing onboarding failures',
    summary: 'AI root-cause analysis links 78% of failed onboarding sessions to storage upload errors. High confidence causal chain identified.',
    confidence: 96,
    impact: 'Critical — revenue & retention',
    affected: '1,380 users',
    severity: 'ai',
    actions: ['Generate fix', 'Create Jira ticket', 'Assign engineer'],
  },
  {
    id: 'i6',
    title: 'Weekly active users trending +9% week-over-week',
    summary: 'Growth accelerating in the EU region driven by the new sharing feature. Retention cohort D7 improved to 44%.',
    confidence: 92,
    impact: 'Positive — growth signal',
    affected: '—',
    severity: 'healthy',
    actions: ['Generate report', 'Notify growth team'],
  },
  {
    id: 'i7',
    title: 'API error budget 68% consumed this cycle',
    summary: 'At current burn rate the monthly error budget will be exhausted in 6 days. Primary contributor is the /verify endpoint.',
    confidence: 88,
    impact: 'Medium — reliability SLO',
    affected: '—',
    severity: 'warning',
    actions: ['Freeze risky deploys', 'Prioritise /verify fix'],
  },
]

/* ---------- Incidents ---------- */
export type Incident = {
  id: string
  title: string
  priority: 'P1' | 'P2' | 'P3'
  severity: Tone
  status: 'Investigating' | 'Identified' | 'Monitoring' | 'Resolved'
  affected: string
  impact: string
  started: string
  service: string
  assignee: string
  confidence: number
  rootCause: string
  aiSummary: string
  suggestedFix: string
  timeline: { time: string; label: string; tone: Tone }[]
}

export const incidents: Incident[] = [
  {
    id: 'INC-1042',
    title: 'Document upload failures across onboarding',
    priority: 'P1',
    severity: 'critical',
    status: 'Investigating',
    affected: '1,380 users',
    impact: '$12.4k MRR at risk',
    started: '09:12 UTC',
    service: 'Storage',
    assignee: 'Priya Nair',
    confidence: 96,
    rootCause: 'Deploy #1482 reduced the storage upload timeout to 30s while introducing a synchronous virus-scan step that averages 34s for large PDFs, causing systematic timeouts.',
    aiSummary: 'Storage upload success dropped from 98% to 62% immediately after deploy #1482. 78% of failed onboarding sessions terminate at the upload step. Rollback is recommended.',
    suggestedFix: 'Roll back deploy #1482 or move the virus-scan step to an async background worker and raise the upload timeout to 90s.',
    timeline: [
      { time: '09:12', label: 'Deploy #1482 shipped to production', tone: 'intel' },
      { time: '09:14', label: 'Upload error rate crossed threshold', tone: 'warning' },
      { time: '09:18', label: 'AI Incident Agent opened investigation', tone: 'ai' },
      { time: '09:26', label: 'Root cause identified — timeout regression', tone: 'critical' },
      { time: '09:31', label: 'Fix drafted, awaiting approval', tone: 'healthy' },
    ],
  },
  {
    id: 'INC-1041',
    title: 'Elevated authentication latency',
    priority: 'P2',
    severity: 'warning',
    status: 'Identified',
    affected: '18k users',
    impact: 'Session degradation',
    started: '08:40 UTC',
    service: 'Authentication',
    assignee: 'Marco Silva',
    confidence: 89,
    rootCause: 'Connection pool saturation on the auth database under peak EU traffic.',
    aiSummary: 'Token refresh p95 latency rose 42%. Pool utilisation sits at 96%. Expanding the pool should restore baseline.',
    suggestedFix: 'Increase auth DB connection pool from 40 to 80 and enable short-lived token caching.',
    timeline: [
      { time: '08:40', label: 'Latency alert triggered', tone: 'warning' },
      { time: '08:44', label: 'AI correlated with pool saturation', tone: 'ai' },
      { time: '08:52', label: 'Mitigation identified', tone: 'healthy' },
    ],
  },
  {
    id: 'INC-1040',
    title: 'Suspicious login activity — credential stuffing',
    priority: 'P2',
    severity: 'critical',
    status: 'Monitoring',
    affected: '3 accounts',
    impact: 'Security exposure',
    started: '07:05 UTC',
    service: 'Security',
    assignee: 'Security Agent',
    confidence: 92,
    rootCause: 'Automated login attempts from a rotating set of IPs targeting high-value accounts.',
    aiSummary: 'Detected 4,200 failed logins in 6 minutes from 118 IPs. Rate limiting and MFA challenge applied automatically.',
    suggestedFix: 'Maintain elevated rate limits for 24h and force password reset on 3 flagged accounts.',
    timeline: [
      { time: '07:05', label: 'Anomalous login volume detected', tone: 'critical' },
      { time: '07:06', label: 'Auto rate-limit engaged', tone: 'ai' },
      { time: '07:11', label: 'Threat contained, monitoring', tone: 'healthy' },
    ],
  },
]

/* ---------- User Journey ---------- */
export type JourneyStep = {
  label: string
  status: 'ok' | 'friction' | 'fail' | 'exit'
  time: string
  clicks: number
}

export const journeySteps: JourneyStep[] = [
  { label: 'Login', status: 'ok', time: '0:08', clicks: 2 },
  { label: 'Registration', status: 'ok', time: '0:52', clicks: 9 },
  { label: 'Identity Verification', status: 'friction', time: '4:12', clicks: 21 },
  { label: 'Upload Document', status: 'fail', time: '0:34', clicks: 4 },
  { label: 'Retry Upload', status: 'fail', time: '0:41', clicks: 5 },
  { label: 'Retry Upload', status: 'fail', time: '0:38', clicks: 6 },
  { label: 'Exit', status: 'exit', time: '—', clicks: 1 },
]

export const journeyScores = [
  { label: 'Completion', value: 34, tone: 'critical' as Tone },
  { label: 'Friction', value: 78, tone: 'warning' as Tone },
  { label: 'Confusion', value: 64, tone: 'warning' as Tone },
]

/* ---------- Features ---------- */
export type Feature = {
  name: string
  usage: string
  success: number
  completion: number
  satisfaction: number
  health: number
  trend: 'up' | 'down' | 'flat'
  recommendation: string
}

export const features: Feature[] = [
  { name: 'Document Upload', usage: '42k / day', success: 62, completion: 58, satisfaction: 61, health: 62, trend: 'down', recommendation: 'Move virus-scan async and increase upload timeout.' },
  { name: 'Identity Verification', usage: '38k / day', success: 74, completion: 66, satisfaction: 70, health: 71, trend: 'down', recommendation: 'Simplify the verification copy and add inline help.' },
  { name: 'Payments', usage: '12k / day', success: 96, completion: 94, satisfaction: 91, health: 95, trend: 'flat', recommendation: 'Healthy. Monitor declined-card retry flow.' },
  { name: 'Search', usage: '210k / day', success: 99, completion: 97, satisfaction: 93, health: 98, trend: 'up', recommendation: 'Performing well. Consider semantic ranking rollout.' },
  { name: 'Sharing', usage: '64k / day', success: 97, completion: 92, satisfaction: 95, health: 96, trend: 'up', recommendation: 'Driving EU growth. Expand to mobile share sheet.' },
  { name: 'Notifications', usage: '180k / day', success: 98, completion: 96, satisfaction: 88, health: 97, trend: 'flat', recommendation: 'Reduce email frequency to lift satisfaction.' },
]

/* ---------- Errors ---------- */
export type ErrorRow = {
  message: string
  type: string
  count: number
  trend: number
  feature: string
  status: 'new' | 'trending' | 'resolved' | 'open'
}

export const errorRows: ErrorRow[] = [
  { message: 'TimeoutException: upload exceeded 30000ms', type: 'Storage', count: 4210, trend: 340, feature: 'Document Upload', status: 'trending' },
  { message: 'SocketException: connection reset by peer', type: 'Network', count: 1820, trend: 12, feature: 'API Gateway', status: 'open' },
  { message: 'StateError: token refresh failed', type: 'Auth', count: 960, trend: 42, feature: 'Authentication', status: 'trending' },
  { message: 'FormatException: unexpected null in profile', type: 'Client', count: 512, trend: -8, feature: 'Profile', status: 'open' },
  { message: 'PaymentDeclined: insufficient_funds', type: 'Billing', count: 288, trend: 4, feature: 'Payments', status: 'open' },
  { message: 'RenderFlex overflowed by 42px', type: 'UI', count: 140, trend: -60, feature: 'Onboarding', status: 'resolved' },
  { message: 'NullPointer: session.user was null', type: 'Client', count: 96, trend: 96, feature: 'Session', status: 'new' },
]

/* ---------- Performance metrics ---------- */
export type Metric = { label: string; value: string; series: number[]; tone: Tone; rec: string }
export const performanceMetrics: Metric[] = [
  { label: 'CPU Utilisation', value: '58%', series: [40, 44, 52, 48, 60, 58, 62, 58], tone: 'intel', rec: 'Within range. Autoscaling threshold at 75%.' },
  { label: 'Memory', value: '71%', series: [55, 58, 62, 64, 68, 70, 72, 71], tone: 'warning', rec: 'Trending up — investigate worker memory leak.' },
  { label: 'API Latency (p95)', value: '186ms', series: [220, 210, 205, 200, 195, 190, 188, 186], tone: 'healthy', rec: 'Improving after cache rollout.' },
  { label: 'Database Speed', value: '11ms', series: [14, 13, 12, 12, 11, 11, 12, 11], tone: 'healthy', rec: 'Excellent. Query cache hit rate 96%.' },
  { label: 'Network Throughput', value: '4.2 Gb/s', series: [3, 3.4, 3.6, 3.8, 4, 4.1, 4.2, 4.2], tone: 'intel', rec: 'Stable across all regions.' },
  { label: 'Predicted Capacity', value: '18 days', series: [30, 28, 26, 24, 22, 20, 19, 18], tone: 'warning', rec: 'AI forecasts capacity limit in 18 days — plan scale-up.' },
]

/* ---------- Security ---------- */
export const securityStats = [
  { label: 'Failed Logins (24h)', value: '4,218', tone: 'warning' as Tone },
  { label: 'Blocked Users', value: '37', tone: 'critical' as Tone },
  { label: 'Permission Changes', value: '12', tone: 'intel' as Tone },
  { label: 'API Abuse Attempts', value: '289', tone: 'warning' as Tone },
  { label: 'Threat Level', value: 'Elevated', tone: 'warning' as Tone },
  { label: 'Risk Score', value: '34 / 100', tone: 'healthy' as Tone },
]

export const securityEvents = [
  { time: '12:04', label: 'Credential stuffing blocked', detail: '118 IPs · rate-limited', tone: 'critical' as Tone },
  { time: '11:38', label: 'Admin permission granted', detail: 'user m.silva → billing:write', tone: 'intel' as Tone },
  { time: '10:52', label: 'Suspicious API key usage', detail: 'key ****9f21 · 8k req/min', tone: 'warning' as Tone },
  { time: '09:15', label: 'MFA challenge enforced', detail: '3 high-value accounts', tone: 'ai' as Tone },
]

/* ---------- Deployments ---------- */
export type Deployment = {
  id: string
  service: string
  author: string
  time: string
  status: 'success' | 'degraded' | 'rolled-back'
  errorsDelta: number
  latencyDelta: number
  healthScore: number
  rollback: boolean
}

export const deployments: Deployment[] = [
  { id: '#1483', service: 'api-gateway', author: 'a.chen', time: '12:01', status: 'success', errorsDelta: -4, latencyDelta: -12, healthScore: 97, rollback: false },
  { id: '#1482', service: 'storage-svc', author: 'p.nair', time: '09:12', status: 'degraded', errorsDelta: 540, latencyDelta: 980, healthScore: 41, rollback: true },
  { id: '#1481', service: 'web-app', author: 'j.doe', time: '08:20', status: 'success', errorsDelta: 2, latencyDelta: 4, healthScore: 96, rollback: false },
  { id: '#1480', service: 'auth-svc', author: 'm.silva', time: '07:44', status: 'degraded', errorsDelta: 88, latencyDelta: 102, healthScore: 78, rollback: false },
  { id: '#1479', service: 'ai-engine', author: 'r.kim', time: '06:30', status: 'success', errorsDelta: -1, latencyDelta: -30, healthScore: 98, rollback: false },
]

/* ---------- AI Agents ---------- */
export type Agent = {
  name: string
  role: string
  status: 'active' | 'idle' | 'paused'
  task: string
  confidence: number
  actions: string[]
  tone: Tone
}

export const agents: Agent[] = [
  { name: 'Incident Agent', role: 'Detection & triage', status: 'active', task: 'Investigating storage upload failures (INC-1042)', confidence: 96, actions: ['Correlated with deploy #1482', 'Drafted rollback plan'], tone: 'critical' },
  { name: 'Performance Agent', role: 'Latency & capacity', status: 'active', task: 'Forecasting capacity — 18 days to limit', confidence: 88, actions: ['Flagged memory leak in workers'], tone: 'warning' },
  { name: 'Security Agent', role: 'Threat monitoring', status: 'active', task: 'Monitoring credential-stuffing campaign', confidence: 92, actions: ['Rate-limited 118 IPs', 'Enforced MFA'], tone: 'critical' },
  { name: 'QA Agent', role: 'Release validation', status: 'idle', task: 'Awaiting next deploy to validate', confidence: 90, actions: ['Passed 214 checks on #1483'], tone: 'healthy' },
  { name: 'Product Analyst', role: 'Behaviour & funnels', status: 'active', task: 'Analysing registration abandonment', confidence: 94, actions: ['Generated 3 insights today'], tone: 'ai' },
  { name: 'Executive Agent', role: 'Reporting & summary', status: 'active', task: 'Compiling daily operations report', confidence: 91, actions: ['Summarised 3 incidents'], tone: 'intel' },
  { name: 'Infrastructure Agent', role: 'Scaling & resilience', status: 'active', task: 'Auto-scaled storage workers +6', confidence: 89, actions: ['Rebalanced worker pool'], tone: 'intel' },
  { name: 'Database Agent', role: 'Query & health', status: 'active', task: 'Optimising slow query on auth pool', confidence: 87, actions: ['Recommended pool expansion'], tone: 'healthy' },
]

/* ---------- Product Memory ---------- */
export type MemoryEntry = {
  title: string
  category: string
  date: string
  summary: string
  people: string[]
  metrics: string
}

export const memoryEntries: MemoryEntry[] = [
  { title: 'Onboarding redesign — verification-first flow', category: 'Decision', date: 'Mar 2035', summary: 'Reordered onboarding to verify identity before document upload after data showed 40% drop at upload step.', people: ['Priya N.', 'Product', 'Design'], metrics: 'Completion +12%, D7 retention +6%' },
  { title: 'Migrated storage to multi-region', category: 'Infrastructure', date: 'Feb 2035', summary: 'Adopted multi-region object storage to reduce upload latency for EU users.', people: ['Infra', 'a.chen'], metrics: 'p95 upload latency -38%' },
  { title: 'Introduced AI incident triage', category: 'Decision', date: 'Jan 2035', summary: 'Deployed autonomous incident agent to cut mean-time-to-detect.', people: ['SRE', 'AI Platform'], metrics: 'MTTD -64%, MTTR -41%' },
  { title: 'Sharing feature launch', category: 'Launch', date: 'Dec 2034', summary: 'Shipped collaborative sharing which became the primary EU growth driver.', people: ['Growth', 'Product'], metrics: 'WAU +9% WoW' },
]

/* ---------- Reports ---------- */
export const reports = [
  { title: 'Daily Operations Report', desc: 'System health, incidents and activity for the last 24 hours.', freq: 'Daily · 06:00', tone: 'intel' as Tone },
  { title: 'Executive Summary', desc: 'High-level health, risk and business impact for leadership.', freq: 'Daily', tone: 'ai' as Tone },
  { title: 'Weekly Product Health', desc: 'Feature health scores, adoption and satisfaction trends.', freq: 'Weekly · Mon', tone: 'healthy' as Tone },
  { title: 'Engineering Report', desc: 'Deploys, error budget, latency and reliability SLOs.', freq: 'Weekly', tone: 'intel' as Tone },
  { title: 'Customer Experience Report', desc: 'Journey completion, friction and confusion scores.', freq: 'Weekly', tone: 'warning' as Tone },
  { title: 'Security Report', desc: 'Threats, blocked activity and risk posture summary.', freq: 'Weekly', tone: 'critical' as Tone },
]

/* ---------- AI Assistant suggested prompts ---------- */
export const assistantSuggestions = [
  'What is our biggest issue today?',
  'Why are users abandoning registration?',
  'Which deployment caused today’s failures?',
  'How healthy is the platform?',
  'What should engineering prioritise?',
  'Generate an executive report.',
]

/* ---------- Notifications ---------- */
export const notifications = [
  { id: 'n1', title: 'P1 incident opened', detail: 'Document upload failures · INC-1042', time: '2m', tone: 'critical' as Tone },
  { id: 'n2', title: 'AI fix ready for review', detail: 'Rollback plan for deploy #1482', time: '5m', tone: 'ai' as Tone },
  { id: 'n3', title: 'Capacity forecast', detail: 'Storage limit in 18 days', time: '22m', tone: 'warning' as Tone },
  { id: 'n4', title: 'Deploy #1483 succeeded', detail: 'api-gateway · health 97%', time: '38m', tone: 'healthy' as Tone },
]
