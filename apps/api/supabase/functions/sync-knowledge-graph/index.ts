/**
 * Rebuild the knowledge graph (nodes + edges) from registries and live telemetry.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { syncKnowledgeGraph } from '../_shared/knowledge-graph-engine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const body = await req.json().catch(() => ({})) as { project_id?: string }
  const projectId = body.project_id
  if (!projectId) return respond({ error: 'project_id is required' }, 400)

  try {
    const result = await syncKnowledgeGraph(supabase, projectId)
    return respond({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return respond({ error: msg }, 500)
  }
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-api-key, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
