'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'

/**
 * Route-scoped error boundary for a single session's detail page. Without
 * this, a render-time exception anywhere in this page's tree (replay
 * player, timeline, recording modal) unmounts silently in production —
 * looking exactly like "the page just stopped showing data" with no way to
 * tell a real crash apart from a session that genuinely has no data yet.
 * This makes that failure visible and logs the real error to the console
 * with enough context to actually debug it, instead of guessing from a
 * description next time.
 */
export default function SessionDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[session-detail] render crashed:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <AlertTriangle className="h-8 w-8 text-critical" />
      <div>
        <p className="text-sm font-semibold text-foreground">This session's page hit a real error while rendering.</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          {error.message || 'Unknown error'} — logged to the browser console with full details.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
        <Link
          href="/session-replay"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sessions
        </Link>
      </div>
    </div>
  )
}
