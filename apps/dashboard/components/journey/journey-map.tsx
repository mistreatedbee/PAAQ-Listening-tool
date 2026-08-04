import { ArrowRight, LogOut, Map } from 'lucide-react'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'

export type JourneyMapNode = {
  path: string
  sessions: number
  pctOfTotal: number
  dropOffs: number
  dropOffPct: number
}

export type JourneyMapEdge = {
  from: string
  to: string
  count: number
}

export function JourneyMap({ nodes, edges }: { nodes: JourneyMapNode[]; edges: JourneyMapEdge[] }) {
  if (nodes.length === 0) {
    return (
      <Card>
        <CardHead icon={<Map className="h-4 w-4" />} title="Visual Journey Map" desc="Real page-to-page traffic and drop-off, computed from captured sessions." />
        <div className="px-5 pb-5 text-sm text-muted-foreground">No page-level session data for this range yet.</div>
      </Card>
    )
  }

  const maxSessions = Math.max(...nodes.map((n) => n.sessions))

  return (
    <Card>
      <CardHead icon={<Map className="h-4 w-4" />} title="Visual Journey Map" desc="Traffic and drop-off per page, ranked by session volume — every number here comes from real captured sessions." />
      <div className="space-y-1.5 px-5 pb-4">
        {nodes.map((n) => {
          const widthPct = Math.max(4, (n.sessions / maxSessions) * 100)
          const dropTone = n.dropOffPct >= 40 ? 'critical' : n.dropOffPct >= 15 ? 'warning' : 'healthy'
          return (
            <div key={n.path} className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-mono text-xs text-foreground">{n.path}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{n.sessions} sessions · {n.pctOfTotal}%</span>
                  {n.dropOffs > 0 && (
                    <ToneBadge tone={dropTone} dot>
                      <LogOut className="h-2.5 w-2.5" /> {n.dropOffPct}% drop-off
                    </ToneBadge>
                  )}
                </div>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-intel" style={{ width: `${widthPct}%`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )
        })}
      </div>

      {edges.length > 0 && (
        <div className="border-t border-border/60 px-5 py-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top transitions</p>
          <div className="flex flex-wrap gap-1.5">
            {edges.slice(0, 12).map((e, i) => (
              <div
                key={`${e.from}-${e.to}-${i}`}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground',
                )}
              >
                <span className="max-w-[10rem] truncate font-mono text-foreground">{e.from}</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span className="max-w-[10rem] truncate font-mono text-foreground">{e.to}</span>
                <span className="shrink-0 text-muted-foreground/70">×{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
