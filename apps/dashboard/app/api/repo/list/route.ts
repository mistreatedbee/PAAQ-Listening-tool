import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'
import { callInternalEdgeFunction } from '@/lib/internal-edge-call'

const ALLOWED_ROLES = new Set(['owner', 'admin', 'developer', 'product_manager'])

async function handle(projectId: string, provider: string) {
  if (!projectId || !provider) {
    return NextResponse.json({ ok: false, error: 'projectId/project_id and provider are required' }, { status: 400 })
  }
  const role = await getCurrentTenantRole(projectId)
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }
  const result = await callInternalEdgeFunction('repo-connector', { action: 'list_repos', project_id: projectId, provider })
  return NextResponse.json(result)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id') ?? searchParams.get('projectId') ?? ''
  const provider = searchParams.get('provider') ?? ''
  return handle(projectId, provider)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return handle(body.projectId ?? body.project_id ?? '', body.provider ?? '')
}
