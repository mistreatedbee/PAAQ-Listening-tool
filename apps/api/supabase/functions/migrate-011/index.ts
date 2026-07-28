// One-shot migration runner for 011_database_connectors.sql — call once, then delete this function.
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
      CREATE TABLE IF NOT EXISTS database_connectors (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id          UUID        NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
        engine              TEXT        NOT NULL CHECK (engine IN ('postgres','mysql','mongodb','sqlite','redis','supabase')),
        display_host        TEXT,
        display_database    TEXT,
        display_username    TEXT,
        ciphertext          TEXT        NOT NULL,
        iv                  TEXT        NOT NULL,
        key_version         INT         NOT NULL DEFAULT 1,
        status              TEXT        NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error','disabled')),
        last_test_at        TIMESTAMPTZ,
        last_test_ok        BOOLEAN,
        last_error          TEXT,
        introspected_tables JSONB,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS database_connectors_project_uidx ON database_connectors(project_id);

      ALTER TABLE database_connectors ENABLE ROW LEVEL SECURITY;
    `)

    await client.end()
    return new Response(JSON.stringify({ ok: true, message: 'Migration 011 applied' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    await client.end()
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
