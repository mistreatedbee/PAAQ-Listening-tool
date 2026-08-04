-- user_journeys predates the tenant-scoped RLS pattern (database/phase2.sql
-- explicitly disabled RLS on it). projects.id and tenant_projects.id are the
-- same id space (see 015_sync_tenant_projects_to_projects.sql), so the
-- existing user_can_access_project() helper applies unchanged.

ALTER TABLE user_journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_journeys_tenant_isolation ON user_journeys;
CREATE POLICY user_journeys_tenant_isolation ON user_journeys
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );
