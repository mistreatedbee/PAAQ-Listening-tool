import { createClient } from 'npm:@supabase/supabase-js'
import { getAiConfig, askModel } from '../_shared/ai.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { documentId, projectId, content, method, title } = await req.json()
    if (!content || !projectId) {
      return new Response(JSON.stringify({ error: 'content and projectId required' }), { status: 400, headers: cors })
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const aiConfig = getAiConfig()
    if (!aiConfig) {
      return new Response(JSON.stringify({ error: 'No AI API key configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets.' }), {
        status: 500,
        headers: cors,
      })
    }

    const prompt = method === 'features'
      ? `Parse this feature list and return a JSON array of feature objects. Each line is: "Name | Description | Criticality | Team". Return: { features: [{name, description, business_purpose, criticality, owning_team}] }`
      : method === 'services'
      ? `Parse this service inventory. Each line is: "Name | Type | Owner | Dependencies (comma separated)". Return JSON: { services: [{name, service_type, owner, dependencies: []}] }`
      : method === 'journeys'
      ? `Parse this user journey description. Extract the journey name, steps, success state, and any failure states. Return JSON: { journey: {name, description, steps: [{step, screen, action, required}], success_state, failure_states: []} }`
      : method === 'openapi'
      ? `Parse this OpenAPI spec. Extract API endpoints. Return JSON: { apis: [{endpoint, method, purpose, owning_service, criticality}] }`
      : null

    let extractedItems: Record<string, unknown> = {}
    let summary = ''

    // Structured extraction for bulk methods
    if (prompt) {
      const raw = await askModel({
        system: 'You are a structured data extractor. Return only valid JSON, no markdown fences.',
        prompt: `${prompt}\n\nINPUT:\n${content.slice(0, 4000)}`,
        maxTokens: 2000,
      })
      try {
        extractedItems = JSON.parse(raw.replace(/```json|```/g, '').trim())
      } catch { /* ignore parse errors — still store the doc */ }
    }

    // Bulk-insert extracted items into registries
    const tenant = await sb.from('tenant_projects').select('tenant_id').eq('id', projectId).single()
    const tenantId = tenant.data?.tenant_id

    if (tenantId) {
      if (extractedItems.features && Array.isArray(extractedItems.features)) {
        const rows = (extractedItems.features as Record<string, unknown>[]).map((f) => ({ ...f, project_id: projectId, tenant_id: tenantId }))
        if (rows.length > 0) await sb.from('feature_registry').insert(rows)
      }
      if (extractedItems.services && Array.isArray(extractedItems.services)) {
        const rows = (extractedItems.services as Record<string, unknown>[]).map((s) => ({ ...s, project_id: projectId, tenant_id: tenantId }))
        if (rows.length > 0) await sb.from('service_registry').insert(rows)
      }
      if (extractedItems.apis && Array.isArray(extractedItems.apis)) {
        const rows = (extractedItems.apis as Record<string, unknown>[]).map((a) => ({ ...a, project_id: projectId, tenant_id: tenantId }))
        if (rows.length > 0) await sb.from('api_registry').insert(rows)
      }
      if (extractedItems.journey) {
        const j = extractedItems.journey as Record<string, unknown>
        await sb.from('journey_registry').insert({ ...j, project_id: projectId, tenant_id: tenantId })
      }
    }

    // Generate AI summary
    summary = await askModel({
      system: 'You are a technical documentation analyst. Summarise the provided content in 2-3 concise sentences, focusing on the key architectural or business insights an AI monitoring system would need.',
      prompt: `Title: ${title}\n\n${content.slice(0, 3000)}`,
      maxTokens: 300,
    })

    // Update document with AI summary and mark as processed
    if (documentId) {
      await sb.from('knowledge_documents').update({ ai_summary: summary, ai_processed: true }).eq('id', documentId)
    }

    return new Response(JSON.stringify({ summary, extracted: extractedItems }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
