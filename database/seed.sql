-- PAAQ Listening Platform — Seed Data
-- Run in Supabase SQL Editor to populate the dashboard with realistic test data.
-- Safe to re-run: deletes existing data first.

-- ============================================================
-- Clean slate
-- ============================================================
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
  ('a1b2c3d4-0000-0000-0000-000000000001', 'My Flutter App',    'pk_live_demo_flutter_001', 'flutter'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'React Native App',  'pk_live_demo_rn_002',      'react-native');

-- ============================================================
-- Users
-- ============================================================
INSERT INTO users (id, project_id, external_user_id, email, created_at) VALUES
  ('u0000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_alice',   'alice@example.com',   NOW() - INTERVAL '10 days'),
  ('u0000001-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_bob',     'bob@example.com',     NOW() - INTERVAL '7 days'),
  ('u0000001-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_carol',   'carol@example.com',   NOW() - INTERVAL '5 days'),
  ('u0000001-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_dave',    'dave@example.com',    NOW() - INTERVAL '3 days'),
  ('u0000001-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000001', 'usr_eve',     'eve@example.com',     NOW() - INTERVAL '1 day'),
  ('u0000001-0000-0000-0000-000000000006', 'a1b2c3d4-0000-0000-0000-000000000002', 'usr_frank',   'frank@example.com',   NOW() - INTERVAL '2 days'),
  ('u0000001-0000-0000-0000-000000000007', 'a1b2c3d4-0000-0000-0000-000000000002', 'usr_grace',   'grace@example.com',   NOW() - INTERVAL '4 hours');

-- ============================================================
-- Sessions
-- ============================================================
INSERT INTO sessions (id, project_id, user_id, status, duration, started_at) VALUES
  ('s0000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001', 'completed', 342,  NOW() - INTERVAL '2 hours'),
  ('s0000001-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000002', 'completed', 198,  NOW() - INTERVAL '3 hours'),
  ('s0000001-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 'abandoned', 45,   NOW() - INTERVAL '90 minutes'),
  ('s0000001-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000004', 'completed', 511,  NOW() - INTERVAL '1 hour'),
  ('s0000001-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000005', 'active',    NULL, NOW() - INTERVAL '10 minutes'),
  ('s0000001-0000-0000-0000-000000000006', 'a1b2c3d4-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001', 'abandoned', 22,   NOW() - INTERVAL '30 minutes'),
  ('s0000001-0000-0000-0000-000000000007', 'a1b2c3d4-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000006', 'completed', 280,  NOW() - INTERVAL '45 minutes'),
  ('s0000001-0000-0000-0000-000000000008', 'a1b2c3d4-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000007', 'active',    NULL, NOW() - INTERVAL '5 minutes');

-- ============================================================
-- Events
-- ============================================================
INSERT INTO events (project_id, session_id, event_name, event_category, screen_name, timestamp, properties) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'app_launch',        'navigation', 'Splash',       NOW() - INTERVAL '2 hours',            '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'screen_view',       'navigation', 'Login',        NOW() - INTERVAL '2 hours' + INTERVAL '5 seconds',  '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'login_submit',      'auth',       'Login',        NOW() - INTERVAL '2 hours' + INTERVAL '30 seconds', '{"method":"email"}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'login_success',     'auth',       'Login',        NOW() - INTERVAL '2 hours' + INTERVAL '32 seconds', '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'screen_view',       'navigation', 'Dashboard',    NOW() - INTERVAL '2 hours' + INTERVAL '35 seconds', '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'button_click',      'feature',    'Dashboard',    NOW() - INTERVAL '2 hours' + INTERVAL '1 minute',   '{"button":"create_order"}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'screen_view',       'navigation', 'Checkout',     NOW() - INTERVAL '2 hours' + INTERVAL '2 minutes',  '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'checkout_complete', 'feature',    'Checkout',     NOW() - INTERVAL '2 hours' + INTERVAL '5 minutes',  '{"value":49.99}'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'app_launch',        'navigation', 'Splash',       NOW() - INTERVAL '3 hours',            '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'screen_view',       'navigation', 'Login',        NOW() - INTERVAL '3 hours' + INTERVAL '4 seconds',  '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'login_submit',      'auth',       'Login',        NOW() - INTERVAL '3 hours' + INTERVAL '25 seconds', '{"method":"google"}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'login_success',     'auth',       'Login',        NOW() - INTERVAL '3 hours' + INTERVAL '27 seconds', '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'screen_view',       'navigation', 'Dashboard',    NOW() - INTERVAL '3 hours' + INTERVAL '30 seconds', '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'screen_view',       'navigation', 'Profile',      NOW() - INTERVAL '3 hours' + INTERVAL '2 minutes',  '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'profile_updated',   'feature',    'Profile',      NOW() - INTERVAL '3 hours' + INTERVAL '3 minutes',  '{}'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 'app_launch',        'navigation', 'Splash',       NOW() - INTERVAL '90 minutes',         '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 'screen_view',       'navigation', 'Login',        NOW() - INTERVAL '90 minutes' + INTERVAL '3 seconds',  '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 'login_submit',      'auth',       'Login',        NOW() - INTERVAL '90 minutes' + INTERVAL '20 seconds', '{"method":"email"}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 'screen_view',       'navigation', 'Checkout',     NOW() - INTERVAL '90 minutes' + INTERVAL '40 seconds', '{}'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'app_launch',        'navigation', 'Splash',       NOW() - INTERVAL '1 hour',             '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'screen_view',       'navigation', 'Dashboard',    NOW() - INTERVAL '1 hour' + INTERVAL '5 seconds',   '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'screen_view',       'navigation', 'Checkout',     NOW() - INTERVAL '1 hour' + INTERVAL '2 minutes',   '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'payment_start',     'feature',    'Checkout',     NOW() - INTERVAL '1 hour' + INTERVAL '3 minutes',   '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'checkout_complete', 'feature',    'Checkout',     NOW() - INTERVAL '1 hour' + INTERVAL '8 minutes',   '{"value":120.00}'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000005', 'app_launch',        'navigation', 'Splash',       NOW() - INTERVAL '10 minutes',         '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000005', 'screen_view',       'navigation', 'Dashboard',    NOW() - INTERVAL '10 minutes' + INTERVAL '2 seconds', '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000005', 'button_click',      'feature',    'Dashboard',    NOW() - INTERVAL '10 minutes' + INTERVAL '30 seconds', '{"button":"notifications"}'),

  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'app_launch',        'navigation', 'Splash',       NOW() - INTERVAL '45 minutes',         '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'screen_view',       'navigation', 'Home',         NOW() - INTERVAL '45 minutes' + INTERVAL '3 seconds', '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'screen_view',       'navigation', 'Search',       NOW() - INTERVAL '45 minutes' + INTERVAL '1 minute',  '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'search_submit',     'feature',    'Search',       NOW() - INTERVAL '45 minutes' + INTERVAL '2 minutes',  '{"query":"shoes"}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'item_viewed',       'feature',    'Product',      NOW() - INTERVAL '45 minutes' + INTERVAL '3 minutes',  '{"item_id":"prod_123"}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'add_to_cart',       'feature',    'Product',      NOW() - INTERVAL '45 minutes' + INTERVAL '4 minutes',  '{}'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'checkout_complete', 'feature',    'Checkout',     NOW() - INTERVAL '45 minutes' + INTERVAL '7 minutes',  '{"value":85.00}');

-- ============================================================
-- Errors
-- ============================================================
INSERT INTO errors (project_id, session_id, error_type, message, severity, status, screen, stack_trace, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 'NetworkError',      'Connection timed out after 30s',                        'error',   'open',     'Checkout',  'NetworkError\n  at _fetchPayment (checkout.dart:142)',  NOW() - INTERVAL '85 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000006', 'NullPointerError',  'Null check operator used on a null value',              'fatal',   'open',     'Profile',   'Null check operator\n  at UserProfile._build (profile.dart:88)',  NOW() - INTERVAL '28 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'APIError',          'Payment gateway returned 502 Bad Gateway',              'error',   'resolved', 'Checkout',  'APIError\n  at PaymentService.charge (payment.dart:67)',  NOW() - INTERVAL '1 hour'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'StateError',        'setState called after dispose',                         'warning', 'open',     'Dashboard', 'StateError\n  at _DashboardState.dispose (dashboard.dart:201)', NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'FormatException',   'Invalid JSON response from /api/orders',                 'error',   'open',     'Checkout',  'FormatException\n  at OrderService.parse (orders.dart:34)',  NOW() - INTERVAL '55 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'TypeError',         'Cannot read properties of undefined (reading ''name'')', 'warning', 'open',     'Product',   'TypeError\n  at ProductCard.render (ProductCard.jsx:45)',  NOW() - INTERVAL '40 minutes');

-- ============================================================
-- Performance Metrics
-- ============================================================
INSERT INTO performance_metrics (project_id, session_id, metric_type, value, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'response_time', 145, NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'response_time', 162, NOW() - INTERVAL '110 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'response_time', 189, NOW() - INTERVAL '3 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 'response_time', 520, NOW() - INTERVAL '90 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'response_time', 134, NOW() - INTERVAL '1 hour'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000005', 'response_time', 178, NOW() - INTERVAL '10 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'fps',           58,  NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'fps',           60,  NOW() - INTERVAL '3 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 'fps',           24,  NOW() - INTERVAL '90 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'fps',           59,  NOW() - INTERVAL '1 hour'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'memory',        52,  NOW() - INTERVAL '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 'memory',        48,  NOW() - INTERVAL '3 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 'memory',        81,  NOW() - INTERVAL '90 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004', 'memory',        44,  NOW() - INTERVAL '1 hour'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'response_time', 210, NOW() - INTERVAL '45 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007', 'fps',           55,  NOW() - INTERVAL '45 minutes');

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
-- ============================================================
INSERT INTO notifications (project_id, type, body, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'critical', 'ALERT: Payment gateway error rate exceeded 15% threshold',          NOW() - INTERVAL '75 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'warning',  'High memory usage detected in session s0000001-003 (81%)',           NOW() - INTERVAL '88 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'info',     'Team notified: Payment gateway intermittently returning 502',         NOW() - INTERVAL '78 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'info',     'New user registered: carol@example.com',                             NOW() - INTERVAL '5 days'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'info',     'Team notified: Profile screen crash on null user data',               NOW() - INTERVAL '22 minutes');

-- ============================================================
-- AI Insights
-- ============================================================
INSERT INTO ai_insights (project_id, category, title, description, confidence, recommendation, recommended_action, impact_score, affected_users, priority, evidence, status, created_at) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001',
   'error', 'Payment gateway causing checkout abandonment',
   '18% of checkout attempts in the last hour failed due to a 502 from the payment gateway. This is a 12x increase from the baseline error rate of 1.5%. 3 out of 4 affected users did not retry.',
   0.94,
   'Contact payment provider and enable the fallback gateway while the issue is investigated.',
   'Switch to backup payment provider immediately — estimated recovery time 5 minutes.',
   0.91, 3, 'critical',
   '{"error_rate_pct": "18%", "baseline_pct": "1.5%", "affected_sessions": 3, "revenue_at_risk": "$2400/hr"}',
   'active', NOW() - INTERVAL '30 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'warning', 'High session abandonment on Checkout screen',
   '42% of sessions that reached the Checkout screen did not complete. The abandonment rate is highest for sessions with response times above 400ms, suggesting a performance-conversion correlation.',
   0.81,
   'Optimise checkout API response time — target under 200ms to recover estimated 15% of lost conversions.',
   'Profile /api/checkout endpoint and add caching for product metadata.',
   0.72, 4, 'high',
   '{"abandonment_rate": "42%", "avg_response_ms": 520, "correlation": "response_time > 400ms"}',
   'active', NOW() - INTERVAL '1 hour'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'performance', 'FPS dropped to 24 for one active session',
   'Session s0000001-003 recorded 24 FPS during the Checkout flow, well below the 60 FPS target. This correlates with high memory usage (81%) recorded in the same session.',
   0.76,
   'Investigate memory leak in Checkout widget tree. Check for un-disposed StreamSubscriptions or image cache misuse.',
   'Run Flutter DevTools memory profiler on the Checkout screen and dispose subscriptions properly.',
   0.45, 1, 'medium',
   '{"fps": 24, "memory_pct": 81, "screen": "Checkout"}',
   'active', NOW() - INTERVAL '45 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'growth', 'Checkout completion rate is strong on fast connections',
   'Sessions with response times under 200ms have a 100% checkout completion rate. Users on slower connections (>400ms) have a 0% completion rate. Prioritising performance could directly lift revenue.',
   0.88,
   'Serve a lightweight checkout payload for users with degraded connection quality using an adaptive API.',
   'Add connection-quality detection and serve optimised payloads for slower users.',
   0.65, 7, 'medium',
   '{"fast_completion_rate": "100%", "slow_completion_rate": "0%", "threshold_ms": 400}',
   'active', NOW() - INTERVAL '20 minutes'),

  ('a1b2c3d4-0000-0000-0000-000000000001',
   'error', 'Pre-migration users crashing on Profile screen',
   'Users who registered before the v2.1 schema migration have a null preferences field, causing a fatal crash on the Profile screen. Affects an estimated 2 users.',
   0.97,
   'Run a one-off migration: UPDATE users SET preferences = ''{}'' WHERE preferences IS NULL.',
   'Apply DB patch immediately — this is a fatal crash for a known user segment.',
   0.55, 2, 'high',
   '{"crash_type": "NullPointerException", "screen": "Profile", "affected_segment": "pre-v2.1 users"}',
   'active', NOW() - INTERVAL '22 minutes');

-- ============================================================
-- Feature Health (Phase 2)
-- ============================================================
INSERT INTO feature_health (project_id, feature_name, health_score, usage_score, error_score, completion_rate, event_count, error_count, trend, ai_summary) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Checkout',  0.48, 0.72, 0.20, 0.58, 18, 3, 'declining',  'Checkout is under stress — 3 active errors and a 42% abandonment rate. Payment gateway issues are the primary driver. Needs urgent attention.'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Login',     0.87, 0.90, 0.95, 0.80, 12, 0, 'stable',     'Login is performing well with no errors and a high success rate. Both email and Google OAuth flows are working correctly.'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Dashboard', 0.74, 0.85, 0.82, 0.70, 10, 1, 'stable',     'Dashboard loads are slightly degraded due to a 520ms response time spike. One StateError detected but non-fatal.'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Profile',   0.31, 0.40, 0.10, 0.50,  5, 1, 'declining',  'Profile is critically impacted by a null pointer crash affecting pre-migration users. Immediate patching required.'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'Search',    0.82, 0.80, 0.95, 0.75,  4, 0, 'improving',  'Search is healthy with zero errors and good completion. Engagement is growing.'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'Product',   0.71, 0.70, 0.85, 0.65,  3, 1, 'stable',     'Product screen has one TypeError but overall performance is acceptable. Cart add rate is solid.');

-- ============================================================
-- User Journeys (Phase 2)
-- ============================================================
INSERT INTO user_journeys (project_id, session_id, journey_name, steps, completed, drop_off_step, drop_off_reason, ai_analysis) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001',
   'Login → Checkout',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Login"},{"step":3,"screen":"Dashboard"},{"step":4,"screen":"Checkout"}]',
   true, null, null,
   'User completed the full purchase funnel in 5 minutes. Login via email, navigated directly to checkout. No friction detected.'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002',
   'Login → Profile',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Login"},{"step":3,"screen":"Dashboard"},{"step":4,"screen":"Profile"}]',
   true, null, null,
   'User updated their profile after login via Google. Smooth journey with no errors or delays.'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003',
   'Login → Checkout',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Login"},{"step":3,"screen":"Checkout"}]',
   false, 'Checkout', 'Session ended without completion',
   'User dropped off at Checkout. A NetworkError was recorded at this point — likely caused by the payment gateway 502. This is a lost conversion.'),

  ('a1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000004',
   'Dashboard → Checkout',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Dashboard"},{"step":3,"screen":"Checkout"}]',
   true, null, null,
   'Returning user skipped login (cached session) and completed checkout. Fastest journey in the dataset at 8 minutes end-to-end.'),

  ('a1b2c3d4-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000007',
   'Home → Checkout',
   '[{"step":1,"screen":"Splash"},{"step":2,"screen":"Home"},{"step":3,"screen":"Search"},{"step":4,"screen":"Product"},{"step":5,"screen":"Checkout"}]',
   true, null, null,
   'Discovery-to-purchase journey. User searched for "shoes", viewed a product and completed checkout. Full funnel in 7 minutes — healthy conversion path.');

-- ============================================================
-- Anomaly Events (Phase 2)
-- ============================================================
INSERT INTO anomaly_events (project_id, type, severity, detected_pattern, confidence, metadata) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'error_spike',      'critical', 'Error rate increased 1200% in the last hour compared to previous hour', 0.94, '{"recent_errors": 5, "previous_errors": 0}'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'high_abandonment', 'warning',  '42% of sessions that reached Checkout were abandoned',                  0.82, '{"abandoned": 2, "total": 5}');
