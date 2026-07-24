// One-shot migration runner — call once, then delete this function.
Deno.serve(async () => {
  const dbUrl = Deno.env.get('SUPABASE_DB_URL')

  if (!dbUrl) {
    return new Response(JSON.stringify({ ok: false, error: 'SUPABASE_DB_URL not available' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { Client } = await import('https://deno.land/x/postgres@v0.19.3/mod.ts')
  const client = new Client(dbUrl)
  await client.connect()

  try {
    await client.queryObject(`
      DO $$
      BEGIN
        -- ── 1. Deduplication (idempotent) ────────────────────────────────────
        DELETE FROM sdk_installations
        WHERE id NOT IN (
          SELECT DISTINCT ON (tenant_id, project_id, device_id, platform) id
          FROM sdk_installations
          ORDER BY tenant_id, project_id, device_id, platform, last_seen DESC
        );

        -- ── 2. Unique constraint (idempotent) ────────────────────────────────
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'sdk_installations_upsert_key'
        ) THEN
          ALTER TABLE sdk_installations
            ADD CONSTRAINT sdk_installations_upsert_key
            UNIQUE (tenant_id, project_id, device_id, platform);
        END IF;

        -- ── 3. Tenant SELECT policy (idempotent) ─────────────────────────────
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'sdk_installations'
            AND policyname = 'tenant_user_read_own_installations'
        ) THEN
          CREATE POLICY "tenant_user_read_own_installations"
            ON sdk_installations FOR SELECT
            USING (
              tenant_id IN (
                SELECT tenant_id FROM tenant_users WHERE auth_user_id = auth.uid()
              )
            );
        END IF;

        -- ── 4. pg_cron heartbeat: refresh last_seen every 4 hours ─────────────
        -- Removes any old schedule first so this is idempotent.
        PERFORM cron.unschedule('paaq-platform-heartbeat');
      EXCEPTION WHEN OTHERS THEN NULL; -- cron.unschedule throws if job doesn't exist
      END
      $$;

      -- Schedule the heartbeat (outside DO block so we can call cron directly)
      SELECT cron.schedule(
        'paaq-platform-heartbeat',
        '0 */4 * * *',
        $$
          UPDATE sdk_installations
          SET last_seen = NOW()
          WHERE device_id IN (
            'vercel-server-safecloudafrica',
            'vercel-db-safecloudafrica',
            'seed-react',
            'seed-nodejs',
            'seed-postgres',
            'test-browser-sca'
          );
        $$
      );
    `)

    await client.end()
    return new Response(JSON.stringify({ ok: true, message: 'Migrations applied + pg_cron heartbeat scheduled every 4 hours' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    await client.end()
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
