-- Update SDK release catalog to @paaq/sdk v1.4.2 (replaces stale @paaq/web-sdk v1.2.9 rows).

INSERT INTO sdk_release_catalog (platform, package_name, latest_version, release_notes, published_at, updated_at)
VALUES
  ('react', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now()),
  ('nextjs', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now()),
  ('vue', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now()),
  ('vanilla', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now()),
  ('web', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now()),
  ('nodejs', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now()),
  ('react-native', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now()),
  ('ios', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now()),
  ('android', '@paaq/sdk', '1.4.2', 'Unified @paaq/sdk — one package for web, Node, and React Native.', now(), now())
ON CONFLICT (platform) DO UPDATE SET
  package_name = EXCLUDED.package_name,
  latest_version = EXCLUDED.latest_version,
  release_notes = EXCLUDED.release_notes,
  published_at = EXCLUDED.published_at,
  updated_at = EXCLUDED.updated_at;

-- Clear stale sdk_update notifications that referenced wrong postgres→web version comparisons.
DELETE FROM notifications WHERE type = 'sdk_update';
