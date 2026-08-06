-- _shared/db-heartbeat.ts (checkAndRecordDbHeartbeat) selects and writes
-- consecutive_failures/last_latency_ms, but neither column ever existed on
-- database_connectors — confirmed live: every automatic heartbeat check has
-- been silently failing at the initial .select() (PostgREST errors on an
-- unknown column) since the code only destructures `{ data: row }` without
-- checking `error`, so a failed select was silently treated as "no
-- connector found" and the whole check returned immediately, forever. This
-- is the real reason the Database SDK layer's last_seen never advanced
-- despite constant real event traffic (confirmed: a direct db-connector
-- retest call succeeds instantly with a real, live connection).
ALTER TABLE database_connectors ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE database_connectors ADD COLUMN IF NOT EXISTS last_latency_ms INTEGER;
