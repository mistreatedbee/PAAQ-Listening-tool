import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function gen(prefix: string, len = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return prefix + Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    + '-' + Math.random().toString(36).slice(2, 6)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session', detail: authError?.message }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { companyName, workspaceName, projectName, platform, environment, industry, teamSize, country, website } = body

    if (!companyName?.trim() || !projectName?.trim() || !platform) {
      return new Response(JSON.stringify({ error: 'companyName, projectName, and platform are required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Check if user already has a tenant
    const { data: existing } = await sb
      .from('tenant_users')
      .select('tenant_id')
      .eq('auth_user_id', user.id)
      .limit(1)
      .maybeSingle()

    let tenantId: string

    if (existing?.tenant_id) {
      tenantId = existing.tenant_id
    } else {
      // Create organization (tenant)
      const { data: tenant, error: tenantErr } = await sb.from('tenants').insert({
        company_name: companyName.trim(),
        slug: slugify(companyName),
        website: website?.trim() || null,
        industry: industry?.trim() || null,
        status: 'trial',
        subscription_plan: 'starter',
      }).select().single()

      if (tenantErr || !tenant) {
        return new Response(JSON.stringify({ error: 'Failed to create organization', detail: tenantErr?.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      tenantId = tenant.id

      // Add user as admin member
      await sb.from('tenant_users').insert({
        tenant_id: tenantId,
        auth_user_id: user.id,
        email: user.email,
        role: 'admin',
      })
    }

    // Create workspace
    const wsName = workspaceName?.trim() || `${companyName.trim()} Workspace`
    const { data: workspace, error: wsErr } = await sb.from('workspaces').insert({
      tenant_id: tenantId,
      name: wsName,
      status: 'active',
    }).select().single()

    if (wsErr || !workspace) {
      return new Response(JSON.stringify({ error: 'Failed to create workspace', detail: wsErr?.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Create project linked to workspace
    const projectKey = 'proj_' + Math.random().toString(36).slice(2, 10)
    const { data: project, error: projErr } = await sb.from('tenant_projects').insert({
      tenant_id: tenantId,
      workspace_id: workspace.id,
      name: projectName.trim(),
      platform,
      environment: environment ?? 'production',
      project_id_key: projectKey,
      status: 'active',
    }).select().single()

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: 'Failed to create project', detail: projErr?.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Generate SDK credentials
    const rows = [
      { token_type: 'sdk_token',      prefix: 'sdk_live_' },
      { token_type: 'public_key',     prefix: 'pk_live_' },
      { token_type: 'secret_key',     prefix: 'sk_live_' },
      { token_type: 'webhook_secret', prefix: 'whsec_' },
    ].map(({ token_type, prefix }) => {
      const t = gen(prefix)
      return { tenant_id: tenantId, project_id: project.id, token_type, token: t, token_hint: t.slice(-4), status: 'active' }
    })

    await sb.from('access_tokens').insert(rows)

    return new Response(JSON.stringify({
      tenantId,
      workspace: { id: workspace.id, name: workspace.name },
      project,
      tokens: {
        sdkToken:      rows[0].token,
        publicKey:     rows[1].token,
        secretKey:     rows[2].token,
        webhookSecret: rows[3].token,
      },
      isNew: !existing?.tenant_id,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
