import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type SdkAuthResult =
  | { ok: true; tenantId: string; projectId: string; projectKey: string }
  | { ok: false; status: number; error: string }

/**
 * Shared SDK-token auth gate — identical validation logic used by
 * sdk-init/index.ts and users/index.ts (kept in sync manually there;
 * new callers should use this instead of re-duplicating it).
 */
export async function verifySdkAuth(req: Request, sb: SupabaseClient): Promise<SdkAuthResult> {
  const sdkToken   = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  const projectKey = req.headers.get('x-project-id') ?? ''

  if (!sdkToken) return { ok: false, status: 401, error: 'Missing Authorization header' }
  if (!sdkToken.startsWith('sdk_live_') && !sdkToken.startsWith('sdk_test_')) {
    return { ok: false, status: 401, error: 'Invalid SDK token format' }
  }

  const { data: tokenRow } = await sb
    .from('access_tokens')
    .select('tenant_id, status, rotation_expires_at')
    .eq('token', sdkToken)
    .eq('token_type', 'sdk_token')
    .in('status', ['active', 'rotating'])
    .single()

  if (!tokenRow) return { ok: false, status: 401, error: 'Invalid SDK token' }

  if (tokenRow.status === 'rotating' && tokenRow.rotation_expires_at) {
    if (new Date() > new Date(tokenRow.rotation_expires_at)) {
      return { ok: false, status: 401, error: 'SDK token has been rotated — please update to the new token' }
    }
  }

  const { data: project } = await sb
    .from('tenant_projects')
    .select('id, status')
    .eq('project_id_key', projectKey)
    .eq('tenant_id', tokenRow.tenant_id)
    .single()

  if (!project) return { ok: false, status: 401, error: 'Project not found or does not belong to this token' }
  if (project.status !== 'active') return { ok: false, status: 403, error: `Project is ${project.status}` }

  return { ok: true, tenantId: tokenRow.tenant_id, projectId: project.id, projectKey }
}
