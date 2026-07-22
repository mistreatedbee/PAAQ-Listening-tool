-- =============================================================
-- PAAQ Intelligence Platform — Multi-Tenant Schema
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- ADMIN USERS  (super admins who can access the Admin Platform)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL UNIQUE,
  full_name    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TENANTS  (each represents one company / customer)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name      TEXT    NOT NULL,
  slug              TEXT    UNIQUE NOT NULL,
  logo_url          TEXT,
  website           TEXT,
  industry          TEXT,
  status            TEXT    DEFAULT 'trial'
                    CHECK (status IN ('trial','active','suspended','churned')),
  subscription_plan TEXT    DEFAULT 'starter'
                    CHECK (subscription_plan IN ('starter','growth','business','enterprise')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TENANT PROJECTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_projects (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  platform       TEXT NOT NULL
                 CHECK (platform IN ('flutter','react','nextjs','android','ios','nodejs','other')),
  environment    TEXT DEFAULT 'production'
                 CHECK (environment IN ('production','staging','development')),
  project_id_key TEXT UNIQUE NOT NULL,          -- proj_xxxxxxxx
  description    TEXT,
  status         TEXT DEFAULT 'active'
                 CHECK (status IN ('active','inactive','archived')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TENANT USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_users (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email        TEXT NOT NULL,
  full_name    TEXT,
  role         TEXT DEFAULT 'viewer'
               CHECK (role IN ('owner','admin','developer','product_manager','viewer')),
  status       TEXT DEFAULT 'invited'
               CHECK (status IN ('active','suspended','invited','removed')),
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- ─────────────────────────────────────────────────────────────
-- ACCESS TOKENS  (Stripe-style: one row per credential type)
-- token_type: sdk_token | public_key | secret_key | webhook_secret
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_tokens (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  token_type          TEXT NOT NULL
                      CHECK (token_type IN ('sdk_token','public_key','secret_key','webhook_secret')),
  token_name          TEXT,
  token               TEXT NOT NULL,            -- full value shown once at creation only
  token_hint          TEXT NOT NULL,            -- last 4 chars for display (e.g. "a3f9")
  status              TEXT DEFAULT 'active'
                      CHECK (status IN ('active','revoked','expired','rotating')),
  expires_at          TIMESTAMPTZ,
  rotation_expires_at TIMESTAMPTZ,              -- old token valid until here during rotation
  previous_token_id   UUID REFERENCES access_tokens(id),
  created_by          UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- SDK INSTALLATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sdk_installations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  sdk_version TEXT NOT NULL,
  platform    TEXT NOT NULL,
  device_id   TEXT,
  app_version TEXT,
  first_seen  TIMESTAMPTZ DEFAULT NOW(),
  last_seen   TIMESTAMPTZ DEFAULT NOW(),
  status      TEXT DEFAULT 'active'
              CHECK (status IN ('active','stale','deprecated')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan                     TEXT DEFAULT 'starter'
                           CHECK (plan IN ('starter','growth','business','enterprise')),
  billing_status           TEXT DEFAULT 'trialing'
                           CHECK (billing_status IN ('active','trialing','past_due','canceled','unpaid')),
  stripe_customer_id       TEXT,
  stripe_subscription_id   TEXT,
  renewal_date             TIMESTAMPTZ,
  max_projects             INT     DEFAULT 3,
  max_events_per_month     BIGINT  DEFAULT 100000,
  max_users                INT     DEFAULT 5,
  max_ai_requests_per_month INT    DEFAULT 1000,
  max_storage_gb           INT     DEFAULT 5,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- USAGE STATISTICS  (daily rollup per tenant)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_statistics (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id          UUID REFERENCES tenant_projects(id) ON DELETE SET NULL,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  events_count        BIGINT DEFAULT 0,
  sessions_count      BIGINT DEFAULT 0,
  errors_count        BIGINT DEFAULT 0,
  ai_requests_count   BIGINT DEFAULT 0,
  api_requests_count  BIGINT DEFAULT 0,
  active_users_count  BIGINT DEFAULT 0,
  storage_bytes       BIGINT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, project_id, date)
);

-- ─────────────────────────────────────────────────────────────
-- ADMIN AUDIT LOG
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id  UUID,
  admin_email    TEXT,
  action         TEXT NOT NULL,
  resource_type  TEXT,   -- 'tenant' | 'project' | 'token' | 'subscription' | etc.
  resource_id    UUID,
  resource_name  TEXT,
  details        JSONB,
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenant_projects_tenant     ON tenant_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant        ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_tenant       ON access_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_project      ON access_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_token        ON access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_sdk_installations_tenant   ON sdk_installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_tenant_date    ON usage_statistics(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created        ON admin_audit_log(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE admin_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdk_installations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_statistics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log     ENABLE ROW LEVEL SECURITY;

-- Super admins read everything
CREATE POLICY "admin_read_admin_users"       ON admin_users         FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));
CREATE POLICY "admin_read_tenants"           ON tenants             FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));
CREATE POLICY "admin_read_tenant_projects"   ON tenant_projects     FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));
CREATE POLICY "admin_read_tenant_users"      ON tenant_users        FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));
CREATE POLICY "admin_read_access_tokens"     ON access_tokens       FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));
CREATE POLICY "admin_read_sdk_installations" ON sdk_installations   FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));
CREATE POLICY "admin_read_subscriptions"     ON subscriptions       FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));
CREATE POLICY "admin_read_usage_stats"       ON usage_statistics    FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));
CREATE POLICY "admin_read_audit_log"         ON admin_audit_log     FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_users));

-- Tenant users see only their own tenant's data
CREATE POLICY "tenant_user_read_own_projects"  ON tenant_projects   FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "tenant_user_read_own_users"     ON tenant_users      FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "tenant_user_read_own_tokens"    ON access_tokens     FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "tenant_user_read_own_usage"     ON usage_statistics  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- BOOTSTRAP: insert your own email as the first super admin
-- Replace with your Supabase auth user ID and email
-- ─────────────────────────────────────────────────────────────
-- INSERT INTO admin_users (auth_user_id, email, full_name)
-- VALUES ('YOUR-AUTH-USER-UUID', 'your@email.com', 'Your Name');
