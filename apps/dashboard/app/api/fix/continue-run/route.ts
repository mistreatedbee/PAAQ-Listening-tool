import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'
import { callInternalEdgeFunction } from '@/lib/internal-edge-call'

const ALLOWED_ROLES = new Set(['owner', 'admin', 'developer', 'product_manager'])

/** Executes exactly one step of an already-approved, running plan. The
 * dashboard calls this repeatedly until `done` comes back true — a real
 * multi-step plan doing this all in a single request reliably exceeded the
 * edge function's execution limit and left runs stuck 'running' forever
 * with nothing visible to the user. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId, recommendationId, runId } = body
  if (!projectId || !recommendationId || !runId) {
    return NextResponse.json({ ok: false, error: 'projectId, recommendationId and runId are required' }, { status: 400 })
  }

  const role = await getCurrentTenantRole(projectId)
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }

  const result = await callInternalEdgeFunction('execute-fix', { action: 'continue_run', recommendationId, runId })
  return NextResponse.json(result)
}
