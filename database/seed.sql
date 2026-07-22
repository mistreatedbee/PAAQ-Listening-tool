-- PAAQ Listening Platform — Seed Data
-- Run in Supabase SQL Editor to populate the dashboard with realistic test data.
-- Safe to re-run: deletes existing data first.

-- ============================================================
-- Clean slate (Phase 3 → Phase 2 → Phase 1 order respects FK constraints)
-- ============================================================
DELETE FROM engineering_reports;
DELETE FROM agent_tasks;
DELETE FROM recommendations;
DELETE FROM product_memory;
DELETE FROM executive_reports;
DELETE FROM deployment_analysis;
DELETE FROM investigations;
DELETE FROM ai_analysis_jobs;
DELETE FROM anomaly_events;
DELETE FROM user_journeys;
DELETE FROM feature_health;
DELETE FROM ai_insights;
DELETE FROM notifications;
DELETE FROM performance_metrics;
DELETE FROM incidents;
DELETE FROM errors;
DELETE FROM events;
DELETE FROM sessions;
DELETE FROM users;
DELETE FROM projects;

-- ============================================================
-- Projects
-- ============================================================
INSERT INTO projects (id, name, api_key, platform) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'My Flutter App',   'pk_live_demo_flutter_001', 'flutter'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'React Native App', 'pk_live_demo_rn_002',      'react-native');

-- ============================================================
-- Users
-- ============================================================
INSERT INTO users (id, project_id, external_user_id, email, created_at) VALUES
  ('bb000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_alice', 'alice@example.com', NOW() - INTERVAL '10 days'),
  ('bb000001-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_bob',   'bob@example.com',   NOW() - INTERVAL '7 days'),
  ('bb000001-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_carol', 'carol@example.com', NOW() - INTERVAL '5 days'),
  ('bb000001-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_dave',  'dave@example.com',  NOW() - INTERVAL '3 days'),
  ('bb000001-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_eve',   'eve@example.com',   NOW() - INTERVAL '1 day'),
  ('bb000001-0000-0000-0000-000000000006', 'a1b2c3d4-0000-0000-0000-000000000002', 'usr_frank', 'frank@example.com', NOW() - INTERVAL '2 days'),
  ('bb000001-0000-0000-0000-000000000007', 'a1b2c3d4-0000-0000-0000-000000000002', 'usr_grace', 'grace@example.com', NOW() - INTERVAL '4 hours');

