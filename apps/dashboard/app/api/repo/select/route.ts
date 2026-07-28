import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'
import { callInternalEdgeFunction } from '@/lib/internal-edge-call'

const ALLOWED_ROLES = new Set(['owner', 'admin', 'developer', 'product_manager'])

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId, provider, repo } = body
  if (!projectId || !provider || !repo?.fullName) {
    return NextResponse.json({ ok: false, error: 'projectId, provider, and repo are required' }, { status: 400 })
  }

  const role = await getCurrentTenantRole(projectId)
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }

  const result = await callInternalEdgeFunction('repo-connector', { action: 'select_repo', project_id: projectId, provider, repo })
  return NextResponse.json(result)
}
