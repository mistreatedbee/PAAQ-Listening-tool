import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'
import { callInternalEdgeFunction } from '@/lib/internal-edge-call'

const ALLOWED_ROLES = new Set(['owner', 'admin', 'developer', 'product_manager'])

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId, recommendationId, filePath } = body
  if (!projectId || !recommendationId) {
    return NextResponse.json({ ok: false, error: 'projectId and recommendationId are required' }, { status: 400 })
  }

  const role = await getCurrentTenantRole(projectId)
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }

  const result = await callInternalEdgeFunction('execute-fix', { action: 'start_run', recommendationId, filePath })
  return NextResponse.json(result)
}
