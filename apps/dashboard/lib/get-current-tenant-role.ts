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
    .select('role')
    .eq('tenant_id', project.tenant_id)
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .single()

  return (membership?.role as TenantRole) ?? null
}
