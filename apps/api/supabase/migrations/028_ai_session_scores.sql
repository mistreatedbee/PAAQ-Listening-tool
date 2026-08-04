-- Session Intelligence Phase 2: AI investigation scores alongside the
-- existing narrative summary. These are explicitly AI ESTIMATES (same
-- confidence-scored convention as ai_insights), not measured facts — the
-- narrative/confidence columns already established that pattern in 025.

ALTER TABLE session_ai_summaries ADD COLUMN IF NOT EXISTS friction_score          NUMERIC(3,2) CHECK (friction_score BETWEEN 0 AND 1);
ALTER TABLE session_ai_summaries ADD COLUMN IF NOT EXISTS satisfaction_score      NUMERIC(3,2) CHECK (satisfaction_score BETWEEN 0 AND 1);
ALTER TABLE session_ai_summaries ADD COLUMN IF NOT EXISTS drop_off_probability    NUMERIC(3,2) CHECK (drop_off_probability BETWEEN 0 AND 1);
ALTER TABLE session_ai_summaries ADD COLUMN IF NOT EXISTS conversion_probability  NUMERIC(3,2) CHECK (conversion_probability BETWEEN 0 AND 1);
ALTER TABLE session_ai_summaries ADD COLUMN IF NOT EXISTS engagement_score        NUMERIC(3,2) CHECK (engagement_score BETWEEN 0 AND 1);
ALTER TABLE session_ai_summaries ADD COLUMN IF NOT EXISTS complexity_score        NUMERIC(3,2) CHECK (complexity_score BETWEEN 0 AND 1);
