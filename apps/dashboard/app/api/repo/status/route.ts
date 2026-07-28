import { NextRequest, NextResponse } from 'next/server'
import { callInternalEdgeFunction } from '@/lib/internal-edge-call'

// Read-only status check — no role gate needed, matches db-connector's status action.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId, provider } = body
  if (!projectId || !provider) {
    return NextResponse.json({ ok: false, error: 'projectId and provider are required' }, { status: 400 })
  }
  const result = await callInternalEdgeFunction('repo-connector', { action: 'status', project_id: projectId, provider })
  return NextResponse.json(result)
}
