-- Session Intelligence Phase 3: additional device signals captured by the web
-- SDK at session start. All columns nullable — only written when the browser
-- actually exposes the API; older browsers that don't support e.g.
-- navigator.deviceMemory simply leave the column NULL.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pixel_ratio    NUMERIC(4,2); -- window.devicePixelRatio
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS orientation    TEXT;         -- 'portrait' | 'landscape'
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS touch_support  BOOLEAN;      -- 'ontouchstart' in window
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cpu_cores      INTEGER;      -- navigator.hardwareConcurrency
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS memory_gb      NUMERIC(5,2); -- navigator.deviceMemory (GB)
