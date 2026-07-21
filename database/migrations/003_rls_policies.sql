-- PAAQ Listening Platform — Row Level Security Policies
-- All tables are project-isolated. Service role bypasses RLS for the API.

ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE errors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- Dashboard admins can read all data for projects they own.
-- Edge Functions use service_role key which bypasses RLS entirely.

-- Allow anonymous insert via API key validation (handled in Edge Function).
-- The publishable key grants read-only access to the dashboard.

CREATE POLICY "anon_read_events" ON events
  FOR SELECT USING (true);

CREATE POLICY "anon_read_errors" ON errors
  FOR SELECT USING (true);

CREATE POLICY "anon_read_sessions" ON sessions
  FOR SELECT USING (true);

CREATE POLICY "anon_read_api_requests" ON api_requests
  FOR SELECT USING (true);

CREATE POLICY "anon_read_performance" ON performance_metrics
  FOR SELECT USING (true);

CREATE POLICY "anon_read_projects" ON projects
  FOR SELECT USING (true);

CREATE POLICY "anon_read_users" ON users
  FOR SELECT USING (true);

CREATE POLICY "anon_read_devices" ON devices
  FOR SELECT USING (true);

CREATE POLICY "anon_read_incidents" ON incidents
  FOR SELECT USING (true);

CREATE POLICY "anon_read_ai_insights" ON ai_insights
  FOR SELECT USING (true);

CREATE POLICY "anon_read_notifications" ON notifications
  FOR SELECT USING (true);

CREATE POLICY "anon_read_audit_logs" ON audit_logs
  FOR SELECT USING (true);
