-- Migration 007: Remove seed data and close the project_id IS NULL visibility loophole
-- Without this, all users see demo/seed rows that have no project assigned.

-- ─── Delete all seed / demo data ─────────────────────────────────────────────
DELETE FROM ai_insights WHERE project_id IS NULL;
DELETE FROM incidents  WHERE project_id IS NULL;
DELETE FROM errors     WHERE project_id IS NULL;
DELETE FROM sessions   WHERE project_id IS NULL;
DELETE FROM events     WHERE project_id IS NULL;

-- ─── Tighten RLS policies — remove the NULL loophole ─────────────────────────
-- Old policies allowed: project_id IS NULL OR user_can_access_project(...)
-- New policies only allow rows the user actually owns.

DROP POLICY IF EXISTS events_tenant_isolation     ON events;
DROP POLICY IF EXISTS errors_tenant_isolation     ON errors;
DROP POLICY IF EXISTS sessions_tenant_isolation   ON sessions;
DROP POLICY IF EXISTS incidents_tenant_isolation  ON incidents;
DROP POLICY IF EXISTS ai_insights_tenant_isolation ON ai_insights;

CREATE POLICY events_tenant_isolation ON events
  FOR ALL USING (user_can_access_project(project_id));

CREATE POLICY errors_tenant_isolation ON errors
  FOR ALL USING (user_can_access_project(project_id));

CREATE POLICY sessions_tenant_isolation ON sessions
  FOR ALL USING (user_can_access_project(project_id));

CREATE POLICY incidents_tenant_isolation ON incidents
  FOR ALL USING (user_can_access_project(project_id));

CREATE POLICY ai_insights_tenant_isolation ON ai_insights
  FOR ALL USING (user_can_access_project(project_id));
