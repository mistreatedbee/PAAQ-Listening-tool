/**
 * PAAQ Deployment Diagnosis
 *
 * Reads a failed deployment's build_log, sends it to Claude,
 * and writes a plain-English diagnosis back to ai_diagnosis.
 *
 * Called automatically by deployment-webhook for failed builds
 * that include a build_log, and also callable manually from the dashboard.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return respond(null, 204)
  }

  const { deployment_id } = await req.json().catch(() => ({})) as { deployment_id?: string }
  if (!deployment_id) return respond({ error: 'deployment_id required' }, 400)

  const { data: dep } = await supabase
    .from('deployment_registry')
    .select('id, version, environment, status, build_log, release_notes, git_commit')
    .eq('id', deployment_id)
    .maybeSingle()

  if (!dep) return respond({ error: 'Deployment not found' }, 404)
  if (!dep.build_log) return respond({ error: 'No build log attached to this deployment' }, 400)

  const prompt = `You are a senior DevOps engineer. A deployment failed and you must diagnose the root cause.

Deployment metadata:
- Version: ${dep.version}
- Environment: ${dep.environment}
- Commit: ${dep.git_commit ?? 'unknown'}
- Message: ${dep.release_notes ?? 'none'}

Build log (last portion):
\`\`\`
${dep.build_log.slice(-8000)}
\`\`\`

Provide a concise diagnosis:
1. **Root cause** — one sentence describing exactly what failed
2. **Why it happened** — brief explanation (2-3 sentences max)
3. **How to fix it** — specific actionable steps (bullet points)

Be direct and specific. Reference actual error messages and file paths from the log.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return respond({ error: `AI request failed: ${err}` }, 502)
  }

  const ai = await res.json() as { content: { text: string }[] }
  const diagnosis = ai.content?.[0]?.text ?? ''

  await supabase
    .from('deployment_registry')
    .update({ ai_diagnosis: diagnosis })
    .eq('id', deployment_id)

  return respond({ ok: true, diagnosis })
})

function respond(body: unknown, status = 200) {
  return new Response(body === null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info' },
  })
}
