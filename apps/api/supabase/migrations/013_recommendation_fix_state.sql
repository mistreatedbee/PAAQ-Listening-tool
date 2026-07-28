-- Migration 013: Recommendation fix state
-- Tracks the real generated changeset, branch, and PR lifecycle for
-- "Execute fix" recommendations.

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS fix_changeset JSONB,
  ADD COLUMN IF NOT EXISTS fix_branch    TEXT,
  ADD COLUMN IF NOT EXISTS fix_pr_url    TEXT,
  ADD COLUMN IF NOT EXISTS fix_pr_number INT,
  ADD COLUMN IF NOT EXISTS fix_pr_state  TEXT CHECK (fix_pr_state IN ('none','open','merged','closed','failed')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS fix_merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fix_error     TEXT;
