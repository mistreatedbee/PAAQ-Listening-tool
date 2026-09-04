-- Announce @paaq/web-sdk v1.2.9 to all projects (idempotent).

INSERT INTO sdk_release_catalog (platform, package_name, latest_version, release_notes, published_at, updated_at)
VALUES
  ('react', '@paaq/web-sdk', '1.2.9', 'Recording replay fixes, error-window capture, and performance monitoring improvements.', now(), now()),
  ('nextjs', '@paaq/web-sdk', '1.2.9', 'Recording replay fixes, error-window capture, and performance monitoring improvements.', now(), now()),
  ('vue', '@paaq/web-sdk', '1.2.9', 'Recording replay fixes, error-window capture, and performance monitoring improvements.', now(), now()),
  ('vanilla', '@paaq/web-sdk', '1.2.9', 'Recording replay fixes, error-window capture, and performance monitoring improvements.', now(), now()),
  ('web', '@paaq/web-sdk', '1.2.9', 'Recording replay fixes, error-window capture, and performance monitoring improvements.', now(), now())
ON CONFLICT (platform) DO UPDATE SET
  package_name = EXCLUDED.package_name,
  latest_version = EXCLUDED.latest_version,
  release_notes = EXCLUDED.release_notes,
  published_at = EXCLUDED.published_at,
  updated_at = EXCLUDED.updated_at;

WITH release_msg AS (
  SELECT 'New SDK release: @paaq/web-sdk v1.2.9 (react, nextjs, vue, vanilla, web). Recording replay fixes, error-window capture, and performance monitoring improvements. Copy agent prompt: Upgrade PAAQ SDK to v1.2.9. Run npm install @paaq/web-sdk@1.2.9, re-init with your dashboard SDK token, and verify X-SDK-Version is 1.2.9.'::text AS message
),
targets AS (
  SELECT p.id AS project_id
  FROM projects p
  WHERE NOT EXISTS (
    SELECT 1 FROM sdk_release_announcements a
    WHERE a.project_id = p.id
      AND a.package_name = '@paaq/web-sdk'
      AND a.version = '1.2.9'
  )
)
INSERT INTO notifications (project_id, type, message, severity, read)
SELECT t.project_id, 'sdk_update', r.message, 'info', false
FROM targets t
CROSS JOIN release_msg r;

INSERT INTO sdk_release_announcements (project_id, package_name, version)
SELECT p.id, '@paaq/web-sdk', '1.2.9'
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM sdk_release_announcements a
  WHERE a.project_id = p.id
    AND a.package_name = '@paaq/web-sdk'
    AND a.version = '1.2.9'
);
