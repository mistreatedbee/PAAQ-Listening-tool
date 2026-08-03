-- Add unique constraint so upsert(onConflict: 'tenant_id,project_id,device_id,platform')
-- works correctly in the events edge function proxy heartbeat.
-- Without this constraint Postgres ignores the ON CONFLICT clause and the upsert
-- silently inserts a duplicate row (or fails) instead of updating last_seen.

ALTER TABLE sdk_installations
  ADD CONSTRAINT sdk_installations_tenant_project_device_platform_key
  UNIQUE (tenant_id, project_id, device_id, platform);
