-- ─── Performance Metrics Table ──────────────────────────────────────────────
-- Stores runtime performance telemetry from SDKs: response times, error rates,
-- CPU, memory, FPS, and other observable metrics for monitoring and alerting.

DO $$
BEGIN
  -- Create table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_metrics') THEN
    CREATE TABLE performance_metrics (
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
  END IF;

  -- Add session_id column if it doesn't exist (for existing tables from failed migrations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_metrics' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE performance_metrics ADD COLUMN session_id UUID;
  END IF;
END $$;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_performance_metrics_project 
  ON performance_metrics(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_type 
  ON performance_metrics(project_id, metric_type, created_at DESC);

-- Session index omitted - session_id is optional and may not exist in existing tables

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

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
