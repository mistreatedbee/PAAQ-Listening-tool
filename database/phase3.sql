-- ============================================================
-- PAAQ Phase 3 — Autonomous Intelligence & AI Operations
-- Run AFTER phase2.sql in Supabase SQL Editor
-- ============================================================

-- AI investigation reports
CREATE TABLE IF NOT EXISTS investigations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID REFERENCES projects(id) ON DELETE CASCADE,
  incident_id           UUID REFERENCES incidents(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',  -- pending | running | complete | failed
  root_cause            TEXT,
  timeline              JSONB,
  affected_services     TEXT[],
  confidence            FLOAT,
  business_impact       TEXT,
  technical_impact      TEXT,
  evidence              JSONB,
  recommendations_count INT NOT NULL DEFAULT 0,
  agents_run            TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

-- Individual agent execution records
CREATE TABLE IF NOT EXISTS agent_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  investigation_id  UUID REFERENCES investigations(id) ON DELETE CASCADE,
  agent_name        TEXT NOT NULL,  -- incident | root_cause | product | ux | qa | performance | security | executive
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | running | complete | failed
  input             JSONB,
  output            JSONB,
  error_message     TEXT,
  duration_ms       INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- AI recommendations with approval workflow
CREATE TABLE IF NOT EXISTS recommendations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID REFERENCES projects(id) ON DELETE CASCADE,
  investigation_id     UUID REFERENCES investigations(id) ON DELETE SET NULL,
  type                 TEXT NOT NULL,  -- fix | rollback | scale | notify | patch | investigate
  title                TEXT NOT NULL,
  description          TEXT,
  evidence             JSONB,
  confidence           FLOAT,
  impact_score         FLOAT,
  effort               TEXT,  -- low | medium | high
  expected_improvement TEXT,
  suggested_owner      TEXT,
  priority             TEXT NOT NULL DEFAULT 'medium',  -- critical | high | medium | low
  status               TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | assigned | archived
  approved_by          TEXT,
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historical knowledge store (product memory)
CREATE TABLE IF NOT EXISTS product_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- incident | fix | decision | report | insight | outcome
  title       TEXT NOT NULL,
  summary     TEXT,
  content     JSONB,
  tags        TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detailed engineering investigation reports
CREATE TABLE IF NOT EXISTS engineering_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
  investigation_id    UUID REFERENCES investigations(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  summary             TEXT,
  root_cause          TEXT,
  timeline            JSONB,
  files_involved      TEXT[],
  apis_involved       TEXT[],
  tables_involved     TEXT[],
  suggested_tests     TEXT[],
  implementation_plan TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Business-friendly executive summaries
CREATE TABLE IF NOT EXISTS executive_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
  period           TEXT NOT NULL DEFAULT 'daily',  -- daily | weekly | monthly
  platform_health  FLOAT,
  revenue_impact   TEXT,
  critical_issues  INT NOT NULL DEFAULT 0,
  resolved_today   INT NOT NULL DEFAULT 0,
  top_priorities   JSONB,
  summary          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deployment regression analysis
CREATE TABLE IF NOT EXISTS deployment_analysis (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  version           TEXT NOT NULL,
  deployed_at       TIMESTAMPTZ,
  health_status     TEXT NOT NULL DEFAULT 'unknown',  -- healthy | degraded | critical | rolled_back
  error_delta       FLOAT,
  latency_delta     FLOAT,
  affected_features TEXT[],
  evidence          JSONB,
  recommendation    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Disable RLS on all platform tables
-- The dashboard uses the anon key directly — no auth layer.
-- ============================================================
ALTER TABLE notifications       DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects            DISABLE ROW LEVEL SECURITY;
ALTER TABLE users               DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            DISABLE ROW LEVEL SECURITY;
ALTER TABLE events              DISABLE ROW LEVEL SECURITY;
ALTER TABLE errors              DISABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents           DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights         DISABLE ROW LEVEL SECURITY;
ALTER TABLE feature_health      DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_journeys       DISABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_events      DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_jobs    DISABLE ROW LEVEL SECURITY;
ALTER TABLE investigations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks         DISABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations     DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_memory      DISABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE executive_reports   DISABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_analysis DISABLE ROW LEVEL SECURITY;
