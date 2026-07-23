-- Migration 006: Fix missing SELECT policy on tenants + INSERT policy on access_tokens
-- Without these two policies the onboarding fails with RLS errors every time.

-- ─── tenants: users can read their own tenant ─────────────────────────────────
-- Required so .insert({...}).select().single() can read back the new row.
DROP POLICY IF EXISTS "tenant_self_select" ON tenants;
CREATE POLICY "tenant_self_select" ON tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- ─── access_tokens: tenant members can create tokens ─────────────────────────
-- Was completely missing — token generation silently failed on every signup.
DROP POLICY IF EXISTS "access_tokens_insert" ON access_tokens;
CREATE POLICY "access_tokens_insert" ON access_tokens
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- ─── tenant_projects: tighten blanket INSERT to tenant-scoped ────────────────
DROP POLICY IF EXISTS "tenant_projects_insert" ON tenant_projects;
CREATE POLICY "tenant_projects_insert" ON tenant_projects
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- ─── tenants INSERT: ensure policy exists with correct check ─────────────────
DROP POLICY IF EXISTS "tenants_insert" ON tenants;
DROP POLICY IF EXISTS "tenant_self_insert" ON tenants;
CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── tenant_users INSERT: ensure policy exists ───────────────────────────────
DROP POLICY IF EXISTS "tenant_users_insert" ON tenant_users;
CREATE POLICY "tenant_users_insert" ON tenant_users
  FOR INSERT WITH CHECK (
    auth_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_users.tenant_id
        AND tu.auth_user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ─── workspaces INSERT: ensure policy exists ────────────────────────────────
DROP POLICY IF EXISTS "workspaces_insert_anon" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_service" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
CREATE POLICY "workspaces_insert" ON workspaces
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- ─── platform CHECK constraint: include all supported SDKs ───────────────────
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
