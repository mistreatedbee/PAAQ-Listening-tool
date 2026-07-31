-- Migration 019: AI processing watermark
-- Tracks, per project, the newest telemetry timestamp already folded into
-- that project's last AI analysis run. Lets generate-insights-cron process
-- only genuinely new data — the watermark advances exclusively after a real,
-- successful analysis run, never on a timer independent of new data.

CREATE TABLE IF NOT EXISTS ai_processing_state (
  project_id        UUID PRIMARY KEY REFERENCES tenant_projects(id) ON DELETE CASCADE,
  last_processed_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_processing_state ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies — service-role only, same pattern as database_connectors.
