-- Onboarding agent: durable run/step/message log for the conversational
-- "connect a repo and get set up" flow. The agent (onboard-agent edge
-- function) runs as a background process driven by the service-role key;
-- these tables are what the dashboard polls/subscribes to so a user can
-- watch progress and resume a run after closing the tab.
--
-- step_key is intentionally NOT constrained by a DB CHECK — the set/order
-- of steps is expected to evolve as the agent grows. The current 10 steps,
-- in their expected order, are:
--   connect_repository, understand_project, generate_sdk,
--   configure_connections, verify_backend, verify_frontend,
--   verify_database, start_learning, activate_monitoring,
--   remove_setup_page

CREATE TABLE IF NOT EXISTS onboarding_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  project_id     UUID REFERENCES tenant_projects(id),
  created_by     UUID NOT NULL REFERENCES auth.users(id),
  prompt         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running', 'awaiting_input', 'succeeded', 'failed', 'cancelled')),
  current_step   TEXT,
  error          TEXT,
  repo_provider  TEXT,
  repo_full_name TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now() -- app-managed: no updated_at trigger function
                                                     -- exists anywhere else in this repo (checked
                                                     -- moddatetime/set_updated_at across migrations),
                                                     -- so the edge function is responsible for bumping
                                                     -- this on every write, same as other tables here.
);

CREATE TABLE IF NOT EXISTS onboarding_run_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID NOT NULL REFERENCES onboarding_runs(id) ON DELETE CASCADE,
  step_key    TEXT NOT NULL,
  step_order  INT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'done', 'failed', 'skipped')),
  detail      TEXT,
  payload     JSONB,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  UNIQUE (run_id, step_key)
);

CREATE TABLE IF NOT EXISTS onboarding_run_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID NOT NULL REFERENCES onboarding_runs(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_onboarding_runs_tenant       ON onboarding_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_runs_project      ON onboarding_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_run_steps_run     ON onboarding_run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_run_messages_run  ON onboarding_run_messages(run_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Edge functions write via the service-role key, which bypasses RLS as
-- usual — the policies below only govern what authenticated dashboard
-- users can see/do directly. Same tenant_users membership join as the
-- rest of the multi-tenant schema (see 001_multi_tenant.sql,
-- 005_rls_write_policies.sql).

ALTER TABLE onboarding_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_run_steps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_run_messages ENABLE ROW LEVEL SECURITY;

-- onboarding_runs: tenant members can read, create, and update runs that
-- belong to their own tenant.
DROP POLICY IF EXISTS onboarding_runs_select ON onboarding_runs;
CREATE POLICY onboarding_runs_select ON onboarding_runs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS onboarding_runs_insert ON onboarding_runs;
CREATE POLICY onboarding_runs_insert ON onboarding_runs
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS onboarding_runs_update ON onboarding_runs;
CREATE POLICY onboarding_runs_update ON onboarding_runs
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid())
  );

-- onboarding_run_steps / onboarding_run_messages: written only by the
-- service role from inside the agent — authenticated users only need to
-- read them, scoped through the parent run's tenant.
DROP POLICY IF EXISTS onboarding_run_steps_select ON onboarding_run_steps;
CREATE POLICY onboarding_run_steps_select ON onboarding_run_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM onboarding_runs r
      WHERE r.id = onboarding_run_steps.run_id
        AND r.tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS onboarding_run_messages_select ON onboarding_run_messages;
CREATE POLICY onboarding_run_messages_select ON onboarding_run_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM onboarding_runs r
      WHERE r.id = onboarding_run_messages.run_id
        AND r.tenant_id IN (SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid())
    )
  );
