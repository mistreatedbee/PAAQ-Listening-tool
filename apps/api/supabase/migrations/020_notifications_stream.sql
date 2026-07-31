-- Migration 020: Real-time notification stream
--
-- The `notifications` table already exists (database/migrations/001_initial_schema.sql)
-- and is already read by the topbar bell (apps/dashboard/components/shell/topbar.tsx),
-- but nothing ever writes into it — the notifications page instead re-merges
-- six live tables on every page load with no durable read/unread state.
-- This migration extends the existing table with the columns needed to
-- back it with genuine triggers, so both the bell and the activity-stream
-- page can read one real, persistent feed.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS source_table TEXT,
  ADD COLUMN IF NOT EXISTS source_id    UUID,
  ADD COLUMN IF NOT EXISTS category     TEXT,
  ADD COLUMN IF NOT EXISTS read_at      TIMESTAMPTZ;

-- De-dup guard: a trigger firing twice for the same source row (e.g. after a
-- retried insert) can't produce duplicate notifications.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_uidx
  ON notifications(source_table, source_id) WHERE source_table IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_project_created
  ON notifications(project_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
CREATE POLICY notifications_tenant_isolation ON notifications
  FOR ALL USING (user_can_access_project(project_id));

-- ─── Triggers: one AFTER INSERT per source table ───────────────────────────
-- Each maps its row into the existing (type, message, severity) shape the
-- bell already reads, plus the new (source_table, source_id, category)
-- columns the activity-stream page will read going forward. Severity is
-- constrained by the table's existing CHECK to critical|warning|info|success.

CREATE OR REPLACE FUNCTION notify_from_ai_insights() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (project_id, source_table, source_id, category, type, message, severity)
  VALUES (
    NEW.project_id, 'ai_insights', NEW.id, 'insight', 'ai_insight',
    COALESCE(NEW.title, 'AI Insight'),
    CASE WHEN NEW.priority = 'critical' THEN 'critical' WHEN NEW.priority = 'high' THEN 'warning' ELSE 'info' END
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_ai_insights ON ai_insights;
CREATE TRIGGER trg_notify_ai_insights AFTER INSERT ON ai_insights
  FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION notify_from_ai_insights();

CREATE OR REPLACE FUNCTION notify_from_investigations() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (project_id, source_table, source_id, category, type, message, severity)
  VALUES (
    NEW.project_id, 'investigations', NEW.id, 'investigation', 'investigation',
    COALESCE(NEW.title, 'Investigation started'), 'info'
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_investigations ON investigations;
CREATE TRIGGER trg_notify_investigations AFTER INSERT ON investigations
  FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION notify_from_investigations();

CREATE OR REPLACE FUNCTION notify_from_recommendations() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (project_id, source_table, source_id, category, type, message, severity)
  VALUES (
    NEW.project_id, 'recommendations', NEW.id, 'recommendation', 'recommendation',
    COALESCE(NEW.title, 'New recommendation'),
    CASE WHEN NEW.risk_level = 'critical' THEN 'critical' WHEN NEW.risk_level = 'high' THEN 'warning' ELSE 'info' END
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_recommendations ON recommendations;
CREATE TRIGGER trg_notify_recommendations AFTER INSERT ON recommendations
  FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION notify_from_recommendations();

CREATE OR REPLACE FUNCTION notify_from_anomaly_events() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (project_id, source_table, source_id, category, type, message, severity)
  VALUES (
    NEW.project_id, 'anomaly_events', NEW.id, 'anomaly', 'anomaly',
    COALESCE(NEW.detected_pattern, NEW.type, 'Anomaly detected'),
    CASE WHEN NEW.severity IN ('critical', 'fatal') THEN 'critical' ELSE 'warning' END
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_anomaly_events ON anomaly_events;
CREATE TRIGGER trg_notify_anomaly_events AFTER INSERT ON anomaly_events
  FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION notify_from_anomaly_events();

-- Only terminal deployment states — mirrors the "skip pending" logic already
-- in deployment-webhook/index.ts.
CREATE OR REPLACE FUNCTION notify_from_deployment_registry() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('success', 'failed') THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (project_id, source_table, source_id, category, type, message, severity)
  VALUES (
    NEW.project_id, 'deployment_registry', NEW.id, 'deployment', 'deployment',
    CASE WHEN NEW.ai_fix THEN 'AI Fix deployed — ' || NEW.version ELSE 'Deployment — ' || NEW.version END,
    CASE WHEN NEW.status = 'failed' THEN 'critical' ELSE 'success' END
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_deployment_registry ON deployment_registry;
CREATE TRIGGER trg_notify_deployment_registry AFTER INSERT OR UPDATE ON deployment_registry
  FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION notify_from_deployment_registry();

-- Only open errors — mirrors the .eq('status','open') filter already used
-- by the notifications page and security page today.
CREATE OR REPLACE FUNCTION notify_from_errors() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (project_id, source_table, source_id, category, type, message, severity)
  VALUES (
    NEW.project_id, 'errors', NEW.id, 'error', 'error',
    COALESCE(NEW.error_type, 'Runtime Error'),
    CASE WHEN NEW.severity IN ('fatal', 'error') THEN 'critical' ELSE 'warning' END
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_errors ON errors;
CREATE TRIGGER trg_notify_errors AFTER INSERT ON errors
  FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION notify_from_errors();
