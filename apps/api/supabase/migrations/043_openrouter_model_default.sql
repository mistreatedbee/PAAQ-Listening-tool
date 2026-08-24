-- ─── OpenRouter migration follow-up ─────────────────────────────────────────
-- session_ai_summaries.model defaulted to a Claude model ID from before the
-- OpenRouter migration. Point the default at the new model and normalize any
-- historical rows so the column no longer advertises a retired provider.
-- Idempotent: safe on databases where 025 has or hasn't run.

ALTER TABLE session_ai_summaries
  ALTER COLUMN model SET DEFAULT 'stealth/ox-alpha';

UPDATE session_ai_summaries
SET model = 'stealth/ox-alpha'
WHERE model LIKE 'claude-%';
