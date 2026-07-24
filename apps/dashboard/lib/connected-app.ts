// Configuration types and definitions for all connected apps.
// The PAAQ Intelligence shell never changes — only this config layer does.

export type FeatureArea = {
  id: string
  label: string
  color: string     // CSS hex
  textClass: string // Tailwind text-*
  bgClass: string   // Tailwind bg-*
  softClass: string // Tailwind soft badge
}

export type FlowStep = {
  label: string
  isPaymentCritical?: boolean
  isAuthCritical?: boolean
}

export type CriticalFlow = {
  id: string
  name: string
  featureAreaId: string
  steps: FlowStep[]
}

export type WebhookProvider = {
  id: string
  name: string
  endpoint: string
  purpose: string
}

export type SchemaMapping = {
  category: 'Users' | 'Sessions' | 'Payments' | 'Events' | 'Auth' | 'Content' | 'Notifications'
  tables: string[]
}

export type CustomSignal = {
  id: string
  name: string
  description: string
  alertThreshold: string
}

export type AlertRule = {
  featureAreaId: string
  errorRateLimit: number      // percentage
  dropOffRateLimit: number    // percentage
  latencyLimitMs: number
  paymentFailureLimit: number // percentage
}

export type TeamMember = {
  email: string
  role: 'Admin' | 'Engineer' | 'Analyst' | 'Viewer'
}

export type SdkStatus = 'connected' | 'disconnected' | 'degraded'

export type ConnectedApp = {
  id: string
  tenantId: string
  name: string
  environment: 'Production' | 'Staging' | 'Development'
  apiKey: string
  accentColor: string
  featureAreas: FeatureArea[]
  criticalFlows: CriticalFlow[]
  webhookProviders: WebhookProvider[]
  schemaMappings: SchemaMapping[]
  customSignals: CustomSignal[]
  alertRules: AlertRule[]
  team: TeamMember[]
  markets: string[]
  connectedSince: string
  lastSeen: string
  sdkStatus: {
    frontend: SdkStatus
    backend: SdkStatus
    database: SdkStatus
  }
}

// ─── PAAQ — the first registered connected app ────────────────────────────

