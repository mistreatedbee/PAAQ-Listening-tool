/**
 * Internal: announce a newly published SDK to all projects.
 * Called by scripts/release-sdk.mjs after npm publish.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { announceSdkRelease } from '../_shared/sdk-update-engine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  if (!checkInternalSecret(req)) return respond({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({})) as {
    package_name?: string
    version?: string
    platforms?: string[]
    release_notes?: string
  }

  if (!body.package_name || !body.version) {
    return respond({ error: 'package_name and version are required' }, 400)
  }

  try {
    const result = await announceSdkRelease(supabase, {
      packageName: body.package_name,
      version: body.version,
      platforms: body.platforms ?? [],
      releaseNotes: body.release_notes,
    })
    return respond({ ok: true, ...result })
  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-api-key, apikey, x-internal-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
