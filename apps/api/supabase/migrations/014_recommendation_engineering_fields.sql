-- Add engineering intelligence fields to recommendations.
-- These are populated by the upgraded investigate function which correlates
-- runtime telemetry with the connected source repository.

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS affected_files  JSONB,        -- [{path, function?, reason}]
  ADD COLUMN IF NOT EXISTS root_cause      TEXT,          -- one-paragraph root cause explanation
  ADD COLUMN IF NOT EXISTS evidence        JSONB,         -- {error_count, affected_sessions, ...}
  ADD COLUMN IF NOT EXISTS business_impact TEXT,          -- human-readable business impact
  ADD COLUMN IF NOT EXISTS estimated_fix_time TEXT,       -- e.g. "2-4 hours"
  ADD COLUMN IF NOT EXISTS risk_level      TEXT CHECK (risk_level IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS patch_plan      JSONB;         -- structured steps before code gen
