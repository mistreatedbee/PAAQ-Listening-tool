-- PAAQ Listening Platform — Rich Seed Data
-- Run in Supabase SQL editor. Safe to re-run (uses fixed UUIDs).
-- If tables already have the demo project, skip conflicting inserts or truncate first.

-- ============================================================
-- Project
-- ============================================================
INSERT INTO projects (id, name, api_key, platform) VALUES
  ('00000000-0000-0000-0000-000000000001', 'PAAQ Demo App', 'demo_api_key_paaq_2025', 'flutter')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Users (10 demo users)
-- ============================================================
INSERT INTO users (id, project_id, external_user_id, email) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'usr_001', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'usr_002', 'bob@example.com'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'usr_003', 'carol@example.com'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'usr_004', 'dan@example.com'),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'usr_005', 'eva@example.com'),
  ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'usr_006', 'frank@example.com'),
  ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'usr_007', 'grace@example.com'),
  ('00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'usr_008', 'hiro@example.com'),
  ('00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'usr_009', 'isabel@example.com'),
  ('00000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 'usr_010', 'james@example.com')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Sessions (8 sessions)
-- ============================================================
INSERT INTO sessions (id, project_id, user_id, status, started_at, ended_at, duration) VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'completed', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 40 minutes', 1200),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'active',    NOW() - INTERVAL '12 minutes', NULL, NULL),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'completed', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 30 minutes', 1800),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'active',    NOW() - INTERVAL '6 minutes', NULL, NULL),
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', 'abandoned', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 55 minutes', 300),
  ('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', 'completed', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '7 hours 30 minutes', 1800),
  ('00000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000016', 'active',    NOW() - INTERVAL '3 minutes', NULL, NULL),
  ('00000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000017', 'completed', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', 1800)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Events (30 events across sessions)
-- ============================================================
INSERT INTO events (project_id, user_id, session_id, event_name, event_category, screen_name, properties, timestamp) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'app_open',       'navigation', 'Splash',        '{"cold_start":true}',                NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'screen_view',    'navigation', 'Login',         '{}',                                  NOW() - INTERVAL '2 hours 59 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'login_success',  'auth',       'Login',         '{"method":"email"}',                  NOW() - INTERVAL '2 hours 58 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'screen_view',    'navigation', 'Dashboard',     '{}',                                  NOW() - INTERVAL '2 hours 57 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'button_click',   'feature',    'Dashboard',     '{"button":"upload_doc"}',             NOW() - INTERVAL '2 hours 55 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'document_upload','feature',    'Upload',        '{"file_type":"pdf","size_kb":840}',   NOW() - INTERVAL '2 hours 52 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'app_open',       'navigation', 'Splash',        '{"cold_start":false}',               NOW() - INTERVAL '12 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'screen_view',    'navigation', 'Dashboard',     '{}',                                  NOW() - INTERVAL '11 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'payment_started','feature',    'Payments',      '{"amount":49,"currency":"USD"}',      NOW() - INTERVAL '9 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'payment_success','feature',    'Payments',      '{"amount":49,"plan":"pro"}',          NOW() - INTERVAL '8 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000022', 'screen_view',    'navigation', 'Onboarding',    '{}',                                  NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000022', 'form_submit',    'feature',    'Registration',  '{"plan":"free"}',                     NOW() - INTERVAL '4 hours 58 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000022', 'screen_view',    'navigation', 'Verify',        '{}',                                  NOW() - INTERVAL '4 hours 55 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000022', 'screen_view',    'navigation', 'Dashboard',     '{}',                                  NOW() - INTERVAL '4 hours 30 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000023', 'app_open',       'navigation', 'Splash',        '{"cold_start":true}',                NOW() - INTERVAL '6 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000023', 'screen_view',    'navigation', 'Login',         '{}',                                  NOW() - INTERVAL '5 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000023', 'login_failed',   'auth',       'Login',         '{"reason":"wrong_password"}',         NOW() - INTERVAL '4 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000023', 'login_success',  'auth',       'Login',         '{"method":"email"}',                  NOW() - INTERVAL '3 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000024', 'screen_view',    'navigation', 'Upload',        '{}',                                  NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000024', 'upload_failed',  'error',      'Upload',        '{"reason":"timeout","size_kb":2048}', NOW() - INTERVAL '1 hour 59 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000025', 'screen_view',    'navigation', 'Search',        '{}',                                  NOW() - INTERVAL '8 hours'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000025', 'search',         'feature',    'Search',        '{"query":"invoice","results":14}',    NOW() - INTERVAL '7 hours 55 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000026', 'app_open',       'navigation', 'Splash',        '{"cold_start":false}',               NOW() - INTERVAL '3 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000026', 'screen_view',    'navigation', 'Dashboard',     '{}',                                  NOW() - INTERVAL '2 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000027', 'screen_view',    'navigation', 'Profile',       '{}',                                  NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000027', 'profile_update', 'feature',    'Profile',       '{"fields":["name","avatar"]}',        NOW() - INTERVAL '55 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000027', 'share',          'feature',    'Dashboard',     '{"target":"email"}',                  NOW() - INTERVAL '40 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000027', 'notification_opened', 'feature', 'Notifications', '{"type":"payment_receipt"}',        NOW() - INTERVAL '32 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000018', NULL, 'screen_view',    'navigation', 'Login',         '{}',                                  NOW() - INTERVAL '20 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000018', NULL, 'login_success',  'auth',       'Login',         '{"method":"google"}',                 NOW() - INTERVAL '19 minutes')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Errors (12 errors)
-- ============================================================
INSERT INTO errors (project_id, user_id, session_id, error_type, message, severity, status, screen, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'TimeoutException',   'Upload exceeded 30000ms',                   'error',   'open',     'Upload',        NOW() - INTERVAL '2 hours 52 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000024', 'TimeoutException',   'Upload exceeded 30000ms',                   'error',   'open',     'Upload',        NOW() - INTERVAL '1 hour 59 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'SocketException',    'Connection reset by peer',                  'warning', 'open',     'Dashboard',     NOW() - INTERVAL '10 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000022', 'StateError',         'Token refresh failed — session expired',    'warning', 'resolved', 'Login',         NOW() - INTERVAL '4 hours 50 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000023', 'FormatException',    'Unexpected null in user profile response',  'warning', 'open',     'Profile',       NOW() - INTERVAL '4 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000025', 'RenderFlex',         'Overflowed by 42px on Dashboard',           'info',    'resolved', 'Dashboard',     NOW() - INTERVAL '7 hours'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000026', 'NullPointerException','session.user was null',                   'error',   'open',     'Dashboard',     NOW() - INTERVAL '2 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000027', 'PaymentException',   'Card declined: insufficient_funds',         'warning', 'open',     'Payments',      NOW() - INTERVAL '45 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000018', NULL,                                   'NetworkException',   'Request timed out after 10000ms',           'error',   'open',     'Login',         NOW() - INTERVAL '18 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000019', NULL,                                   'FatalException',     'App crashed on startup — memory pressure',  'fatal',   'open',     NULL,            NOW() - INTERVAL '30 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'HttpException',      '503 Service Unavailable from /api/verify',  'error',   'resolved', 'Verify',        NOW() - INTERVAL '2 hours 45 minutes'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000025', 'ParseException',     'Invalid JSON in API response',              'warning', 'open',     'Search',        NOW() - INTERVAL '7 hours 50 minutes')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Incidents (5 incidents)
-- ============================================================
INSERT INTO incidents (id, project_id, title, description, severity, status, ai_summary, created_at) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Document upload failures spiking', 'Upload success rate dropped from 98% to 62% after deploy. TimeoutException appearing across multiple user sessions.', 'critical', 'investigating', 'Correlated with deploy #1482. Virus-scan step averages 34s, exceeding the 30s timeout. Recommend increasing timeout or making scan async.', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Elevated login failure rate', 'Login failures increased 18% over the last hour. Mix of wrong-password and timeout errors.', 'high', 'monitoring', 'Spike corresponds to EU traffic peak. Auth service connection pool at 92% capacity. Expanding pool should resolve.', NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'Fatal crash on app startup', 'Multiple users reporting app crash immediately after launch on Android 12. Memory pressure flagged.', 'critical', 'identified', 'Memory leak introduced in v2.1.3 causes OOM on low-memory devices. Fix is ready, pending QA sign-off.', NOW() - INTERVAL '30 minutes'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', 'Payment processing degraded', 'Card decline rate up 8%. Billing provider reporting elevated error rates on their status page.', 'medium', 'monitoring', 'Third-party billing provider degradation. No action required — monitoring for resolution. Fallback provider on standby.', NOW() - INTERVAL '45 minutes'),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', 'Search API latency spike', 'Search results taking 3-4s instead of the normal 200ms. Affecting ~15% of search queries.', 'medium', 'resolved', 'Resolved by reindexing the search cache. Root cause was a missing index on the documents table after migration 1.9.', NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;

