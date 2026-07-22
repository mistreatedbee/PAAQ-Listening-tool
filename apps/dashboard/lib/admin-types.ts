export type TenantStatus = 'trial' | 'active' | 'suspended' | 'churned'
export type SubscriptionPlan = 'starter' | 'growth' | 'business' | 'enterprise'
export type BillingStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
export type TokenType = 'sdk_token' | 'public_key' | 'secret_key' | 'webhook_secret'
export type TokenStatus = 'active' | 'revoked' | 'expired' | 'rotating'
export type Platform = 'flutter' | 'react' | 'nextjs' | 'android' | 'ios' | 'nodejs' | 'other'
export type UserRole = 'owner' | 'admin' | 'developer' | 'product_manager' | 'viewer'

export type Tenant = {
  id: string
  company_name: string
  slug: string
  logo_url: string | null
  website: string | null
  industry: string | null
  status: TenantStatus
  subscription_plan: SubscriptionPlan
  created_at: string
  updated_at: string
}

export type TenantProject = {
  id: string
  tenant_id: string
  name: string
  platform: Platform
  environment: string
  project_id_key: string
  description: string | null
  status: string
  created_at: string
}

export type TenantUser = {
  id: string
  tenant_id: string
  email: string
  full_name: string | null
  role: UserRole
  status: string
  last_login: string | null
  created_at: string
}

export type AccessToken = {
  id: string
  tenant_id: string
  project_id: string
  token_type: TokenType
  token_name: string | null
  token: string
  token_hint: string
  status: TokenStatus
  expires_at: string | null
  rotation_expires_at: string | null
  created_at: string
}

export type Subscription = {
  id: string
  tenant_id: string
  plan: SubscriptionPlan
  billing_status: BillingStatus
  stripe_customer_id: string | null
  renewal_date: string | null
  max_projects: number
  max_events_per_month: number
  max_users: number
  max_ai_requests_per_month: number
  max_storage_gb: number
}

export type UsageStatistic = {
  id: string
  tenant_id: string
  project_id: string | null
  date: string
  events_count: number
  sessions_count: number
  errors_count: number
  ai_requests_count: number
  api_requests_count: number
  active_users_count: number
  storage_bytes: number
}

export type AuditLogEntry = {
  id: string
  admin_email: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  resource_name: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export type SdkInstallation = {
  id: string
  tenant_id: string
  project_id: string
  sdk_version: string
  platform: string
  first_seen: string
  last_seen: string
  status: string
}

export const PLAN_LIMITS: Record<SubscriptionPlan, {
  max_projects: number
  max_events_per_month: number
  max_users: number
  max_ai_requests_per_month: number
  max_storage_gb: number
  price_usd: number
}> = {
  starter:    { max_projects: 3,   max_events_per_month: 100_000,   max_users: 5,   max_ai_requests_per_month: 1_000,   max_storage_gb: 5,   price_usd: 0   },
  growth:     { max_projects: 10,  max_events_per_month: 1_000_000, max_users: 20,  max_ai_requests_per_month: 10_000,  max_storage_gb: 25,  price_usd: 99  },
  business:   { max_projects: 50,  max_events_per_month: 10_000_000, max_users: 100, max_ai_requests_per_month: 100_000, max_storage_gb: 100, price_usd: 499 },
  enterprise: { max_projects: 999, max_events_per_month: 999_000_000, max_users: 999, max_ai_requests_per_month: 999_000, max_storage_gb: 999, price_usd: -1  },
}
