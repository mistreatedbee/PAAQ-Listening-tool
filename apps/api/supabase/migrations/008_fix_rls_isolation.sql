-- =============================================================
-- Migration 008: Close cross-tenant RLS escape hatch
--
-- Problem: Migration 003 allowed "project_id IS NULL" rows to be
-- visible to ALL authenticated users. Any seed or untagged row was
-- therefore readable across tenants — a security breach.
--
-- Fix: Replace all tenant-isolation policies so that NULL project_id
-- rows are ONLY accessible to admin_users (for cleanup purposes).
-- Regular tenant users can only see rows belonging to their own projects.
--
-- The user_can_access_project() function already handles the admin
-- case: when project_id IS NULL, the first EXISTS returns false but
-- the admin EXISTS check may return true. So we can simplify to a
-- single call.
-- =============================================================

-- Drop the leaky policies from migration 003
DROP POLICY IF EXISTS events_tenant_isolation     ON events;
DROP POLICY IF EXISTS errors_tenant_isolation     ON errors;
DROP POLICY IF EXISTS sessions_tenant_isolation   ON sessions;
DROP POLICY IF EXISTS incidents_tenant_isolation  ON incidents;
DROP POLICY IF EXISTS ai_insights_tenant_isolation ON ai_insights;

-- Drop any other telemetry tables that may have similar issues
DROP POLICY IF EXISTS performance_metrics_tenant_isolation ON performance_metrics;
DROP POLICY IF EXISTS knowledge_nodes_tenant_isolation     ON knowledge_nodes;
DROP POLICY IF EXISTS recommendations_tenant_isolation     ON recommendations;
DROP POLICY IF EXISTS investigations_tenant_isolation      ON investigations;

-- ─── Re-create all policies using user_can_access_project() only ──────────────
-- For NULL project_id rows: function returns false for tenants (safe), true for admins (cleanup)
-- For real project_id rows: function checks tenant membership correctly

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

-- Also lock down additional telemetry tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_metrics') THEN
    ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS performance_metrics_tenant_isolation ON performance_metrics;
    EXECUTE $p$ CREATE POLICY performance_metrics_tenant_isolation ON performance_metrics
      FOR ALL USING (user_can_access_project(project_id)) $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_nodes') THEN
    ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS knowledge_nodes_tenant_isolation ON knowledge_nodes;
    EXECUTE $p$ CREATE POLICY knowledge_nodes_tenant_isolation ON knowledge_nodes
      FOR ALL USING (user_can_access_project(project_id)) $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recommendations') THEN
    ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS recommendations_tenant_isolation ON recommendations;
    EXECUTE $p$ CREATE POLICY recommendations_tenant_isolation ON recommendations
      FOR ALL USING (user_can_access_project(project_id)) $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'investigations') THEN
    ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS investigations_tenant_isolation ON investigations;
    EXECUTE $p$ CREATE POLICY investigations_tenant_isolation ON investigations
      FOR ALL USING (user_can_access_project(project_id)) $p$;
  END IF;
END $$;

-- ─── Clean up untagged seed data ──────────────────────────────────────────────
-- After running this migration, any rows with project_id IS NULL become invisible
-- to all tenant users. Run the following in the SQL editor to either assign them
-- to a real project or delete them:
--
--   -- Option A: assign to your project
--   UPDATE events     SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--   UPDATE errors     SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--   UPDATE sessions   SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--   UPDATE incidents  SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--   UPDATE ai_insights SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
--
--   -- Option B: delete all untagged rows
--   DELETE FROM events     WHERE project_id IS NULL;
--   DELETE FROM errors     WHERE project_id IS NULL;
--   DELETE FROM sessions   WHERE project_id IS NULL;
--   DELETE FROM incidents  WHERE project_id IS NULL;
--   DELETE FROM ai_insights WHERE project_id IS NULL;
