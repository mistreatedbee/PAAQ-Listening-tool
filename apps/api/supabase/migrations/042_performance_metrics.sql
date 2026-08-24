-- ─── Performance Metrics Table ──────────────────────────────────────────────
-- Stores runtime performance telemetry from SDKs: response times, error rates,
-- CPU, memory, FPS, and other observable metrics for monitoring and alerting.
--
-- Fully idempotent: safe to run whether or not the table already exists, and
-- heals older table versions by adding any missing columns.

CREATE TABLE IF NOT EXISTS performance_metrics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  session_id   UUID,
  metric_type  TEXT NOT NULL,
  value        DOUBLE PRECISION NOT NULL,
  unit         TEXT,
  source       TEXT,
  endpoint     TEXT,
  user_agent   TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Heal older/pre-existing versions of the table that are missing columns.
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS metric_type TEXT;
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS value DOUBLE PRECISION;
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_performance_metrics_project
  ON performance_metrics(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_type
  ON performance_metrics(project_id, metric_type, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS performance_metrics_tenant_isolation ON performance_metrics;

CREATE POLICY performance_metrics_tenant_isolation
  ON performance_metrics
  FOR ALL
  USING (user_can_access_project(project_id));

-- ─── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE performance_metrics IS
  'Runtime performance telemetry from PAAQ SDKs for monitoring and alerting';
COMMENT ON COLUMN performance_metrics.metric_type IS
  'Type of metric: response_time, error_rate, cpu, memory, fps, throughput, etc.';
COMMENT ON COLUMN performance_metrics.value IS
  'Numeric value of the metric (interpret based on unit and metric_type)';
COMMENT ON COLUMN performance_metrics.source IS
  'Layer that emitted the metric: frontend, backend, database, infrastructure';
