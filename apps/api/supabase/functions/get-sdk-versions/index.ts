/**
 * Public read of latest SDK versions (DB catalog merged with bundled defaults).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadLatestVersions } from '../_shared/sdk-update-engine.ts'
import { LATEST_SDK_VERSIONS, SDK_PACKAGES } from '../_shared/sdk-versions.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405)
  }

  try {
    const versions = await loadLatestVersions(supabase)
    return respond({
      ok: true,
      versions,
      packages: SDK_PACKAGES,
      bundled: LATEST_SDK_VERSIONS,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-api-key, apikey',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
