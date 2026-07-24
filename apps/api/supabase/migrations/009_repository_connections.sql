-- Migration 009: Repository connections
-- Stores OAuth-connected repository providers per project

CREATE TABLE IF NOT EXISTS project_repositories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  provider      TEXT        NOT NULL CHECK (provider IN ('github', 'gitlab', 'azure', 'bitbucket')),
  provider_user TEXT,
  repo_name     TEXT,
  repo_url      TEXT,
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT        NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS project_repositories_project_idx ON project_repositories(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS project_repositories_project_provider_idx ON project_repositories(project_id, provider);

ALTER TABLE project_repositories ENABLE ROW LEVEL SECURITY;

-- Only allow access to repos belonging to accessible projects
CREATE POLICY project_repositories_isolation ON project_repositories
  FOR ALL USING (user_can_access_project(project_id));
