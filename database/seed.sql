-- PAAQ Listening Platform — Seed Data (development only)
-- Creates one demo project and sample records.

INSERT INTO projects (id, name, api_key, platform) VALUES
  ('00000000-0000-0000-0000-000000000001', 'PAAQ Demo App', 'demo_api_key_paaq_2025', 'flutter');

INSERT INTO users (id, project_id, external_user_id, email) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'usr_001', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'usr_002', 'bob@example.com');

INSERT INTO sessions (id, project_id, user_id, status, started_at, ended_at, duration) VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'completed', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '50 minutes', 600),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'active',    NOW() - INTERVAL '5 minutes',  NULL, NULL);

INSERT INTO events (project_id, user_id, session_id, event_name, event_category, screen_name, properties) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'screen_view',    'navigation', 'Login',            '{"referrer":"splash"}'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'button_click',   'interaction', 'Login',           '{"button":"sign_in"}'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'form_submit',    'interaction', 'Registration',    '{"plan":"pro"}'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'document_upload','feature',    'Upload',           '{"file_type":"pdf","size_kb":420}'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'screen_view',    'navigation', 'Dashboard',        '{}'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'payment_started','feature',   'Payments',         '{"amount":49,"currency":"USD"}');

INSERT INTO errors (project_id, user_id, session_id, error_type, message, severity, status) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'TimeoutException',  'Upload exceeded 30000ms', 'error', 'open'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'SocketException',   'Connection reset by peer', 'warning', 'open');

INSERT INTO incidents (project_id, title, description, severity, status, ai_summary) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Document upload failures', 'Upload success rate dropped from 98% to 62%.', 'critical', 'investigating', 'Correlated with deploy #1482. Recommend rollback.');

INSERT INTO ai_insights (project_id, category, title, description, confidence, recommendation) VALUES
  ('00000000-0000-0000-0000-000000000001', 'error', 'Upload failures spiked after deploy', 'Storage timeout too low for virus-scan step.', 0.96, 'Raise timeout to 90s or make virus-scan async.');
