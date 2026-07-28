-- Migration 012: Repository credentials
-- Encrypted OAuth tokens for connected git providers, one row per
-- project+provider. Mirrors database_connectors: RLS enabled, zero
-- grants to authenticated/anon — the dashboard only ever learns state
-- through the repo-connector edge function's response.

CREATE TABLE IF NOT EXISTS repository_credentials (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID        NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  provider            TEXT        NOT NULL CHECK (provider IN ('github','gitlab','azure','bitbucket')),
  access_ciphertext   TEXT        NOT NULL,
  access_iv           TEXT        NOT NULL,
  refresh_ciphertext  TEXT,
  refresh_iv          TEXT,
  token_expires_at    TIMESTAMPTZ,
  scopes              TEXT,
  key_version         INT         NOT NULL DEFAULT 1,
  status              TEXT        NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error','disabled')),
  last_verified_at    TIMESTAMPTZ,
  last_verify_ok      BOOLEAN,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS repository_credentials_project_provider_uidx
  ON repository_credentials(project_id, provider);

ALTER TABLE repository_credentials ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies for authenticated/anon.

-- The repo's real default branch (main/master/etc.) — needed so
-- execute-fix never has to guess it.
ALTER TABLE project_repositories ADD COLUMN IF NOT EXISTS default_branch TEXT;
