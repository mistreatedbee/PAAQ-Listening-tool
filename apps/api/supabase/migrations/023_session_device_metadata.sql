-- Session Intelligence Phase 1: real device/browser/app metadata + outcome on sessions.
-- All columns are nullable and populated only from what the SDK actually reports at
-- sdk-init / session-end time — nothing here is backfilled or synthesized.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS platform                     TEXT;    -- 'web' | 'ios' | 'android' | 'ios-rn' | 'android-rn' | 'flutter'
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS browser_name                 TEXT;    -- web only, parsed from User-Agent
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS browser_version              TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS os_name                      TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS os_version                   TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_type                  TEXT;    -- 'desktop' | 'mobile' | 'tablet'
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_model                 TEXT;    -- e.g. 'iPhone 14 Pro', 'Pixel 7' — mobile SDKs only
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS screen_width                 INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS screen_height                INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS viewport_width               INTEGER; -- web only
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS viewport_height              INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timezone                     TEXT;    -- IANA, e.g. 'Africa/Johannesburg'
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS locale                       TEXT;    -- e.g. 'en-ZA'
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS connection_type              TEXT;    -- navigator.connection?.effectiveType — web/RN only
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS app_version                  TEXT;    -- mirrors sdk_installations.app_version onto the session
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS entry_url                    TEXT;    -- web: first page.location.href; mobile: first screen name
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS referrer                     TEXT;    -- web only, document.referrer

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS outcome                      TEXT
  CHECK (outcome IN ('completed', 'abandoned', 'timed_out', 'logged_out', 'crashed', 'force_closed'));

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_seconds               INTEGER; -- sum of event-to-event gaps <= 60s
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS idle_seconds                 INTEGER; -- duration - active_seconds, clamped >= 0
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time_to_first_interaction_ms INTEGER; -- first event.timestamp - session.started_at
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS page_count                   INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS interaction_count            INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sessions_outcome ON sessions(outcome);
