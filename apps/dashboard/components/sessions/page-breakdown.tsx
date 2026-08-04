import { Card, CardHead } from '@/components/kit'
import { FileStack } from 'lucide-react'

export type SessionPage = {
  id: string
  sequence: number
  page_path: string
  entered_at: string
  exited_at: string | null
  duration_ms: number | null
  interaction_count: number
  error_count: number
}

function fmtDuration(ms: number | null) {
  if (ms == null) return 'Still open'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function PageBreakdown({ pages }: { pages: SessionPage[] }) {
  return (
    <Card>
      <CardHead title="Page-by-page breakdown" desc="Every page/screen visited, in order" icon={<FileStack className="h-4 w-4" />} />
      {pages.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No page visits captured yet.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {pages.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{p.sequence}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{p.page_path}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(p.entered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {fmtDuration(p.duration_ms)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                <span>{p.interaction_count} clicks</span>
                <span className={p.error_count > 0 ? 'font-medium text-critical' : ''}>{p.error_count} errors</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
