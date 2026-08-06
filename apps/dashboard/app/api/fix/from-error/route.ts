import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'

const ALLOWED_ROLES = new Set(['owner', 'admin', 'developer', 'product_manager'])

/**
 * Turns an error into a real, traceable recommendation row — the same
 * construct the real AI-fix pipeline (fix_runs / execute-fix) already
 * operates on for the Recommendations page — so "Generate Fix" on the
 * Errors page can drive the identical real branch/PR/approve-merge flow
 * instead of a one-off text explanation. Idempotent: reuses an existing
 * recommendation for this error if one was already created.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { projectId, errorId } = body
  if (!projectId || !errorId) {
    return NextResponse.json({ ok: false, error: 'projectId and errorId are required' }, { status: 400 })
  }

  const role = await getCurrentTenantRole(projectId)
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const sb = createClient(cookieStore)

  const { data: existing } = await sb
    .from('recommendations')
    .select('id, title, status')
    .eq('error_id', errorId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: true, recommendationId: existing.id, title: existing.title, reused: true })
  }

  const { data: errRow } = await sb
    .from('errors')
    .select('id, error_type, message, stack_trace, screen, severity')
    .eq('id', errorId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!errRow) return NextResponse.json({ ok: false, error: 'Error not found' }, { status: 404 })

  const priority = errRow.severity === 'fatal' || errRow.severity === 'error' ? 'high' : 'medium'
  const title = `Fix: ${errRow.error_type}${errRow.screen ? ` on ${errRow.screen}` : ''}`
  const description = [
    errRow.message,
    errRow.screen ? `Screen: ${errRow.screen}` : null,
    errRow.stack_trace ? `Stack trace:\n${errRow.stack_trace.slice(0, 2000)}` : null,
  ].filter(Boolean).join('\n\n')

  const { data: created, error: insertError } = await sb
    .from('recommendations')
    .insert({
      project_id: projectId,
      error_id: errorId,
      type: 'error_fix',
      title,
      description,
      priority,
      status: 'pending',
    })
    .select('id, title')
    .single()

  if (insertError || !created) {
    return NextResponse.json({ ok: false, error: insertError?.message ?? 'Failed to create recommendation' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recommendationId: created.id, title: created.title, reused: false })
}
