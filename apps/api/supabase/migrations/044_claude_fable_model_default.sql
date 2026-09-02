-- ─── Switch default AI model to anthropic/claude-fable-5.1 ───────────────────
-- Retires stealth/ox-alpha from session_ai_summaries defaults and historical
-- rows. Idempotent: safe whether or not the table already exists.

ALTER TABLE session_ai_summaries
  ALTER COLUMN model SET DEFAULT 'anthropic/claude-fable-5.1';

UPDATE session_ai_summaries
SET model = 'anthropic/claude-fable-5.1'
WHERE model = 'stealth/ox-alpha' OR model LIKE 'claude-%';
