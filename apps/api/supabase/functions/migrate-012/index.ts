// One-shot migration runner for 012_repository_credentials.sql and
// 013_recommendation_fix_state.sql — call once, then delete this function.
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
      CREATE TABLE IF NOT EXISTS repository_credentials (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id          UUID        NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
        provider            TEXT        NOT NULL CHECK (provider IN ('github','gitlab','azure','bitbucket')),
        access_ciphertext   TEXT        NOT NULL,
        access_iv           TEXT        NOT NULL,
        refresh_ciphertext  TEXT,
        refresh_iv          TEXT,
        token_expires_at    TIMESTAMPTZ,
        scopes              TEXT,
        key_version         INT         NOT NULL DEFAULT 1,
        status              TEXT        NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error','disabled')),
        last_verified_at    TIMESTAMPTZ,
        last_verify_ok      BOOLEAN,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS repository_credentials_project_provider_uidx
        ON repository_credentials(project_id, provider);

      ALTER TABLE repository_credentials ENABLE ROW LEVEL SECURITY;

      ALTER TABLE project_repositories ADD COLUMN IF NOT EXISTS default_branch TEXT;

      ALTER TABLE recommendations
        ADD COLUMN IF NOT EXISTS fix_changeset JSONB,
        ADD COLUMN IF NOT EXISTS fix_branch    TEXT,
        ADD COLUMN IF NOT EXISTS fix_pr_url    TEXT,
        ADD COLUMN IF NOT EXISTS fix_pr_number INT,
        ADD COLUMN IF NOT EXISTS fix_pr_state  TEXT CHECK (fix_pr_state IN ('none','open','merged','closed','failed')) DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS fix_merged_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS fix_error     TEXT;
    `)

    await client.end()
    return new Response(JSON.stringify({ ok: true, message: 'Migrations 012+013 applied' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    await client.end()
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
