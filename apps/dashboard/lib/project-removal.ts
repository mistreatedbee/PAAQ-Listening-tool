import type { TenantRole } from '@/lib/get-current-tenant-role'

const REMOVE_ROLES = new Set<TenantRole>(['owner', 'admin'])

export function canRemoveProject(role: TenantRole | null | undefined): boolean {
  return !!role && REMOVE_ROLES.has(role)
}
