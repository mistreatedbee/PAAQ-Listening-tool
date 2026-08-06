-- Lets the Errors page's "Fix with AI Agent" reuse the exact same real
-- agentic fix pipeline (fix_runs / execute-fix) that recommendations use,
-- instead of a one-off text-only suggestion — by giving each error a real,
-- traceable recommendation row the same way investigations already do via
-- investigation_id, rather than inventing a parallel pipeline.
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS error_id UUID REFERENCES errors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS recommendations_error_idx ON recommendations(error_id) WHERE error_id IS NOT NULL;
