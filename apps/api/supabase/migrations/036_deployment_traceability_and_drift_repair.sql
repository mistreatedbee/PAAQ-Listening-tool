-- Schema drift repair + full deployment traceability.
--
-- deployment_registry (ai_fix, recommendation_id, pr_url, pr_number,
-- ai_summary, ai_confidence, changed_files) and the entire `recommendations`
-- and `investigations` tables exist live but were never captured in a
-- tracked migration — someone created them directly against the database.
-- supabase_migrations.schema_migrations also claims 017_deployment_build_log
-- ran (adding build_log/ai_diagnosis), but those columns do not actually
-- exist live — confirmed directly: querying them 400s with
-- "42703: column deployment_registry.build_log does not exist". That 400,
-- with no error handling on the dashboard's query, is the direct reason
-- Deployment Intelligence has rendered as empty regardless of real data.
--
-- Every statement below is idempotent (IF NOT EXISTS) so it's safe to run
-- regardless of what the tracking table claims already happened.

-- ── Re-assert drifted deployment_registry columns ───────────────────────────
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS ai_fix BOOLEAN DEFAULT false;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS recommendation_id UUID;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS pr_url TEXT;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS pr_number INTEGER;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS ai_confidence INTEGER;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS changed_files JSONB;

-- 017_deployment_build_log.sql's intent, re-applied since it's missing live.
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS build_log TEXT;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS ai_diagnosis TEXT;

-- ── New traceability columns ────────────────────────────────────────────────
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS commit_sha TEXT;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS validation_results JSONB;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS rollback_of_id UUID REFERENCES deployment_registry(id);
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ;
ALTER TABLE deployment_registry ADD COLUMN IF NOT EXISTS investigation_id UUID;

CREATE INDEX IF NOT EXISTS idx_deployment_registry_investigation ON deployment_registry(investigation_id);
CREATE INDEX IF NOT EXISTS idx_deployment_registry_recommendation ON deployment_registry(recommendation_id);

-- ── investigations (real live table, never migrated — recreated verbatim) ──
CREATE TABLE IF NOT EXISTS investigations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID REFERENCES tenant_projects(id),
  incident_id            UUID,
  title                  TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pending',
  root_cause             TEXT,
  timeline               JSONB,
  affected_services      TEXT[],
  confidence             DOUBLE PRECISION,
  business_impact        TEXT,
  technical_impact       TEXT,
  evidence               JSONB,
  recommendations_count  INTEGER NOT NULL DEFAULT 0,
  agents_run             TEXT[],
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at           TIMESTAMPTZ
);

ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investigations_tenant_isolation ON investigations;
CREATE POLICY investigations_tenant_isolation ON investigations
  FOR ALL USING (user_can_access_project(project_id));

-- ── recommendations (real live table, never migrated — recreated verbatim) ─
CREATE TABLE IF NOT EXISTS recommendations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID REFERENCES tenant_projects(id),
  investigation_id      UUID REFERENCES investigations(id),
  type                  TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  evidence              JSONB,
  confidence            DOUBLE PRECISION,
  impact_score          DOUBLE PRECISION,
  effort                TEXT,
  expected_improvement  TEXT,
  suggested_owner       TEXT,
  priority              TEXT NOT NULL DEFAULT 'medium',
  status                TEXT NOT NULL DEFAULT 'pending',
  approved_by           TEXT,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  fix_changeset         JSONB,
  fix_branch            TEXT,
  fix_pr_url            TEXT,
  fix_pr_number         INTEGER,
  fix_pr_state          TEXT DEFAULT 'none',
  fix_merged_at         TIMESTAMPTZ,
  fix_error             TEXT,
  affected_files        JSONB,
  root_cause            TEXT,
  business_impact       TEXT,
  estimated_fix_time    TEXT,
  risk_level            TEXT,
  patch_plan            JSONB
);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recommendations_tenant_isolation ON recommendations;
CREATE POLICY recommendations_tenant_isolation ON recommendations
  FOR ALL USING (user_can_access_project(project_id));

-- ── Webhook bookkeeping for auto-registered deployment hooks ───────────────
ALTER TABLE project_repositories ADD COLUMN IF NOT EXISTS webhook_id TEXT;
