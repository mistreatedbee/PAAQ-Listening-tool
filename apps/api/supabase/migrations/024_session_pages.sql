-- Session Intelligence Phase 1: page-by-page / screen-by-screen breakdown.
-- One row per real page/screen visit, maintained incrementally by the events
-- edge function as $page_view/$screen events arrive — not re-derived on every
-- dashboard page load.

CREATE TABLE IF NOT EXISTS session_pages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  session_id         UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence           INTEGER NOT NULL,          -- 1-based order within the session
  page_path          TEXT NOT NULL,             -- web: pathname; mobile: screen name
  page_title         TEXT,                      -- web: document.title if available
  entered_at         TIMESTAMPTZ NOT NULL,
  exited_at          TIMESTAMPTZ,               -- set when the next page-visit event arrives, or at session end
  duration_ms        INTEGER,                   -- exited_at - entered_at, computed server-side on close
  interaction_count  INTEGER NOT NULL DEFAULT 0,
  error_count        INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_pages_session ON session_pages(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_session_pages_project ON session_pages(project_id);

ALTER TABLE session_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_pages_tenant_isolation ON session_pages;
CREATE POLICY session_pages_tenant_isolation ON session_pages
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );
