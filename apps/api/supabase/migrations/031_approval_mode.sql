-- Per-project approval policy for AI-generated fixes. Replaces the
-- client-only localStorage 'paaq-approval-mode' toggle (never enforced
-- anywhere server-side) with a real setting read by execute-fix — the
-- actual trust boundary — and by autonomous-merge-cron.

ALTER TABLE tenant_projects
  ADD COLUMN IF NOT EXISTS approval_mode TEXT
    CHECK (approval_mode IN ('advisory','assisted','team','autonomous'))
    DEFAULT 'team';