export const PAAQ_APP: ConnectedApp = {
  id: 'paaq-prod',
  tenantId: 'paaq-tenant',
  name: 'PAAQ',
  environment: 'Production',
  apiKey: 'plt_paaq_prod_k7x2m9q4v1',
  accentColor: '#51C9D3',
  featureAreas: [
    { id: 'ask',    label: 'Please',   color: '#51C9D3', textClass: 'text-ask',    bgClass: 'bg-ask',    softClass: 'bg-ask/12 text-ask border-ask/25' },
    { id: 'book',   label: 'Ask',      color: '#22C55E', textClass: 'text-book',   bgClass: 'bg-book',   softClass: 'bg-book/12 text-book border-book/25' },
    { id: 'attend', label: 'Any',      color: '#3B82F6', textClass: 'text-attend', bgClass: 'bg-attend', softClass: 'bg-attend/12 text-attend border-attend/25' },
    { id: 'learn',  label: 'Question', color: '#F59E0B', textClass: 'text-learn',  bgClass: 'bg-learn',  softClass: 'bg-learn/12 text-learn border-learn/25' },
  ],
  criticalFlows: [
    {
      id: 'ask-flow',
      name: 'Ask Flow',
      featureAreaId: 'ask',
      steps: [
        { label: 'User submits question' },
        { label: 'Expert receives notification' },
        { label: 'Expert answers' },
        { label: 'User rates the answer' },
      ],
    },
    {
      id: 'book-flow',
      name: 'Book Session',
      featureAreaId: 'book',
      steps: [
        { label: 'User finds expert' },
        { label: 'Views credibility signals' },
        { label: 'Selects duration and slot' },
        { label: 'Escrow held', isPaymentCritical: true },
        { label: 'Live session via Agora SDK' },
        { label: 'AI note-taker active' },
        { label: 'Session closes' },
        { label: 'Expert wallet credited', isPaymentCritical: true },
        { label: 'User leaves review' },
      ],
    },
    {
      id: 'attend-flow',
      name: 'Attend Event',
      featureAreaId: 'attend',
      steps: [
        { label: 'Organiser creates event' },
        { label: 'Ticket purchased via Stripe', isPaymentCritical: true },
        { label: 'Attendee joins via access code or QR', isAuthCritical: true },
        { label: 'Live Q&A moderation' },
        { label: 'Announcements' },
        { label: 'Post-event engagement' },
      ],
    },
    {
      id: 'learn-flow',
      name: 'Learn Enrolment',
      featureAreaId: 'learn',
      steps: [
        { label: 'User discovers master class' },
        { label: 'Enrols' },
        { label: 'Completes structured content' },
        { label: 'Completion tracked' },
      ],
    },
  ],
  webhookProviders: [
    { id: 'stripe',   name: 'Stripe',     endpoint: '/webhooks/stripe',   purpose: 'Payments, ticket sales, subscription renewals, payouts' },
    { id: 'agora',    name: 'Agora SDK',  endpoint: '/webhooks/agora',    purpose: 'Live session health, connection quality, session duration' },
  ],
  schemaMappings: [
    { category: 'Auth',          tables: ['auth.users', 'auth_otps', 'signup_verifications', 'user_sessions', 'device_tokens', 'auth_identity_links'] },
    { category: 'Users',         tables: ['public.users', 'profiles', 'user_follows', 'connection_requests', 'professions', 'user_interests'] },
    { category: 'Sessions',      tables: ['bookings', 'booking_durations', 'booking_schedules', 'booking_slot_proposals', 'booking_session_tracks'] },
    { category: 'Events',        tables: ['event_details', 'event_speakers', 'event_attendees', 'event_questions', 'event_moderators', 'sponsors', 'event_sponsors'] },
    { category: 'Payments',      tables: ['expert_wallets', 'wallet_transactions', 'stripe_webhook_events', 'referrals', 'referral_rewards'] },
    { category: 'Notifications', tables: ['notifications', 'user_notification_preferences'] },
    { category: 'Content',       tables: ['services', 'service_packages', 'masterclasses', 'masterclass_modules'] },
  ],
  customSignals: [
    { id: 'credibility', name: 'Credibility Signal Completion', description: 'Rate of experts with verified identity + LinkedIn + Proof of Work + Speaker Badge', alertThreshold: 'Alert if < 60%' },
    { id: 'waitlist',    name: 'Waiting List Growth',           description: 'New geo-gated signups per 24h by market (US and ZA)', alertThreshold: 'Alert if drops > 30% week-on-week' },
    { id: 'referral',    name: 'Referral Programme Health',     description: '3% of referred revenue tracked across all modules for 12 months', alertThreshold: 'Alert if conversion rate < 15%' },
    { id: 'tiers',       name: 'Platform Tier Distribution',    description: 'Distribution across Free, Plus, Pro, and Enterprise users', alertThreshold: 'Alert if Pro/Enterprise < 5% of total' },
  ],
  alertRules: [
    { featureAreaId: 'ask',    errorRateLimit: 2,  dropOffRateLimit: 25, latencyLimitMs: 800,  paymentFailureLimit: 0  },
    { featureAreaId: 'book',   errorRateLimit: 1,  dropOffRateLimit: 15, latencyLimitMs: 1200, paymentFailureLimit: 1  },
    { featureAreaId: 'attend', errorRateLimit: 2,  dropOffRateLimit: 20, latencyLimitMs: 1000, paymentFailureLimit: 1  },
    { featureAreaId: 'learn',  errorRateLimit: 3,  dropOffRateLimit: 30, latencyLimitMs: 600,  paymentFailureLimit: 0  },
  ],
  team: [
    { email: 'ashley@paaq.com',   role: 'Admin' },
    { email: 'dev@paaq.com',      role: 'Engineer' },
    { email: 'product@paaq.com',  role: 'Analyst' },
  ],
  markets: ['United States', 'South Africa'],
  connectedSince: '2024-11-01',
  lastSeen: new Date().toISOString(),
  sdkStatus: { frontend: 'connected', backend: 'connected', database: 'connected' },
}

// ─── DemoApp — fictional second connected app proving pluggability ─────────

