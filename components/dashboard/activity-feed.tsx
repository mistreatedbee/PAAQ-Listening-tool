'use client'

import { useState } from 'react'
import { activityFeed, activityCategories } from '@/lib/data'
import { Card, CardHead } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneBg, toneText } from '@/lib/tones'
import { Radio } from 'lucide-react'

export function ActivityFeed() {
  const [filter, setFilter] = useState('All')
  const items = filter === 'All' ? activityFeed : activityFeed.filter((e) => e.category === filter)

  return (
    <Card className="flex h-full flex-col">
      <CardHead
        title="Real-Time Activity"
        desc="Everything happening across the ecosystem"
        icon={<Radio className="h-4 w-4" />}
        action={
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-healthy">
            <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-dot" /> Live
          </span>
        }
      />
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto px-5 pb-3">
        {activityCategories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              filter === c
                ? 'border-intel/40 bg-intel/15 text-intel'
                : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground',
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
        <ul>
          {items.map((e) => (
            <li key={e.id} className="animate-rise">
              <div className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/40">
                <div className="flex flex-col items-center">
                  <span className={cn('mt-1.5 h-2 w-2 rounded-full', toneBg[e.severity])} />
                  <span className="mt-1 w-px flex-1 bg-border/60" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm font-medium', toneText[e.severity])}>{e.title}</p>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{e.time}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.meta}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
