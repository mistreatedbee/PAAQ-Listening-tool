import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'

const VALID_MODES = new Set(['advisory', 'assisted', 'team', 'autonomous'])

// Read: any tenant member can see the current policy.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId } = body
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const cookieStore = await cookies()
  const sb = createClient(cookieStore)
  const { data } = await sb.from('tenant_projects').select('approval_mode').eq('id', projectId).maybeSingle()
  return NextResponse.json({ mode: data?.approval_mode ?? 'team' })
}

// Write: same owner/admin trust boundary as merging a fix — this setting
// controls whether AI fixes can merge to production at all.
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId, mode } = body
  if (!projectId || !VALID_MODES.has(mode)) {
    return NextResponse.json({ error: 'projectId and a valid mode are required' }, { status: 400 })
  }

  const role = await getCurrentTenantRole(projectId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Only owners/admins can change the approval policy' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const sb = createClient(cookieStore)
  const { error } = await sb.from('tenant_projects').update({ approval_mode: mode }).eq('id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mode })
}
