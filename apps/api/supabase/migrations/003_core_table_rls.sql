-- Migration 003: Add project_id + RLS to core telemetry tables
-- This enforces tenant isolation so each authenticated user only sees their own project's data.

-- ─── Add project_id to core tables ────────────────────────────────────────────
-- Using IF NOT EXISTS guards so re-running is safe.

ALTER TABLE events     ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES tenant_projects(id) ON DELETE SET NULL;
ALTER TABLE errors     ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES tenant_projects(id) ON DELETE SET NULL;
ALTER TABLE sessions   ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES tenant_projects(id) ON DELETE SET NULL;
ALTER TABLE incidents  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES tenant_projects(id) ON DELETE SET NULL;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES tenant_projects(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_project     ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_errors_project     ON errors(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project   ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_project  ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_project ON ai_insights(project_id);

-- ─── Enable RLS ────────────────────────────────────────────────────────────────
ALTER TABLE events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE errors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- ─── Helper: is the current user a member of a project's tenant? ──────────────
-- Returns true if auth.uid() belongs to the tenant that owns the given project.
CREATE OR REPLACE FUNCTION user_can_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenant_projects tp
    JOIN tenant_users tu ON tu.tenant_id = tp.tenant_id
    WHERE tp.id = p_project_id
      AND tu.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid()
  );
$$;

-- ─── RLS Policies ──────────────────────────────────────────────────────────────
-- Users see rows that belong to their project, or rows with no project_id
-- (legacy seed data — visible only while project_id is NULL, set it to lock down).

-- events
DROP POLICY IF EXISTS events_tenant_isolation ON events;
CREATE POLICY events_tenant_isolation ON events
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );

-- errors
DROP POLICY IF EXISTS errors_tenant_isolation ON errors;
CREATE POLICY errors_tenant_isolation ON errors
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );

-- sessions
DROP POLICY IF EXISTS sessions_tenant_isolation ON sessions;
CREATE POLICY sessions_tenant_isolation ON sessions
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );

-- incidents
DROP POLICY IF EXISTS incidents_tenant_isolation ON incidents;
CREATE POLICY incidents_tenant_isolation ON incidents
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );

-- ai_insights
DROP POLICY IF EXISTS ai_insights_tenant_isolation ON ai_insights;
CREATE POLICY ai_insights_tenant_isolation ON ai_insights
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );

-- ─── Lock down seed data ───────────────────────────────────────────────────────
-- To make existing seed data invisible to other accounts:
-- Run this in SQL Editor after migration, replacing with your real project UUID:
--
--   UPDATE events    SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--   UPDATE errors    SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--   UPDATE sessions  SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--   UPDATE incidents SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--   UPDATE ai_insights SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--
-- Or to simply delete all test data:
--   DELETE FROM events    WHERE project_id IS NULL;
--   DELETE FROM errors    WHERE project_id IS NULL;
--   DELETE FROM sessions  WHERE project_id IS NULL;
--   DELETE FROM incidents WHERE project_id IS NULL;
--   DELETE FROM ai_insights WHERE project_id IS NULL;