export const DEMO_APP: ConnectedApp = {
  id: 'demoapp-prod',
  tenantId: 'demo-tenant',
  name: 'DemoApp',
  environment: 'Production',
  apiKey: 'plt_demo_prod_h3n8p2r6w5',
  accentColor: '#6366F1',
  featureAreas: [
    { id: 'onboarding', label: 'Onboarding', color: '#3B82F6', textClass: 'text-[#3B82F6]',  bgClass: 'bg-[#3B82F6]',  softClass: 'bg-blue-500/12 text-blue-400 border-blue-500/25' },
    { id: 'checkout',   label: 'Checkout',   color: '#8B5CF6', textClass: 'text-[#8B5CF6]',  bgClass: 'bg-[#8B5CF6]',  softClass: 'bg-violet-500/12 text-violet-400 border-violet-500/25' },
    { id: 'dashboard',  label: 'Dashboard',  color: '#6366F1', textClass: 'text-[#6366F1]',  bgClass: 'bg-[#6366F1]',  softClass: 'bg-indigo-500/12 text-indigo-400 border-indigo-500/25' },
    { id: 'messaging',  label: 'Messaging',  color: '#F43F5E', textClass: 'text-[#F43F5E]',  bgClass: 'bg-[#F43F5E]',  softClass: 'bg-rose-500/12 text-rose-400 border-rose-500/25' },
  ],
  criticalFlows: [
    {
      id: 'onboarding-flow',
      name: 'User Onboarding',
      featureAreaId: 'onboarding',
      steps: [
        { label: 'Email signup' },
        { label: 'Email verification', isAuthCritical: true },
        { label: 'Profile creation' },
        { label: 'Plan selection' },
        { label: 'First action completed' },
      ],
    },
    {
      id: 'checkout-flow',
      name: 'Checkout',
      featureAreaId: 'checkout',
      steps: [
        { label: 'Cart review' },
        { label: 'Payment details entered', isPaymentCritical: true },
        { label: 'Payment processed', isPaymentCritical: true },
        { label: 'Order confirmed' },
        { label: 'Confirmation email sent' },
      ],
    },
    {
      id: 'messaging-flow',
      name: 'Send Message',
      featureAreaId: 'messaging',
      steps: [
        { label: 'Compose message' },
        { label: 'Message sent' },
        { label: 'Delivered to recipient' },
        { label: 'Read receipt' },
      ],
    },
  ],
  webhookProviders: [
    { id: 'stripe',  name: 'Stripe',  endpoint: '/webhooks/stripe',  purpose: 'Payments and subscription events' },
    { id: 'twilio',  name: 'Twilio',  endpoint: '/webhooks/twilio',  purpose: 'SMS delivery and messaging status' },
    { id: 'sendgrid', name: 'SendGrid', endpoint: '/webhooks/sendgrid', purpose: 'Email delivery status and bounces' },
  ],
  schemaMappings: [
    { category: 'Users',    tables: ['users', 'user_profiles', 'user_preferences'] },
    { category: 'Auth',     tables: ['sessions', 'auth_tokens', 'password_resets'] },
    { category: 'Payments', tables: ['orders', 'payments', 'subscriptions', 'invoices'] },
    { category: 'Content',  tables: ['messages', 'threads', 'attachments'] },
    { category: 'Notifications', tables: ['notifications', 'push_tokens'] },
  ],
  customSignals: [
    { id: 'activation',  name: 'User Activation Rate',  description: 'Users who complete onboarding within 7 days',             alertThreshold: 'Alert if < 40%' },
    { id: 'churn',       name: 'Weekly Churn Rate',      description: 'Paid users who cancel in a rolling 7-day window',          alertThreshold: 'Alert if > 3%' },
    { id: 'msg-volume',  name: 'Message Volume',         description: 'Messages sent per hour across all threads',                alertThreshold: 'Alert if drops > 50% vs 7-day avg' },
  ],
  alertRules: [
    { featureAreaId: 'onboarding', errorRateLimit: 3,  dropOffRateLimit: 40, latencyLimitMs: 600,  paymentFailureLimit: 0 },
    { featureAreaId: 'checkout',   errorRateLimit: 1,  dropOffRateLimit: 10, latencyLimitMs: 1000, paymentFailureLimit: 2 },
    { featureAreaId: 'dashboard',  errorRateLimit: 5,  dropOffRateLimit: 50, latencyLimitMs: 400,  paymentFailureLimit: 0 },
    { featureAreaId: 'messaging',  errorRateLimit: 2,  dropOffRateLimit: 20, latencyLimitMs: 300,  paymentFailureLimit: 0 },
  ],
  team: [
    { email: 'cto@demoapp.io',      role: 'Admin' },
    { email: 'backend@demoapp.io',  role: 'Engineer' },
    { email: 'growth@demoapp.io',   role: 'Analyst' },
    { email: 'ceo@demoapp.io',      role: 'Viewer' },
  ],
  markets: ['United States', 'United Kingdom', 'Canada'],
  connectedSince: '2025-01-15',
  lastSeen: new Date().toISOString(),
  sdkStatus: { frontend: 'connected', backend: 'connected', database: 'disconnected' },
}

export const ALL_APPS: ConnectedApp[] = [PAAQ_APP, DEMO_APP]
