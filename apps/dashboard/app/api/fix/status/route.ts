import { NextRequest, NextResponse } from 'next/server'
import { callInternalEdgeFunction } from '@/lib/internal-edge-call'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { recommendationId } = body
  if (!recommendationId) {
    return NextResponse.json({ ok: false, error: 'recommendationId is required' }, { status: 400 })
  }
  const result = await callInternalEdgeFunction('execute-fix', { action: 'status', recommendationId })
  return NextResponse.json(result)
}
