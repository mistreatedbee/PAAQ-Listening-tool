-- Auto-detected emerging risks (synced from telemetry) vs manually declared incidents.

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS risk_key TEXT;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS impact_summary TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_source_check'
  ) THEN
    ALTER TABLE incidents
      ADD CONSTRAINT incidents_source_check CHECK (source IN ('manual', 'auto'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_project_risk_key
  ON incidents(project_id, risk_key)
  WHERE risk_key IS NOT NULL;
