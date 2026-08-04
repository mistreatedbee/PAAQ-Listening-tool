import { Card, CardHead } from '@/components/kit'
import { Map } from 'lucide-react'
import type { SessionPage } from './page-breakdown'

export function NavigationMap({ pages }: { pages: SessionPage[] }) {
  return (
    <Card>
      <CardHead title="Navigation map" desc="The real path taken through the app" icon={<Map className="h-4 w-4" />} />
      {pages.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No navigation captured yet.</p>
      ) : (
        <div className="space-y-2 px-5 pb-5">
          {pages.map((p, i) => {
            const width = Math.max(30, 100 - (i / Math.max(1, pages.length)) * 50)
            const isLast = i === pages.length - 1
            return (
              <div key={p.id} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{p.sequence}</span>
                <div className="flex-1">
                  <div
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isLast && p.exited_at == null
                        ? 'border border-warning/30 bg-warning/10 text-warning'
                        : i === 0
                        ? 'border border-ai/20 bg-ai/10 text-foreground'
                        : 'border border-border/50 bg-card/80 text-foreground'
                    }`}
                    style={{ width: `${width}%`, minWidth: '40%' }}
                  >
                    {p.page_path}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
