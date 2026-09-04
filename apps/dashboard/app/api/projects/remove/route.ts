import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'
import { canRemoveProject } from '@/lib/project-removal'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId } = body as { projectId?: string }

  if (!projectId) {
    return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 })
  }

  const role = await getCurrentTenantRole(projectId)
  if (!canRemoveProject(role)) {
    return NextResponse.json(
      { ok: false, error: 'Only owners and admins can remove an application' },
      { status: 403 },
    )
  }

  const cookieStore = await cookies()
  const sb = createClient(cookieStore)

  const { data: project, error: fetchError } = await sb
    .from('tenant_projects')
    .select('id, status')
    .eq('id', projectId)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 })
  }
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Application not found' }, { status: 404 })
  }
  if (project.status === 'archived') {
    return NextResponse.json({ ok: false, error: 'Application is already removed' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { error: tokenError } = await sb
    .from('access_tokens')
    .update({ status: 'revoked', updated_at: now })
    .eq('project_id', projectId)
    .eq('status', 'active')

  if (tokenError) {
    return NextResponse.json({ ok: false, error: tokenError.message }, { status: 500 })
  }

  const { error: projectError } = await sb
    .from('tenant_projects')
    .update({ status: 'archived', updated_at: now })
    .eq('id', projectId)

  if (projectError) {
    return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
