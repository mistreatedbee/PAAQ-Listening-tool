-- Migration 018: Connection health diagnostics
-- Adds richer, real-check-derived diagnostics to database_connectors so the
-- heartbeat sweep can report latency and failure streaks, not just a bare
-- last_test_ok boolean. These columns are only ever written by
-- db-heartbeat-cron / db-connector as the result of a genuine testConnection
-- call — never advanced independently of a real check.

ALTER TABLE database_connectors
  ADD COLUMN IF NOT EXISTS last_latency_ms INT,
  ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0;
