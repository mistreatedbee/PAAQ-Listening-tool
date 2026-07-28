-- Migration 011: Database connectors
-- Stores an encrypted, read-only database connection string per project.
-- No RLS policies are granted to authenticated/anon on purpose — this table
-- is only ever read/written by the service-role key inside the db-connector
-- edge function. The dashboard learns connector state exclusively through
-- that function's response, never via a direct client-side select().

CREATE TABLE IF NOT EXISTS database_connectors (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID        NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  engine              TEXT        NOT NULL CHECK (engine IN ('postgres','mysql','mongodb','sqlite','redis','supabase')),
  display_host        TEXT,
  display_database    TEXT,
  display_username    TEXT,
  ciphertext          TEXT        NOT NULL,
  iv                  TEXT        NOT NULL,
  key_version         INT         NOT NULL DEFAULT 1,
  status              TEXT        NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error','disabled')),
  last_test_at        TIMESTAMPTZ,
  last_test_ok        BOOLEAN,
  last_error          TEXT,
  introspected_tables JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS database_connectors_project_uidx ON database_connectors(project_id);

ALTER TABLE database_connectors ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies for authenticated/anon.
