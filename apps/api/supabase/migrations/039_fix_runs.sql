-- Real, persisted step-by-step state for the AI fix agent — replaces the old
-- client-side fake "pulling / analyzing / writing" rotating-message spinner
-- (apps/dashboard/components/dashboard/fix-execution.tsx PHASE_MESSAGES) with
-- an actual live feed of what the agent is doing: which files it opened,
-- the real plan it produced (shown to the user for approval before any repo
-- write happens), and per-step status as it executes that approved plan one
-- step at a time — mirroring how Claude Code itself works, per explicit
-- request. The dashboard subscribes to this row via Realtime, so progress
-- shown is always the agent's real current state, never a simulated timer.
CREATE TABLE IF NOT EXISTS fix_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  -- exploring -> awaiting_plan_approval -> running -> completed
  --                                               \-> failed (from any state)
  status            TEXT NOT NULL DEFAULT 'exploring',
  summary           TEXT,
  confidence         NUMERIC,
  explored_files    JSONB NOT NULL DEFAULT '[]',   -- string[] of real repo paths read so far
  plan              JSONB NOT NULL DEFAULT '[]',   -- [{ step, description, path, status, detail }]
  log               JSONB NOT NULL DEFAULT '[]',   -- [{ ts, message }] real activity feed, append-only
  changeset         JSONB,                          -- final [{ path, newContent }] once completed
  original          JSONB,                          -- [{ path, content }] pre-fix content, for the diff view
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fix_runs_recommendation_idx ON fix_runs(recommendation_id);
CREATE INDEX IF NOT EXISTS fix_runs_project_idx ON fix_runs(project_id);

ALTER TABLE fix_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fix_runs_tenant_read ON fix_runs;
CREATE POLICY fix_runs_tenant_read ON fix_runs
  FOR SELECT USING (user_can_access_project(project_id));

-- Service role (edge functions) bypasses RLS entirely for writes, as with
-- every other AI-pipeline table in this schema — no additional write policy
-- needed for the dashboard, which never writes this table directly.

ALTER PUBLICATION supabase_realtime ADD TABLE fix_runs;
