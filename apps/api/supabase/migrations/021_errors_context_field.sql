-- Add context column to errors for arbitrary metadata captured at the time of the error
ALTER TABLE errors ADD COLUMN IF NOT EXISTS context JSONB;
