-- Migration 004: Add workspaces as intermediate layer between organizations and projects
-- Hierarchy: Organization (tenant) → Workspace → Project → Environment

CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id);

-- Link projects to workspaces
ALTER TABLE tenant_projects
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON tenant_projects(workspace_id);

-- RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = workspaces.tenant_id
        AND tenant_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "workspaces_insert_service" ON workspaces
  FOR INSERT WITH CHECK (true);
