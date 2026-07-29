-- Store raw build/deploy log output captured from CI pipelines
-- Used by AI to diagnose failed deployments without manual log inspection
ALTER TABLE deployment_registry
  ADD COLUMN IF NOT EXISTS build_log TEXT,
  ADD COLUMN IF NOT EXISTS ai_diagnosis TEXT;
