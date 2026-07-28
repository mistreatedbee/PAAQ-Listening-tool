import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'
import { callInternalEdgeFunction } from '@/lib/internal-edge-call'

// This is the trust boundary for real merge-to-main capability — only
// owner/admin can trigger it. Everything else in this feature (generate,
// open a PR) is gated more loosely; this one isn't.
const ALLOWED_ROLES = new Set(['owner', 'admin'])

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId, recommendationId } = body
  if (!projectId || !recommendationId) {
    return NextResponse.json({ ok: false, error: 'projectId and recommendationId are required' }, { status: 400 })
  }

  const role = await getCurrentTenantRole(projectId)
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Only owners/admins can approve and merge a fix' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const sb = createClient(cookieStore)
  const { data: { user } } = await sb.auth.getUser()

  const result = await callInternalEdgeFunction('execute-fix', {
    action: 'merge',
    recommendationId,
    actingUserId: user?.id ?? null,
  })
  return NextResponse.json(result)
}
