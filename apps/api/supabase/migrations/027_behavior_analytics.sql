-- Session Intelligence Phase 2 (web): rage/dead-click counts, scroll depth,
-- and per-field form friction — all populated only from real captured
-- $rage_click/$dead_click/$scroll_depth/$form_field events, never synthesized.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rage_click_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS dead_click_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS form_abandon_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE session_pages ADD COLUMN IF NOT EXISTS scroll_depth_pct INTEGER; -- max scroll % reached, 0-100

CREATE TABLE IF NOT EXISTS form_field_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  page_path         TEXT NOT NULL,
  form_name         TEXT,
  field_name        TEXT NOT NULL,
  time_spent_ms     INTEGER,
  backspace_count   INTEGER NOT NULL DEFAULT 0,
  had_error         BOOLEAN NOT NULL DEFAULT false,
  completed         BOOLEAN NOT NULL DEFAULT false, -- field had a non-empty value when the form was left
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_field_stats_session ON form_field_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_form_field_stats_project ON form_field_stats(project_id);
CREATE INDEX IF NOT EXISTS idx_form_field_stats_field ON form_field_stats(project_id, form_name, field_name);

ALTER TABLE form_field_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS form_field_stats_tenant_isolation ON form_field_stats;
CREATE POLICY form_field_stats_tenant_isolation ON form_field_stats
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );
