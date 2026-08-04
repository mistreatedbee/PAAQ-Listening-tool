-- notifications had only a fully-open `anon_read_notifications` SELECT
-- policy (USING true) — no tenant-scoped policy at all, so authenticated
-- dashboard users had no RLS-granted DELETE (or scoped UPDATE) on this
-- table. Bulk-delete/clear-all from the dashboard would silently no-op.
-- Bring it in line with every other tenant table's isolation pattern.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
CREATE POLICY notifications_tenant_isolation ON notifications
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );
