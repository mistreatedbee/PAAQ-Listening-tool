-- tenant_projects updates fire sync_tenant_project_to_projects(), which upserts
-- into legacy projects. That table has RLS with SELECT-only policies, so
-- owner/admin updates (archive, rename, approval_mode) failed with:
-- "new row violates row-level security policy for table projects".
-- Run the sync as the function owner (bypasses RLS) — same pattern as user_can_access_project().

CREATE OR REPLACE FUNCTION sync_tenant_project_to_projects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
