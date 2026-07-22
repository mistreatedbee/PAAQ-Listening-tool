import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { query, projectId } = await req.json()
    if (!query || !projectId) {
      return new Response(JSON.stringify({ error: 'query and projectId required' }), { status: 400, headers: cors })
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Gather knowledge context in parallel
    const [features, apis, journeys, services, deployments, docs] = await Promise.all([
      sb.from('feature_registry').select('name, description, business_purpose, criticality, owning_team, dependencies').eq('project_id', projectId).limit(30),
      sb.from('api_registry').select('endpoint, method, purpose, owning_service, criticality, expected_latency_ms').eq('project_id', projectId).limit(50),
      sb.from('journey_registry').select('name, description, business_purpose, steps, success_state, criticality').eq('project_id', projectId).limit(20),
      sb.from('service_registry').select('name, description, service_type, owner, criticality, dependencies, status').eq('project_id', projectId).limit(20),
      sb.from('deployment_registry').select('version, environment, deployed_at, release_notes, changed_features, changed_services, status').eq('project_id', projectId).order('deployed_at', { ascending: false }).limit(10),
      sb.from('knowledge_documents').select('title, doc_type, ai_summary, content').eq('project_id', projectId).limit(10),
    ])

    const context = [
      features.data?.length ? `FEATURES:\n${JSON.stringify(features.data, null, 2)}` : '',
      apis.data?.length ? `APIs:\n${JSON.stringify(apis.data, null, 2)}` : '',
      journeys.data?.length ? `USER JOURNEYS:\n${JSON.stringify(journeys.data, null, 2)}` : '',
      services.data?.length ? `SERVICES:\n${JSON.stringify(services.data, null, 2)}` : '',
      deployments.data?.length ? `RECENT DEPLOYMENTS:\n${JSON.stringify(deployments.data, null, 2)}` : '',
      docs.data?.length ? `DOCUMENTATION:\n${docs.data.map((d) => `[${d.title}] ${d.ai_summary ?? d.content?.slice(0, 400)}`).join('\n\n')}` : '',
    ].filter(Boolean).join('\n\n---\n\n')

    if (!context) {
      return new Response(JSON.stringify({
        answer: 'No knowledge has been imported yet. Use the Import Knowledge wizard to register your features, APIs, and documentation.',
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `You are a Staff Engineer AI assistant embedded in the PAAQ Intelligence Platform. You have deep knowledge of the application architecture described below. Answer questions accurately, concisely, and in plain English. Reference specific features, APIs, services, or documentation when relevant. If the answer cannot be determined from the available knowledge, say so clearly — never guess or hallucinate.

APPLICATION KNOWLEDGE:
${context}`,
      messages: [{ role: 'user', content: query }],
    })

    const answer = (message.content[0] as { type: string; text: string }).text

    return new Response(JSON.stringify({ answer }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
