import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export type TenantRole = 'owner' | 'admin' | 'developer' | 'product_manager' | 'viewer'

/**
 * Server-side, session-based role resolution for the current user within
 * the tenant that owns the given project. Returns null if there's no
 * signed-in user, or the user isn't a member of that tenant.
 *
 * This is the first real role check in this dashboard — until now,
 * tenant_users.role existed in the schema but nothing read or enforced it.
 */
export async function getCurrentTenantRole(projectId: string): Promise<TenantRole | null> {
  const cookieStore = await cookies()
  const sb = createClient(cookieStore)

  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const { data: project } = await sb
    .from('tenant_projects')
    .select('tenant_id')
    .eq('id', projectId)
    .single()
  if (!project) return null

  const { data: membership } = await sb
    .from('tenant_users')
    .select('role, status')
    .eq('tenant_id', project.tenant_id)
    .eq('auth_user_id', user.id)
    .neq('status', 'removed')
    .neq('status', 'suspended')
    .single()

  // Auto-activate users whose auth_user_id is set — they've signed in,
  // so 'invited' is stale. Do it fire-and-forget, don't block the request.
  if (membership?.status === 'invited') {
    sb.from('tenant_users')
      .update({ status: 'active' })
      .eq('auth_user_id', user.id)
      .eq('tenant_id', project.tenant_id)
      .then(() => {})
  }

  return (membership?.role as TenantRole) ?? null
}
