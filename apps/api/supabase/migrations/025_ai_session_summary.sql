-- Session Intelligence Phase 1: on-demand AI narrative summary, one row per session.
-- Kept as its own table (not user_journeys.ai_analysis) because user_journeys is
-- wholesale deleted and rebuilt by every analyze/ run and isn't 1:1 with sessions —
-- a narrative stored there would be destroyed by the next sweep.

CREATE TABLE IF NOT EXISTS session_ai_summaries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  session_id         UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  narrative          TEXT NOT NULL,
  confidence         NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  model              TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  input_event_count  INTEGER,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_ai_summaries_project ON session_ai_summaries(project_id);

ALTER TABLE session_ai_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_ai_summaries_tenant_isolation ON session_ai_summaries;
CREATE POLICY session_ai_summaries_tenant_isolation ON session_ai_summaries
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );
