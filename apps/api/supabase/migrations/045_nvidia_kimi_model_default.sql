-- Switch default AI model to moonshotai/kimi-k3 (NVIDIA Integrate API).

ALTER TABLE session_ai_summaries
  ALTER COLUMN model SET DEFAULT 'moonshotai/kimi-k3';

UPDATE session_ai_summaries
SET model = 'moonshotai/kimi-k3'
WHERE model IN ('anthropic/claude-fable-5.1', 'stealth/ox-alpha') OR model LIKE 'claude-%' OR model LIKE 'google/%' OR model LIKE 'meta-llama/%';
