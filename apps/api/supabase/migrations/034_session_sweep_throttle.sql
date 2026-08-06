-- Session-sweep-cron relies solely on Deno.cron, which (per db-heartbeat-cron's
-- own comments) isn't guaranteed to actually fire on every deployment target.
-- This column backs an inline, per-project fallback invoked from real traffic
-- (events/index.ts), mirroring how database_connectors.last_test_at throttles
-- checkAndRecordDbHeartbeat — so a burst of events can't hammer the sessions
-- table with sweep queries.
ALTER TABLE tenant_projects ADD COLUMN IF NOT EXISTS sessions_last_swept_at TIMESTAMPTZ;
