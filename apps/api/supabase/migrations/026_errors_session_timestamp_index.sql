-- Session Intelligence Phase 1: indexes for cross-referencing the error timeline
-- against the interaction timeline by session, ordered by real timestamps.

CREATE INDEX IF NOT EXISTS idx_errors_session_created ON errors(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_session_timestamp ON events(session_id, timestamp);
