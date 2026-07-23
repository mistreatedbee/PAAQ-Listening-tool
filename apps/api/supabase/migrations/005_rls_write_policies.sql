-- Migration 005: Add INSERT/UPDATE write policies + expand platform enum
-- Fixes: "new row violates row-level security policy for table tenants" on onboarding

-- ─── tenants: allow authenticated users to create their own org ───────────────
CREATE POLICY "tenant_self_insert" ON tenants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── tenant_users: allow a user to add themselves to a tenant ─────────────────
-- Also allows existing tenant admins to invite others.
CREATE POLICY "tenant_users_insert" ON tenant_users
  FOR INSERT WITH CHECK (
    -- inserting yourself
    auth_user_id = auth.uid()
    OR
    -- an existing admin is inviting someone else
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_users.tenant_id
        AND tu.auth_user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ─── tenant_projects: tenant members can create projects in their org ─────────
CREATE POLICY "tenant_projects_insert" ON tenant_projects
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- ─── access_tokens: tenant members can create tokens for their org ────────────
CREATE POLICY "access_tokens_insert" ON access_tokens
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- ─── Expand platform CHECK constraint to include full SDK ecosystem ────────────
-- Drop the old constraint and recreate it with all supported platforms.
ALTER TABLE tenant_projects
  DROP CONSTRAINT IF EXISTS tenant_projects_platform_check;

ALTER TABLE tenant_projects
  ADD CONSTRAINT tenant_projects_platform_check
  CHECK (platform IN (
    'react', 'nextjs', 'vue', 'angular', 'vanilla',
    'flutter', 'reactnative', 'ios', 'android',
    'nodejs', 'python', 'go', 'java', 'dotnet',
    'other'
  ));
