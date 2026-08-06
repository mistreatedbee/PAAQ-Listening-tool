import { Card, CardHead } from '@/components/kit'
import { FileStack, ChevronDown } from 'lucide-react'

export type SessionPage = {
  id: string
  sequence: number
  page_path: string
  entered_at: string
  exited_at: string | null
  duration_ms: number | null
  interaction_count: number
  error_count: number
  scroll_depth_pct: number | null
}

export type PageError = {
  id: string
  error_type: string
  message: string
  screen: string | null
  created_at: string
}

function fmtDuration(ms: number | null) {
  if (ms == null) return 'Still open'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// Same page_path + time-window match used server-side in
// _shared/session-pages.ts's recordErrorsOnPages, so the errors shown here
// line up with the error_count the backend actually attributed to this page.
function errorsForPage(page: SessionPage, errors: PageError[]): PageError[] {
  const enteredMs = new Date(page.entered_at).getTime()
  const exitedMs = page.exited_at ? new Date(page.exited_at).getTime() : Infinity
  return errors.filter((e) => {
    if (e.screen !== page.page_path) return false
    const t = new Date(e.created_at).getTime()
    return t >= enteredMs && t < exitedMs
  })
}

export function PageBreakdown({ pages, errors = [] }: { pages: SessionPage[]; errors?: PageError[] }) {
  return (
    <Card>
      <CardHead title="Page-by-page breakdown" desc="Every page/screen visited, in order" icon={<FileStack className="h-4 w-4" />} />
      {pages.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No page visits captured yet.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {pages.map((p) => {
            const pageErrors = p.error_count > 0 ? errorsForPage(p, errors) : []
            return (
              <div key={p.id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{p.sequence}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.page_path}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(p.entered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {fmtDuration(p.duration_ms)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                    <span>{p.interaction_count} clicks</span>
                    <span>{p.scroll_depth_pct != null ? `${p.scroll_depth_pct}% scrolled` : '— scroll'}</span>
                    <span className={p.error_count > 0 ? 'font-medium text-critical' : ''}>{p.error_count} errors</span>
                  </div>
                </div>

                {pageErrors.length > 0 && (
                  <details className="mt-2 ml-8">
                    <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-critical hover:underline">
                      <ChevronDown className="h-3 w-3" />
                      What went wrong on this page
                    </summary>
                    <ul className="mt-1.5 space-y-1">
                      {pageErrors.map((e) => (
                        <li key={e.id} className="rounded-md border border-critical/20 bg-critical/5 px-2.5 py-1.5 text-[11px]">
                          <span className="font-medium text-foreground">{e.error_type}</span>
                          <span className="ml-1.5 font-mono text-muted-foreground">{e.message}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
