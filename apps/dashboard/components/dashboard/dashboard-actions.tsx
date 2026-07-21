'use client'

import { Download, Zap } from 'lucide-react'

export function DashboardActions() {
  return (
    <>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
      >
        <Download className="h-4 w-4" /> Export
      </button>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-assistant'))}
        className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90"
      >
        <Zap className="h-4 w-4" /> Ask AI
      </button>
    </>
  )
}
