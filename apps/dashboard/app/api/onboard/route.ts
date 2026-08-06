import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'
import { callInternalEdgeFunction } from '@/lib/internal-edge-call'

// Same trust boundary as /api/repo/*: session-checked here, then forwarded
// to onboard-agent with the internal shared secret. onboard-agent itself
// never trusts a browser directly — it touches repo tokens and potentially
// DB secrets read out of a customer's repo.
const ALLOWED_ROLES = new Set(['owner', 'admin', 'developer', 'product_manager'])

const ALLOWED_ACTIONS = new Set(['start', 'continue', 'provide_input', 'cancel'])

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const action = body.action as string
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 })
  }

  // 'start' takes a projectId directly from the client (new run); everything
  // else takes a runId and looks the project up server-side so a caller can't
  // spoof which project a run belongs to.
  let projectId: string | undefined = body.projectId

  const cookieStore = await cookies()
  const sb = createClient(cookieStore)
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  if (action !== 'start') {
    const runId = body.runId as string
    if (!runId) return NextResponse.json({ ok: false, error: 'runId is required' }, { status: 400 })
    const { data: run } = await sb.from('onboarding_runs').select('project_id').eq('id', runId).maybeSingle()
    if (!run) return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 })
    projectId = run.project_id
  }

  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 })

  const role = await getCurrentTenantRole(projectId)
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }

  if (action === 'start') {
    const { data: project } = await sb.from('tenant_projects').select('tenant_id').eq('id', projectId).single()
    if (!project) return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 })

    const result = await callInternalEdgeFunction('onboard-agent', {
      action: 'start',
      tenant_id: project.tenant_id,
      project_id: projectId,
      created_by: user.id,
      prompt: body.prompt,
    })
    return NextResponse.json(result)
  }

  if (action === 'continue') {
    const result = await callInternalEdgeFunction('onboard-agent', { action: 'continue', run_id: body.runId })
    return NextResponse.json(result)
  }

  if (action === 'provide_input') {
    const result = await callInternalEdgeFunction('onboard-agent', { action: 'provide_input', run_id: body.runId, answer: body.answer })
    return NextResponse.json(result)
  }

  // cancel
  const result = await callInternalEdgeFunction('onboard-agent', { action: 'cancel', run_id: body.runId })
  return NextResponse.json(result)
}