-- ============================================================
-- AI Insights (8 insights)
-- ============================================================
INSERT INTO ai_insights (project_id, category, title, description, confidence, recommendation, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'error',       'Upload timeout causing onboarding abandonment',          'TimeoutException spike is responsible for 78% of failed onboarding sessions today. Users hitting the 30s timeout during document verification.',         0.96, 'Increase upload timeout to 90s or offload virus scan to async worker',                  NOW() - INTERVAL '1 hour 30 minutes'),
  ('00000000-0000-0000-0000-000000000001', 'error',       'Fatal crash on low-memory Android devices',              'App crashes on startup on devices with less than 2GB RAM. Affects ~4% of active Android users. Memory leak traced to image cache in v2.1.3.',         0.91, 'Release hotfix 2.1.4 clearing image cache on low-memory warning',                       NOW() - INTERVAL '25 minutes'),
  ('00000000-0000-0000-0000-000000000001', 'warning',     'Auth connection pool nearing saturation',                'Auth DB connection pool at 92% utilisation during EU peak hours. At current growth rate, exhaustion likely within 3 days.',                           0.88, 'Expand connection pool from 40 to 100 connections before next EU peak',                 NOW() - INTERVAL '50 minutes'),
  ('00000000-0000-0000-0000-000000000001', 'performance', 'Login screen average load time increased 40%',           'Time-to-interactive on the Login screen grew from 280ms to 390ms after the latest app update. Linked to new analytics initialisation on cold start.', 0.84, 'Move analytics init to a background isolate to unblock UI thread',                      NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', 'growth',      'Payment conversion rate up 12% this week',               'Users who reach the Payments screen are converting at 94%, up from 82% last week. Attributed to the simplified checkout flow shipped Monday.',          0.92, 'Expand simplified checkout to the web platform — strong signal from mobile',            NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'growth',      'Search feature driving 31% more session depth',          'Users who run at least one search view 2.4x more screens per session. Feature adoption at 67% of MAU and growing.',                                   0.89, 'Add search shortcut to bottom navigation to increase discoverability',                  NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000001', 'warning',     'Notification open rate declining',                       'Push notification open rate fell from 38% to 24% over 30 days. High-frequency users muting notifications first.',                                    0.82, 'Implement smart notification batching — max 2 per day per user',                        NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', 'security',    'Unusual login pattern from rotating IPs',                '4,200 failed logins from 118 unique IPs in 6 minutes targeting high-value accounts. Pattern consistent with credential stuffing campaign.',            0.95, 'Rate-limit login attempts by IP subnet and enforce MFA on flagged accounts',            NOW() - INTERVAL '40 minutes')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Performance metrics (40 readings across 5 metric types)
-- ============================================================
INSERT INTO performance_metrics (project_id, metric_type, value, metadata, created_at) VALUES
  -- response_time (ms)
  ('00000000-0000-0000-0000-000000000001', 'response_time', 240, '{}', NOW() - INTERVAL '8 hours'),
  ('00000000-0000-0000-0000-000000000001', 'response_time', 225, '{}', NOW() - INTERVAL '7 hours'),
  ('00000000-0000-0000-0000-000000000001', 'response_time', 210, '{}', NOW() - INTERVAL '6 hours'),
  ('00000000-0000-0000-0000-000000000001', 'response_time', 198, '{}', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', 'response_time', 186, '{}', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000001', 'response_time', 192, '{}', NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'response_time', 178, '{}', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', 'response_time', 165, '{}', NOW() - INTERVAL '1 hour'),
  -- error_rate (%)
  ('00000000-0000-0000-0000-000000000001', 'error_rate', 0.20, '{}', NOW() - INTERVAL '8 hours'),
  ('00000000-0000-0000-0000-000000000001', 'error_rate', 0.25, '{}', NOW() - INTERVAL '7 hours'),
  ('00000000-0000-0000-0000-000000000001', 'error_rate', 0.30, '{}', NOW() - INTERVAL '6 hours'),
  ('00000000-0000-0000-0000-000000000001', 'error_rate', 0.28, '{}', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', 'error_rate', 0.42, '{}', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000001', 'error_rate', 0.65, '{}', NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'error_rate', 0.58, '{}', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', 'error_rate', 0.44, '{}', NOW() - INTERVAL '1 hour'),
  -- cpu (%)
  ('00000000-0000-0000-0000-000000000001', 'cpu', 42, '{}', NOW() - INTERVAL '8 hours'),
  ('00000000-0000-0000-0000-000000000001', 'cpu', 44, '{}', NOW() - INTERVAL '7 hours'),
  ('00000000-0000-0000-0000-000000000001', 'cpu', 52, '{}', NOW() - INTERVAL '6 hours'),
  ('00000000-0000-0000-0000-000000000001', 'cpu', 48, '{}', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', 'cpu', 61, '{}', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000001', 'cpu', 58, '{}', NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'cpu', 55, '{}', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', 'cpu', 50, '{}', NOW() - INTERVAL '1 hour'),
  -- memory (%)
  ('00000000-0000-0000-0000-000000000001', 'memory', 55, '{}', NOW() - INTERVAL '8 hours'),
  ('00000000-0000-0000-0000-000000000001', 'memory', 58, '{}', NOW() - INTERVAL '7 hours'),
  ('00000000-0000-0000-0000-000000000001', 'memory', 62, '{}', NOW() - INTERVAL '6 hours'),
  ('00000000-0000-0000-0000-000000000001', 'memory', 65, '{}', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', 'memory', 69, '{}', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000001', 'memory', 72, '{}', NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'memory', 70, '{}', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', 'memory', 71, '{}', NOW() - INTERVAL '1 hour'),
  -- fps
  ('00000000-0000-0000-0000-000000000001', 'fps', 59, '{}', NOW() - INTERVAL '8 hours'),
  ('00000000-0000-0000-0000-000000000001', 'fps', 60, '{}', NOW() - INTERVAL '7 hours'),
  ('00000000-0000-0000-0000-000000000001', 'fps', 58, '{}', NOW() - INTERVAL '6 hours'),
  ('00000000-0000-0000-0000-000000000001', 'fps', 55, '{}', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000001', 'fps', 48, '{}', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000001', 'fps', 52, '{}', NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'fps', 57, '{}', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', 'fps', 60, '{}', NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- ============================================================
-- API requests (10 requests)
-- ============================================================
INSERT INTO api_requests (project_id, endpoint, method, status_code, response_time, error, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/events',      'POST', 200, 82,   false, NOW() - INTERVAL '5 minutes'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/events',      'POST', 200, 91,   false, NOW() - INTERVAL '10 minutes'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/errors',      'POST', 200, 74,   false, NOW() - INTERVAL '15 minutes'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/sessions',    'POST', 200, 68,   false, NOW() - INTERVAL '20 minutes'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/performance', 'POST', 200, 55,   false, NOW() - INTERVAL '25 minutes'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/events',      'POST', 500, 3100, true,  NOW() - INTERVAL '2 hours 52 minutes'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/events',      'POST', 200, 88,   false, NOW() - INTERVAL '30 minutes'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/errors',      'POST', 200, 77,   false, NOW() - INTERVAL '35 minutes'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/sessions',    'POST', 200, 62,   false, NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0000-000000000001', '/functions/v1/events',      'POST', 429, 12,   true,  NOW() - INTERVAL '40 minutes')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Notifications (5 notifications)
-- ============================================================
INSERT INTO notifications (project_id, type, message, severity, read, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'incident',    'P1 incident: Document upload failures spiking',      'critical', false, NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000001', 'insight',     'New AI insight: Fatal crash on low-memory devices',  'critical', false, NOW() - INTERVAL '25 minutes'),
  ('00000000-0000-0000-0000-000000000001', 'performance', 'Error rate exceeded 0.5% threshold',                 'warning',  false, NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000001', 'insight',     'Security: Credential stuffing attempt detected',     'critical', false, NOW() - INTERVAL '40 minutes'),
  ('00000000-0000-0000-0000-000000000001', 'system',      'Seed data loaded successfully',                      'info',     true,  NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;
