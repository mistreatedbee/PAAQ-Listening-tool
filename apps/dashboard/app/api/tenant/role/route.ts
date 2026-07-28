import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantRole } from '@/lib/get-current-tenant-role'

// Lets the client know what it's allowed to render (e.g. show/hide the
// "Approve & Merge" button) — the server-side routes are the real
// enforcement boundary regardless of what this returns.
export async function POST(request: NextRequest) {
  const { projectId } = await request.json().catch(() => ({}))
  if (!projectId) return NextResponse.json({ role: null }, { status: 400 })
  const role = await getCurrentTenantRole(projectId)
  return NextResponse.json({ role })
}
