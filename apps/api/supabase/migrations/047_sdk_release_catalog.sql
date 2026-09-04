-- Canonical latest SDK versions + release announcement dedupe.
-- Updated by announce-sdk-release after each npm publish.

CREATE TABLE IF NOT EXISTS sdk_release_catalog (
  platform text PRIMARY KEY,
  package_name text NOT NULL,
  latest_version text NOT NULL,
  release_notes text,
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdk_release_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  version text NOT NULL,
  announced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, package_name, version)
);

CREATE INDEX IF NOT EXISTS idx_sdk_release_announcements_project
  ON sdk_release_announcements(project_id, announced_at DESC);

ALTER TABLE sdk_release_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdk_release_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sdk_release_catalog_read ON sdk_release_catalog;
CREATE POLICY sdk_release_catalog_read ON sdk_release_catalog
  FOR SELECT USING (true);

DROP POLICY IF EXISTS sdk_release_announcements_tenant ON sdk_release_announcements;
CREATE POLICY sdk_release_announcements_read ON sdk_release_announcements
  FOR SELECT USING (true);
