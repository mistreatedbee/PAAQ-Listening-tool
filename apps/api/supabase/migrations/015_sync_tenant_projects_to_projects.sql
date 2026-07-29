-- Backfill all existing tenant_projects into the legacy projects table.
-- All 20 FK-dependent tables (events, sessions, errors, etc.) reference projects.id,
-- but the multi-tenant path creates rows only in tenant_projects, causing FK violations.
-- This migration fixes the gap for existing rows and prevents it for future ones.

-- Helper to normalise platform values.
-- tenant_projects uses free-form values (react, next, etc.); projects has a CHECK constraint
-- limited to: flutter, web, react-native, ios, android.
CREATE OR REPLACE FUNCTION normalize_platform(p TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p IN ('flutter') THEN 'flutter'
    WHEN p IN ('react-native', 'reactnative') THEN 'react-native'
    WHEN p IN ('ios', 'swift') THEN 'ios'
    WHEN p IN ('android', 'kotlin') THEN 'android'
    ELSE 'web'
  END;
$$;

-- Backfill all tenant_projects rows that are missing from projects
INSERT INTO projects (id, name, api_key, platform, created_at, updated_at)
SELECT
  tp.id,
  tp.name,
  encode(gen_random_bytes(32), 'hex'),
  normalize_platform(tp.platform),
  tp.created_at,
  COALESCE(tp.updated_at, NOW())
FROM tenant_projects tp
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = tp.id);

-- Trigger function to auto-sync future tenant_projects inserts/updates into projects
CREATE OR REPLACE FUNCTION sync_tenant_project_to_projects()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO projects (id, name, api_key, platform, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.name,
    encode(gen_random_bytes(32), 'hex'),
    normalize_platform(NEW.platform),
    NEW.created_at,
    COALESCE(NEW.updated_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    platform = EXCLUDED.platform,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_project ON tenant_projects;
CREATE TRIGGER trg_sync_tenant_project
  AFTER INSERT OR UPDATE ON tenant_projects
  FOR EACH ROW EXECUTE FUNCTION sync_tenant_project_to_projects();
