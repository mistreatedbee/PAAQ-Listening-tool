-- Allow tenant users to read their own sdk_installations rows.
-- The admin-only policy already exists; this adds the missing tenant-level SELECT.
CREATE POLICY "tenant_user_read_own_installations"
  ON sdk_installations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()
    )
  );
