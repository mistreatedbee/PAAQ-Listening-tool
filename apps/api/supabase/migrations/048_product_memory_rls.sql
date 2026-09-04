-- product_memory had RLS enabled but zero policies — dashboard SELECT returned nothing.

ALTER TABLE product_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_memory_tenant_isolation ON product_memory;
CREATE POLICY product_memory_tenant_isolation ON product_memory
  FOR ALL USING (
    project_id IS NULL
    OR user_can_access_project(project_id)
  );

CREATE INDEX IF NOT EXISTS idx_product_memory_project_created
  ON product_memory(project_id, created_at DESC);
