-- Owner/admin can update project settings (approval_mode, archive, etc.)
DROP POLICY IF EXISTS "tenant_projects_update" ON tenant_projects;
CREATE POLICY "tenant_projects_update" ON tenant_projects
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status NOT IN ('removed', 'suspended')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status NOT IN ('removed', 'suspended')
    )
  );

-- Owner/admin can revoke access tokens when removing an application
DROP POLICY IF EXISTS "access_tokens_update" ON access_tokens;
CREATE POLICY "access_tokens_update" ON access_tokens
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status NOT IN ('removed', 'suspended')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status NOT IN ('removed', 'suspended')
    )
  );
