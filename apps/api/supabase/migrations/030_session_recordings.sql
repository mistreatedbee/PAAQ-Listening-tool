-- Visual session replay: web gets real DOM-reconstruction recording (rrweb —
-- structural events, not pixels), mobile gets periodic real screenshots (no
-- DOM to reconstruct there). Actual recording data lives in Storage; these
-- tables are just metadata + ordering. All access to the bucket goes through
-- edge functions (service role) — the client never talks to Storage
-- directly, so no storage.objects RLS policies are needed.

INSERT INTO storage.buckets (id, name, public)
VALUES ('session-recordings', 'session-recordings', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS session_recordings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('dom', 'screenshots')),
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS session_recording_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id  UUID NOT NULL REFERENCES session_recordings(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  sequence      INTEGER NOT NULL,
  storage_path  TEXT NOT NULL,
  captured_at   TIMESTAMPTZ NOT NULL,
  byte_size     INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recording_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_session_recordings_session ON session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_session_recording_chunks_recording ON session_recording_chunks(recording_id, sequence);

ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recording_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_recordings_tenant_isolation ON session_recordings;
CREATE POLICY session_recordings_tenant_isolation ON session_recordings
  FOR ALL USING (user_can_access_project(project_id));

DROP POLICY IF EXISTS session_recording_chunks_tenant_isolation ON session_recording_chunks;
CREATE POLICY session_recording_chunks_tenant_isolation ON session_recording_chunks
  FOR ALL USING (user_can_access_project(project_id));