-- ============================================================
-- Sessions
-- ============================================================
INSERT INTO sessions (id, project_id, user_id, status, duration, started_at) VALUES
  ('cc000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'completed', 342,  NOW() - INTERVAL '2 hours'),
  ('cc000001-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000002', 'completed', 198,  NOW() - INTERVAL '3 hours'),
  ('cc000001-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000003', 'abandoned', 45,   NOW() - INTERVAL '90 minutes'),
  ('cc000001-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000004', 'completed', 511,  NOW() - INTERVAL '1 hour'),
  ('cc000001-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000005', 'active',    NULL, NOW() - INTERVAL '10 minutes'),
  ('cc000001-0000-0000-0000-000000000006', 'a1b2c3d4-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'abandoned', 22,   NOW() - INTERVAL '30 minutes'),
  ('cc000001-0000-0000-0000-000000000007', 'a1b2c3d4-0000-0000-0000-000000000002', 'bb000001-0000-0000-0000-000000000006', 'completed', 280,  NOW() - INTERVAL '45 minutes'),
  ('cc000001-0000-0000-0000-000000000008', 'a1b2c3d4-0000-0000-0000-000000000002', 'bb000001-0000-0000-0000-000000000007', 'active',    NULL, NOW() - INTERVAL '5 minutes');

-- ============================================================
-- Events
-- ============================================================
INSERT INTO events (project_id, session_id, event_name, event_category, screen_name, timestamp, properties) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'app_launch',        'navigation', 'Splash',    NOW() - INTERVAL '2 hours',                              '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'screen_view',       'navigation', 'Login',     NOW() - INTERVAL '2 hours' + INTERVAL '5 seconds',       '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'login_submit',      'auth',       'Login',     NOW() - INTERVAL '2 hours' + INTERVAL '30 seconds',      '{"method":"email"}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'login_success',     'auth',       'Login',     NOW() - INTERVAL '2 hours' + INTERVAL '32 seconds',      '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'screen_view',       'navigation', 'Dashboard', NOW() - INTERVAL '2 hours' + INTERVAL '35 seconds',      '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'button_click',      'feature',    'Dashboard', NOW() - INTERVAL '2 hours' + INTERVAL '1 minute',        '{"button":"create_order"}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'screen_view',       'navigation', 'Checkout',  NOW() - INTERVAL '2 hours' + INTERVAL '2 minutes',       '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'checkout_complete', 'feature',    'Checkout',  NOW() - INTERVAL '2 hours' + INTERVAL '5 minutes',       '{"value":49.99}'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002', 'app_launch',        'navigation', 'Splash',    NOW() - INTERVAL '3 hours',                              '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002', 'screen_view',       'navigation', 'Login',     NOW() - INTERVAL '3 hours' + INTERVAL '4 seconds',       '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002', 'login_submit',      'auth',       'Login',     NOW() - INTERVAL '3 hours' + INTERVAL '25 seconds',      '{"method":"google"}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002', 'login_success',     'auth',       'Login',     NOW() - INTERVAL '3 hours' + INTERVAL '27 seconds',      '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002', 'screen_view',       'navigation', 'Dashboard', NOW() - INTERVAL '3 hours' + INTERVAL '30 seconds',      '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002', 'screen_view',       'navigation', 'Profile',   NOW() - INTERVAL '3 hours' + INTERVAL '2 minutes',       '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002', 'profile_updated',   'feature',    'Profile',   NOW() - INTERVAL '3 hours' + INTERVAL '3 minutes',       '{}'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000003', 'app_launch',        'navigation', 'Splash',    NOW() - INTERVAL '90 minutes',                           '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000003', 'screen_view',       'navigation', 'Login',     NOW() - INTERVAL '90 minutes' + INTERVAL '3 seconds',    '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000003', 'login_submit',      'auth',       'Login',     NOW() - INTERVAL '90 minutes' + INTERVAL '20 seconds',   '{"method":"email"}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000003', 'screen_view',       'navigation', 'Checkout',  NOW() - INTERVAL '90 minutes' + INTERVAL '40 seconds',   '{}'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000004', 'app_launch',        'navigation', 'Splash',    NOW() - INTERVAL '1 hour',                               '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000004', 'screen_view',       'navigation', 'Dashboard', NOW() - INTERVAL '1 hour' + INTERVAL '5 seconds',        '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000004', 'screen_view',       'navigation', 'Checkout',  NOW() - INTERVAL '1 hour' + INTERVAL '2 minutes',        '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000004', 'payment_start',     'feature',    'Checkout',  NOW() - INTERVAL '1 hour' + INTERVAL '3 minutes',        '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000004', 'checkout_complete', 'feature',    'Checkout',  NOW() - INTERVAL '1 hour' + INTERVAL '8 minutes',        '{"value":120.00}'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000005', 'app_launch',        'navigation', 'Splash',    NOW() - INTERVAL '10 minutes',                           '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000005', 'screen_view',       'navigation', 'Dashboard', NOW() - INTERVAL '10 minutes' + INTERVAL '2 seconds',    '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000005', 'button_click',      'feature',    'Dashboard', NOW() - INTERVAL '10 minutes' + INTERVAL '30 seconds',   '{"button":"notifications"}'),

  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007', 'app_launch',        'navigation', 'Splash',    NOW() - INTERVAL '45 minutes',                           '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007', 'screen_view',       'navigation', 'Home',      NOW() - INTERVAL '45 minutes' + INTERVAL '3 seconds',    '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007', 'screen_view',       'navigation', 'Search',    NOW() - INTERVAL '45 minutes' + INTERVAL '1 minute',     '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007', 'search_submit',     'feature',    'Search',    NOW() - INTERVAL '45 minutes' + INTERVAL '2 minutes',    '{"query":"shoes"}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007', 'item_viewed',       'feature',    'Product',   NOW() - INTERVAL '45 minutes' + INTERVAL '3 minutes',    '{"item_id":"prod_123"}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007', 'add_to_cart',       'feature',    'Product',   NOW() - INTERVAL '45 minutes' + INTERVAL '4 minutes',    '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007', 'checkout_complete', 'feature',    'Checkout',  NOW() - INTERVAL '45 minutes' + INTERVAL '7 minutes',    '{"value":85.00}');

-- ============================================================
-- Errors
-- ============================================================
INSERT INTO errors (project_id, session_id, error_type, message, severity, status, screen, stack_trace, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000003', 'NetworkError',     'Connection timed out after 30s',                         'error',   'open',     'Checkout',  'NetworkError\n  at _fetchPayment (checkout.dart:142)',          NOW() - INTERVAL '85 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000006', 'NullPointerError', 'Null check operator used on a null value',               'fatal',   'open',     'Profile',   'Null check\n  at UserProfile._build (profile.dart:88)',         NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'APIError',         'Payment gateway returned 502 Bad Gateway',               'error',   'resolved', 'Checkout',  'APIError\n  at PaymentService.charge (payment.dart:67)',         NOW() - INTERVAL '1 hour'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002', 'StateError',       'setState called after dispose',                          'warning', 'open',     'Dashboard', 'StateError\n  at _DashboardState.dispose (dashboard.dart:201)', NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000004', 'FormatException',  'Invalid JSON response from /api/orders',                  'error',   'open',     'Checkout',  'FormatException\n  at OrderService.parse (orders.dart:34)',     NOW() - INTERVAL '55 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007', 'TypeError',        'Cannot read properties of undefined (reading ''name'')',  'warning', 'open',     'Product',   'TypeError\n  at ProductCard.render (ProductCard.jsx:45)',        NOW() - INTERVAL '40 minutes');

-- ============================================================
-- Performance Metrics
-- ============================================================
INSERT INTO performance_metrics (project_id, metric_type, value, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'response_time', 145, NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'response_time', 162, NOW() - INTERVAL '110 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'response_time', 189, NOW() - INTERVAL '3 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'response_time', 520, NOW() - INTERVAL '90 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'response_time', 134, NOW() - INTERVAL '1 hour'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'response_time', 178, NOW() - INTERVAL '10 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'fps',            58, NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'fps',            60, NOW() - INTERVAL '3 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'fps',            24, NOW() - INTERVAL '90 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'fps',            59, NOW() - INTERVAL '1 hour'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'memory',         52, NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'memory',         48, NOW() - INTERVAL '3 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'memory',         81, NOW() - INTERVAL '90 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'memory',         44, NOW() - INTERVAL '1 hour'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'response_time', 210, NOW() - INTERVAL '45 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'fps',            55, NOW() - INTERVAL '45 minutes');

-- ============================================================
-- Incidents
-- ============================================================
INSERT INTO incidents (project_id, title, description, ai_summary, severity, status, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001',
   'Payment gateway intermittently returning 502',
   'Users are experiencing payment failures on the Checkout screen. The error rate on /api/payment spiked to 18% in the last hour.',
   'Payment failures began 85 minutes ago, affecting approximately 12% of checkout attempts. Root cause appears to be upstream gateway instability. Revenue impact estimated at $2,400/hr.',
   'critical', 'investigating', NOW() - INTERVAL '80 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'Profile screen crash on null user data',
   'NullPointerException on Profile screen when user.preferences is null. Affects users who registered before the v2.1 migration.',
   'Fatal crash on Profile screen triggered by missing preferences field for pre-migration users. Workaround: force logout/login to refresh user object.',
   'high', 'identified', NOW() - INTERVAL '25 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'Elevated response times on Dashboard load',
   'Average response time for dashboard data fetch increased from 145ms to 520ms. Cause unknown.',
   'Dashboard load times degraded 3.6x in the last 2 hours. Correlated with a deploy at 14:30 UTC. Rolled back candidate identified.',
   'medium', 'monitoring', NOW() - INTERVAL '2 hours');

-- ============================================================
-- Notifications
-- Ensure columns exist (safe to run on existing tables)
-- ============================================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

INSERT INTO notifications (project_id, type, message, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'critical', 'ALERT: Payment gateway error rate exceeded 15% threshold',   NOW() - INTERVAL '75 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'warning',  'High memory usage detected in session cc000001-003 (81%)',   NOW() - INTERVAL '88 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'info',     'Team notified: Payment gateway intermittently returning 502', NOW() - INTERVAL '78 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'info',     'New user registered: carol@example.com',                     NOW() - INTERVAL '5 days'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'info',     'Team notified: Profile screen crash on null user data',       NOW() - INTERVAL '22 minutes');

-- ============================================================
-- AI Insights
-- ============================================================
INSERT INTO ai_insights (project_id, category, title, description, confidence, recommendation, recommended_action, impact_score, affected_users, priority, evidence, status, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001',
   'error', 'Payment gateway causing checkout abandonment',
   '18% of checkout attempts in the last hour failed due to a 502 from the payment gateway. This is a 12x increase from the baseline error rate of 1.5%. 3 out of 4 affected users did not retry.',
   0.94, 'Contact payment provider and enable the fallback gateway while the issue is investigated.',
   'Switch to backup payment provider immediately — estimated recovery time 5 minutes.',
   0.91, 3, 'critical',
   '{"error_rate_pct": "18%", "baseline_pct": "1.5%", "affected_sessions": 3, "revenue_at_risk": "$2400/hr"}',
   'active', NOW() - INTERVAL '30 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'warning', 'High session abandonment on Checkout screen',
   '42% of sessions that reached the Checkout screen did not complete. The abandonment rate is highest for sessions with response times above 400ms, suggesting a performance-conversion correlation.',
   0.81, 'Optimise checkout API response time — target under 200ms to recover estimated 15% of lost conversions.',
   'Profile /api/checkout endpoint and add caching for product metadata.',
   0.72, 4, 'high',
   '{"abandonment_rate": "42%", "avg_response_ms": 520, "correlation": "response_time > 400ms"}',
   'active', NOW() - INTERVAL '1 hour'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'performance', 'FPS dropped to 24 for one active session',
   'Session cc000001-003 recorded 24 FPS during the Checkout flow, well below the 60 FPS target. This correlates with high memory usage (81%) in the same session.',
   0.76, 'Investigate memory leak in Checkout widget tree. Check for un-disposed StreamSubscriptions.',
   'Run Flutter DevTools memory profiler on the Checkout screen.',
   0.45, 1, 'medium',
   '{"fps": 24, "memory_pct": 81, "screen": "Checkout"}',
   'active', NOW() - INTERVAL '45 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'growth', 'Checkout completion rate is strong on fast connections',
   'Sessions with response times under 200ms have a 100% checkout completion rate. Users on slower connections (>400ms) have a 0% completion rate. Prioritising performance could directly lift revenue.',
   0.88, 'Serve a lightweight checkout payload for users with degraded connection quality using an adaptive API.',
   'Add connection-quality detection and serve optimised payloads for slower users.',
   0.65, 7, 'medium',
   '{"fast_completion_rate": "100%", "slow_completion_rate": "0%", "threshold_ms": 400}',
   'active', NOW() - INTERVAL '20 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'error', 'Pre-migration users crashing on Profile screen',
   'Users who registered before the v2.1 schema migration have a null preferences field, causing a fatal crash on the Profile screen. Affects an estimated 2 users.',
   0.97, 'Run a one-off migration: UPDATE users SET preferences = ''{}'' WHERE preferences IS NULL.',
   'Apply DB patch immediately — this is a fatal crash for a known user segment.',
   0.55, 2, 'high',
   '{"crash_type": "NullPointerException", "screen": "Profile", "affected_segment": "pre-v2.1 users"}',
   'active', NOW() - INTERVAL '22 minutes');

-- ============================================================
-- Feature Health (Phase 2)
-- ============================================================
INSERT INTO feature_health (project_id, feature_name, health_score, usage_score, error_score, completion_rate, event_count, error_count, trend, ai_summary) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Checkout',  0.48, 0.72, 0.20, 0.58, 18, 3, 'declining', 'Checkout is under stress — 3 active errors and a 42% abandonment rate. Payment gateway issues are the primary driver. Needs urgent attention.'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Login',     0.87, 0.90, 0.95, 0.80, 12, 0, 'stable',    'Login is performing well with no errors and a high success rate. Both email and Google OAuth flows are working correctly.'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Dashboard', 0.74, 0.85, 0.82, 0.70, 10, 1, 'stable',    'Dashboard loads are slightly degraded due to a 520ms response time spike. One StateError detected but non-fatal.'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Profile',   0.31, 0.40, 0.10, 0.50,  5, 1, 'declining', 'Profile is critically impacted by a null pointer crash affecting pre-migration users. Immediate patching required.'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'Search',    0.82, 0.80, 0.95, 0.75,  4, 0, 'improving', 'Search is healthy with zero errors and good completion. Engagement is growing.'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'Product',   0.71, 0.70, 0.85, 0.65,  3, 1, 'stable',    'Product screen has one TypeError but overall performance is acceptable. Cart add rate is solid.');

-- ============================================================
-- User Journeys (Phase 2)
-- ============================================================
INSERT INTO user_journeys (project_id, session_id, journey_name, steps, completed, drop_off_step, drop_off_reason, ai_analysis) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001',
   'Login → Checkout',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Login"},{"step":3,"screen":"Dashboard"},{"step":4,"screen":"Checkout"}]',
   true, null, null,
   'User completed the full purchase funnel in 5 minutes. Login via email, navigated directly to checkout. No friction detected.'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000002',
   'Login → Profile',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Login"},{"step":3,"screen":"Dashboard"},{"step":4,"screen":"Profile"}]',
   true, null, null,
   'User updated their profile after login via Google. Smooth journey with no errors or delays.'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000003',
   'Login → Checkout',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Login"},{"step":3,"screen":"Checkout"}]',
   false, 'Checkout', 'Session ended without completion',
   'User dropped off at Checkout. A NetworkError was recorded at this point — likely caused by the payment gateway 502. This is a lost conversion.'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000004',
   'Dashboard → Checkout',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Dashboard"},{"step":3,"screen":"Checkout"}]',
   true, null, null,
   'Returning user skipped login (cached session) and completed checkout. Fastest journey in the dataset at 8 minutes end-to-end.'),

  ('a1b2c3d4-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000007',
   'Home → Checkout',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Home"},{"step":3,"screen":"Search"},{"step":4,"screen":"Product"},{"step":5,"screen":"Checkout"}]',
   true, null, null,
   'Discovery-to-purchase journey. User searched for "shoes", viewed a product and completed checkout. Full funnel in 7 minutes — healthy conversion path.');

-- ============================================================
-- Anomaly Events (Phase 2)
-- ============================================================
INSERT INTO anomaly_events (project_id, type, severity, detected_pattern, confidence, metadata) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'error_spike',      'critical', 'Error rate increased 1200% in the last hour compared to the previous hour', 0.94, '{"recent_errors": 5, "previous_errors": 0}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'high_abandonment', 'warning',  '42% of sessions that reached Checkout were abandoned',                       0.82, '{"abandoned": 2, "total": 5}');

-- ============================================================
-- Investigations (Phase 3)
-- ============================================================
INSERT INTO investigations (id, project_id, incident_id, title, status, root_cause, timeline, affected_services, confidence, business_impact, technical_impact, evidence, recommendations_count, agents_run, created_at, completed_at) VALUES
  ('ee000001-0000-0000-0000-000000000001',
   'a1b2c3d4-0000-0000-0000-000000000001',
   NULL,
   'Investigation: Payment gateway causing checkout abandonment',
   'complete',
   'Deployment 3.8.1 introduced a misconfigured payment gateway timeout (5s → 3s). Android clients with p75 latency above 2.8s are exceeding the new timeout, causing 18% of checkout attempts to return a 502. Users on slower connections have a 0% completion rate.',
   '[{"time":"85 min ago","event":"Deployment 3.8.1 pushed to production","severity":"medium"},{"time":"80 min ago","event":"Payment gateway error rate began rising — 2.1% vs 1.5% baseline","severity":"low"},{"time":"72 min ago","event":"Error rate crossed 10% threshold — first NetworkError recorded on Checkout screen","severity":"high"},{"time":"65 min ago","event":"Payment gateway error rate peaked at 18% — checkout abandonment spike detected","severity":"critical"},{"time":"60 min ago","event":"Critical incident declared — engineering team notified","severity":"critical"},{"time":"30 min ago","event":"Root cause identified: gateway timeout misconfiguration in 3.8.1","severity":"high"}]',
   ARRAY['Checkout', 'Payment Gateway', '/api/payment'],
   0.94,
   'Payment gateway failures are blocking an estimated $2,400/hr in revenue. 3 confirmed lost transactions in the past 85 minutes. Checkout completion rate dropped from 74% to 32%.',
   'The payment gateway client timeout was reduced from 5000ms to 3000ms in deployment 3.8.1 (payment_config.dart:42). Android devices with median API latency of 2.8s are frequently exceeding this threshold. The 502 error propagates to the UI as a NetworkError and the client does not retry.',
   '{"incident":"Payment failures began 85 minutes ago correlated precisely with deployment 3.8.1. Error rate spiked 1200% within 15 minutes of deploy.","root_cause":"Timeout regression in deployment 3.8.1 — payment_config.dart timeout changed from 5000ms to 3000ms. Android p75 latency is 2.8s, meaning many requests are borderline.","product":"3 out of 4 affected users did not retry after the first failure. Checkout abandonment rate jumped from 26% to 68% for sessions experiencing errors.","ux":"Users hit a generic error screen with no retry button. The lack of a retry CTA is compounding the abandonment rate significantly.","qa":"This regression matches incident #324 from 6 weeks ago where a similar timeout change caused checkout failures. Test coverage for timeout edge cases appears insufficient.","performance":"API p99 latency for /api/payment is 4.1s — 37% above the (now incorrect) 3s timeout. p50 latency is 1.8s which would pass.","security":"No security concerns detected in this investigation.","executive":"A recent app update accidentally made the payment system less tolerant of slow connections. This is blocking roughly $2,400 per hour in revenue. Rolling back the update or restoring the original setting will fix it within 5 minutes."}',
   3,
   ARRAY['incident','root_cause','product','ux','qa','performance','security','executive'],
   NOW() - INTERVAL '30 minutes',
   NOW() - INTERVAL '28 minutes'),

  ('ee000001-0000-0000-0000-000000000002',
   'a1b2c3d4-0000-0000-0000-000000000001',
   NULL,
   'Investigation: Profile screen fatal crash for pre-migration users',
   'complete',
   'Users who registered before the v2.1 database migration have a NULL preferences field. The Profile screen introduced a null-safety assertion in v2.1 that crashes the app when preferences is null. Approximately 2 users are affected.',
   '[{"time":"28 min ago","event":"NullPointerException first recorded on Profile screen — user eve@example.com","severity":"critical"},{"time":"25 min ago","event":"Second crash recorded — pattern confirmed across 2 users","severity":"critical"},{"time":"22 min ago","event":"Investigation triggered — pre-migration user segment identified as root cause","severity":"high"}]',
   ARRAY['Profile', 'users table', '/api/users'],
   0.97,
   'Fatal crash for users registered before v2.1. Affected users cannot access their profile. Estimated 2 users blocked currently, growing as older users upgrade to v2.1.',
   'The null-safety assertion at profile.dart:88 was added in v2.1 but the corresponding database migration (UPDATE users SET preferences = ''{}'' WHERE preferences IS NULL) was not applied to existing records. Pre-migration users have preferences = NULL.',
   '{"incident":"Fatal NullPointerException crash on Profile screen. 2 users confirmed affected — both registered before v2.1 migration cutoff.","root_cause":"Missing backfill migration. v2.1 added a null-safety assertion but did not update existing NULL records in the users table.","product":"Affected users are unable to view or edit their profile. If this segment is not patched, churn risk is high for these long-standing users.","ux":"The crash provides no error message to the user — the app simply closes. No graceful fallback or error state exists.","qa":"The migration script was tested on a fresh database with no legacy users. This gap in QA coverage allowed the regression through.","performance":"No performance impact — this is a data integrity issue.","security":"No security concerns detected.","executive":"A database update from last week accidentally broke the profile screen for users who joined before that update. Two users are affected right now. A 30-second database fix will resolve it permanently."}',
   2,
   ARRAY['incident','root_cause','product','ux','qa','performance','security','executive'],
   NOW() - INTERVAL '22 minutes',
   NOW() - INTERVAL '20 minutes');

-- ============================================================
-- Agent Tasks (Phase 3)
-- ============================================================
INSERT INTO agent_tasks (project_id, investigation_id, agent_name, status, output, duration_ms, created_at, completed_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'incident',    'complete', '{"summary":"Payment failures began 85 minutes ago correlated precisely with deployment 3.8.1."}',     1820, NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'root_cause',  'complete', '{"summary":"Timeout regression in deployment 3.8.1 — payment_config.dart timeout changed from 5000ms to 3000ms."}', 1820, NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'product',     'complete', '{"summary":"3 out of 4 affected users did not retry after the first failure."}',                  1820, NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'ux',          'complete', '{"summary":"Users hit a generic error screen with no retry button."}',                           1820, NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'qa',          'complete', '{"summary":"This regression matches incident #324 from 6 weeks ago."}',                         1820, NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'performance', 'complete', '{"summary":"API p99 latency for /api/payment is 4.1s — 37% above the timeout."}',               1820, NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'security',    'complete', '{"summary":"No security concerns detected in this investigation."}',                            1820, NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'executive',   'complete', '{"summary":"A recent app update accidentally made the payment system less tolerant of slow connections."}', 1820, NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002', 'incident',    'complete', '{"summary":"Fatal NullPointerException crash on Profile screen. 2 users confirmed affected."}',  1450, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002', 'root_cause',  'complete', '{"summary":"Missing backfill migration. v2.1 added a null-safety assertion but did not update existing NULL records."}', 1450, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002', 'product',     'complete', '{"summary":"Affected users are unable to view or edit their profile. Churn risk is high."}',    1450, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002', 'ux',          'complete', '{"summary":"The crash provides no error message to the user — the app simply closes."}',         1450, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002', 'qa',          'complete', '{"summary":"The migration script was tested on a fresh database with no legacy users."}',        1450, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002', 'performance', 'complete', '{"summary":"No performance impact — this is a data integrity issue."}',                        1450, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002', 'security',    'complete', '{"summary":"No security concerns detected."}',                                                  1450, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002', 'executive',   'complete', '{"summary":"A database update from last week accidentally broke the profile screen for legacy users."}', 1450, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes');

-- ============================================================
-- Recommendations (Phase 3)
-- ============================================================
INSERT INTO recommendations (project_id, investigation_id, type, title, description, confidence, impact_score, effort, expected_improvement, suggested_owner, priority, status, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001',
   'rollback', 'Revert payment gateway timeout to 5000ms',
   'In payment_config.dart:42, change the timeout from 3000 to 5000 milliseconds. This is the exact value used before deployment 3.8.1 and will immediately restore checkout functionality.',
   0.96, 0.91, 'low', 'Checkout error rate returns to baseline 1.5% within 5 minutes of deploy',
   'Engineering', 'critical', 'pending', NOW() - INTERVAL '28 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001',
   'fix', 'Add retry button to payment error screen',
   'The payment error UI (checkout_error.dart) has no retry CTA. 75% of failed payment users abandon instead of retrying. Adding a single retry button is estimated to recover 15% of lost conversions.',
   0.82, 0.72, 'low', 'Estimated 15% recovery of abandoned checkouts — approximately $360/hr',
   'Engineering', 'high', 'pending', NOW() - INTERVAL '28 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001',
   'investigate', 'Add timeout regression test to CI pipeline',
   'The QA agent identified this as a repeat of incident #324. Add an automated test that verifies payment gateway timeout values are not reduced below 5000ms. This prevents recurrence.',
   0.88, 0.45, 'medium', 'Prevents this class of regression from reaching production',
   'Engineering', 'medium', 'approved', NOW() - INTERVAL '28 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002',
   'patch', 'Apply user preferences backfill migration',
   'Run: UPDATE users SET preferences = ''{}''::jsonb WHERE preferences IS NULL. This is a safe, non-destructive operation that resolves the crash for all pre-migration users immediately.',
   0.97, 0.55, 'low', 'Fatal crash resolved for all affected users within 60 seconds of applying patch',
   'Engineering', 'critical', 'pending', NOW() - INTERVAL '20 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000002',
   'fix', 'Add null guard to Profile screen preferences access',
   'Even after the backfill, add a defensive null check at profile.dart:88 to prevent future crashes if preferences is ever null for any reason.',
   0.91, 0.40, 'low', 'Eliminates this crash permanently, regardless of future data state',
   'Engineering', 'high', 'pending', NOW() - INTERVAL '20 minutes');

-- ============================================================
-- Product Memory (Phase 3)
-- ============================================================
INSERT INTO product_memory (project_id, type, title, summary, content, tags, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001',
   'incident',
   'Payment gateway timeout regression in deployment 3.8.1',
   'Deployment 3.8.1 reduced the payment gateway client timeout from 5000ms to 3000ms in payment_config.dart:42. Android users with p75 latency of 2.8s experienced 18% checkout failure rate. Revenue impact: ~$2,400/hr. Fix: revert timeout to 5000ms.',
   '{"investigation_id":"ee000001-0000-0000-0000-000000000001","root_cause":"Timeout regression in deployment 3.8.1","confidence":0.94,"affected_services":["Checkout","Payment Gateway"]}',
   ARRAY['payment', 'checkout', 'timeout', 'deployment', 'android', 'regression'],
   NOW() - INTERVAL '28 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'incident',
   'Profile screen crash — null preferences field for pre-migration users',
   'v2.1 introduced a null-safety assertion on the preferences field without backfilling existing NULL records. Users registered before v2.1 crash on the Profile screen. Fix: run UPDATE users SET preferences = ''{}'' WHERE preferences IS NULL.',
   '{"investigation_id":"ee000001-0000-0000-0000-000000000002","root_cause":"Missing backfill migration for preferences field","confidence":0.97,"affected_services":["Profile","users table"]}',
   ARRAY['profile', 'crash', 'migration', 'null-safety', 'preferences', 'pre-migration'],
   NOW() - INTERVAL '20 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'insight',
   'Checkout completion rate is strongly correlated with API response time',
   'Sessions with /api/payment response times under 200ms have 100% checkout completion. Sessions above 400ms have 0% completion. This 200ms threshold should be treated as a hard SLA for the payment API.',
   '{"source":"ai_insights","finding":"response_time_conversion_correlation","threshold_ms":200}',
   ARRAY['checkout', 'performance', 'conversion', 'sla', 'response-time'],
   NOW() - INTERVAL '20 minutes');

-- ============================================================
-- Executive Reports (Phase 3)
-- ============================================================
INSERT INTO executive_reports (project_id, period, platform_health, revenue_impact, critical_issues, resolved_today, top_priorities, summary, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001',
   'daily',
   0.62,
   'High — estimated $2,400/hr blocked by payment gateway issue',
   2,
   1,
   '[{"priority":1,"issue":"Payment gateway timeout regression","impact":"$2400/hr","owner":"Engineering"},{"priority":2,"issue":"Profile screen crash for legacy users","impact":"2 users blocked","owner":"Engineering"}]',
   'Today''s platform health is below target at 62%. Two critical issues are active: a payment gateway timeout regression introduced in deployment 3.8.1 is blocking checkout for ~18% of users, and a database migration gap is causing a fatal crash on the Profile screen for pre-v2.1 users. The engineering team has identified root causes for both. Resolving the payment gateway issue is the highest priority due to revenue impact.',
   NOW() - INTERVAL '15 minutes');

-- ============================================================
-- Deployment Analysis (Phase 3)
-- ============================================================
INSERT INTO deployment_analysis (project_id, version, deployed_at, health_status, error_delta, latency_delta, affected_features, evidence, recommendation, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001',
   '3.8.1',
   NOW() - INTERVAL '90 minutes',
   'critical',
   12.0,
   0.37,
   ARRAY['Checkout', 'Payment'],
   '{"error_rate_before":"1.5%","error_rate_after":"18%","latency_p99_before":"3.0s","latency_p99_after":"4.1s","first_error_at":"75 min ago","deployment_correlation":"errors began within 15 minutes of deploy"}',
   'Roll back deployment 3.8.1 immediately. Root cause confirmed: payment gateway timeout reduced from 5000ms to 3000ms in payment_config.dart:42.',
   NOW() - INTERVAL '28 minutes');
