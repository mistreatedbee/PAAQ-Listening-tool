-- events/index.ts calls this RPC on every single event batch to advance the
-- "backend is alive because the frontend serving it is alive" and "database
-- connector is alive" proxy heartbeats (events-proxy-react, events-proxy-
-- backend, and any connected DB engine's device row) — but this function
-- was never actually created anywhere, ever (not schema drift; it simply
-- doesn't exist and never did). Every call has been failing (RPC not found)
-- since this code was written, which is why those proxy heartbeats have
-- been frozen since whenever the last real, direct upsert happened to hit
-- sdk_installations through some other path.
CREATE OR REPLACE FUNCTION upsert_sdk_heartbeat(
  p_tenant_id  UUID,
  p_project_id UUID,
  p_platform   TEXT,
  p_device_id  TEXT,
  p_sdk_version TEXT,
  p_last_seen  TIMESTAMPTZ
) RETURNS void AS $$
BEGIN
  INSERT INTO sdk_installations (tenant_id, project_id, platform, device_id, sdk_version, last_seen, status)
  VALUES (p_tenant_id, p_project_id, p_platform, p_device_id, p_sdk_version, p_last_seen, 'active')
  ON CONFLICT (tenant_id, project_id, device_id, platform)
  DO UPDATE SET last_seen = EXCLUDED.last_seen, sdk_version = EXCLUDED.sdk_version, status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
