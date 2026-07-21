'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { assistantSuggestions } from '@/lib/data'
import { Sparkles, X, ArrowUp, Bot } from 'lucide-react'

type Msg = { role: 'user' | 'ai'; text: string }

const cannedAnswer =
  'Your biggest issue right now is **INC-1042 — document upload failures**. Storage upload success dropped from 98% to 62% immediately after deploy #1482, which reduced the upload timeout while adding a synchronous virus-scan step. This is blocking onboarding for ~1,380 users and puts an estimated $12.4k MRR at risk. I recommend rolling back deploy #1482 — I have a fix drafted and ready for your approval.'

export function AIAssistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: 'Good afternoon. I have been monitoring the platform. There is 1 critical incident and 2 active investigations. Ask me anything about system health, incidents, users or deployments.' },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  function send(text: string) {
    const q = text.trim()
    if (!q) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setThinking(true)
    timerRef.current = setTimeout(() => {
      setThinking(false)
      setMessages((m) => [...m, { role: 'ai', text: cannedAnswer }])
    }, 1100)
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border/70 bg-sidebar transition-transform duration-300 sm:w-96',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ai/15 text-ai">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="leading-none">
            <p className="text-sm font-semibold text-foreground">AI Assistant</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-dot" /> Online · 96% confidence
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Close assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
            {m.role === 'ai' && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai/15 text-ai">
                <Bot className="h-3.5 w-3.5" />
              </span>
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-intel text-primary-foreground'
                  : 'border border-border/60 bg-card text-card-foreground',
              )}
            >
              {renderText(m.text)}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai/15 text-ai">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-3">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse-dot"
                  style={{ animationDelay: `${d * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="border-t border-border/60 px-4 py-3">
        <div className="scrollbar-thin mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {assistantSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="shrink-0 rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-ai/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 focus-within:border-ai/40"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Ask the AI anything…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai text-ai-foreground disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  )
}

function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  )
}
