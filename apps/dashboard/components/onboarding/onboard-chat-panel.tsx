'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { Bot, User, Wrench, ArrowUp, Loader2 } from 'lucide-react'
import { SiGithub, SiGitlab, SiBitbucket } from 'react-icons/si'
import { CloudCog } from 'lucide-react'

type RunStatus = 'running' | 'awaiting_input' | 'succeeded' | 'failed' | 'cancelled'

type MessageRow = {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: unknown
  created_at: string
}

// Shape the onboard-agent uses when it needs something from the user —
// surfaced inside a role:'tool' row's content. Not formally typed on the
// DB side (content is jsonb), so this is deliberately loose/defensive.
type AskUser = {
  question: string
  kind: 'text' | 'confirm' | 'choose_provider' | 'paste_connection_string'
  options?: string[]
}

// onboard-agent (apps/api/supabase/functions/onboard-agent/index.ts) always
// stores message content as a content-block array (even a
// single text turn is `[{type:'text', text}]`) — assistant/user rows are
// arrays of {type:'text', text} blocks; tool rows are arrays of
// {type:'tool_result', tool_use_id, content: '<JSON-encoded tool output>'}.
function textOf(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const texts = content
      .filter((b): b is { type: string; text: string } => !!b && typeof b === 'object' && typeof (b as Record<string, unknown>).text === 'string')
      .map((b) => b.text)
    return texts.length ? texts.join('\n') : null
  }
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>
    if (typeof c.text === 'string') return c.text
    if (typeof c.message === 'string') return c.message
  }
  return null
}

// Searches a role:'tool' row's content-block array for an ask_user tool's
// result — each block's own `content` field is the JSON-encoded string of
// whatever the tool handler returned (see dispatchTool/appendMessage in
// onboard-agent), so it has to be parsed before its shape can be checked.
function findAskUser(content: unknown): AskUser | null {
  if (!Array.isArray(content)) return null
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const raw = (block as Record<string, unknown>).content
    if (typeof raw !== 'string') continue
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { continue }
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>
      if (typeof p.question === 'string' && typeof p.kind === 'string') return p as unknown as AskUser
    }
  }
  return null
}

const PROVIDER_ICONS: Record<string, typeof SiGithub> = {
  github: SiGithub,
  gitlab: SiGitlab,
  bitbucket: SiBitbucket,
}

export function OnboardChatPanel({
  runId,
  projectId,
  status,
}: {
  runId: string
  projectId: string
  status: RunStatus
}) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const sb = createClient()

    async function load() {
      const { data } = await sb
        .from('onboarding_run_messages')
        .select('id, role, content, created_at')
        .eq('run_id', runId)
        .order('created_at', { ascending: true })
      if (!cancelled) {
        setMessages((data ?? []) as MessageRow[])
        setLoading(false)
      }
    }

    load()

    const channel = sb
      .channel(`onboarding-messages:${runId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onboarding_run_messages', filter: `run_id=eq.${runId}` }, () => { if (!cancelled) load() })
      .subscribe()

    const timer = setInterval(() => { if (!cancelled) load() }, 5_000)

    return () => {
      cancelled = true
      clearInterval(timer)
      sb.removeChannel(channel)
    }
  }, [runId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status])

  // Find the most recent ask_user payload — checked across the tail of
  // messages since it may arrive as a tool row alongside/after the
  // assistant's text explaining the question.
  let askUser: AskUser | null = null
  for (let i = messages.length - 1; i >= 0 && !askUser; i--) {
    if (messages[i].role === 'tool') askUser = findAskUser(messages[i].content)
  }

  async function submitAnswer(value: string) {
    if (submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'provide_input', runId, answer: value }),
      })
      setAnswer('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/70 bg-sidebar overflow-hidden">
      {/* Header */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border/60 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ai/15 text-ai">
          <Bot className="h-4 w-4" />
        </span>
        <div className="leading-none">
          <p className="text-sm font-semibold text-foreground">Onboarding Agent</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === 'running' ? 'bg-ai animate-pulse-dot' : status === 'failed' ? 'bg-critical' : status === 'succeeded' ? 'bg-healthy' : 'bg-warning animate-pulse-dot',
            )} />
            {status === 'running' ? 'Working' : status === 'awaiting_input' ? 'Needs your input' : status === 'succeeded' ? 'Done' : status === 'failed' ? 'Failed' : 'Cancelled'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          messages.map((m) => {
            if (m.role === 'tool') {
              // Raw tool_use/tool_result JSON isn't meant for direct display —
              // just a subtle one-line indicator that something ran.
              return (
                <div key={m.id} className="flex items-center gap-2 pl-9 text-[11px] text-muted-foreground/70">
                  <Wrench className="h-3 w-3" />
                  used a tool
                </div>
              )
            }
            const text = textOf(m.content) ?? JSON.stringify(m.content)
            return (
              <div key={m.id} className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                <span className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  m.role === 'user' ? 'bg-intel/15 text-intel' : 'bg-ai/15 text-ai',
                )}>
                  {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </span>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'bg-intel text-primary-foreground'
                    : 'border border-border/60 bg-card text-card-foreground',
                )}>
                  {text}
                </div>
              </div>
            )
          })
        )}

        {status === 'running' && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai/15 text-ai">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-3">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse-dot" style={{ animationDelay: `${d * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {status === 'succeeded' && (
          <div className="rounded-xl border border-healthy/30 bg-healthy/8 px-4 py-3 text-sm font-semibold text-healthy">
            All connected! Redirecting…
          </div>
        )}
      </div>

      {/* Input affordance */}
      {status === 'awaiting_input' && askUser && (
        <div className="border-t border-border/60 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-foreground">{askUser.question}</p>

          {askUser.kind === 'choose_provider' && (
            <div className="flex flex-wrap gap-2">
              {(askUser.options ?? ['github', 'gitlab', 'azure', 'bitbucket']).map((p) => {
                const Icon = PROVIDER_ICONS[p] ?? CloudCog
                return (
                  <a
                    key={p}
                    href={`/api/auth/${p}?project_id=${projectId}&returnTo=${encodeURIComponent(`/connect/${runId}`)}`}
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-ai/40 hover:bg-ai/5"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {p[0].toUpperCase() + p.slice(1)}
                  </a>
                )
              })}
            </div>
          )}

          {askUser.kind === 'confirm' && (
            <div className="flex gap-2">
              <button
                onClick={() => submitAnswer('true')}
                disabled={submitting}
                className="rounded-lg bg-ai px-3 py-1.5 text-xs font-semibold text-ai-foreground disabled:opacity-40"
              >
                Yes
              </button>
              <button
                onClick={() => submitAnswer('false')}
                disabled={submitting}
                className="rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-40"
              >
                No
              </button>
            </div>
          )}

          {(askUser.kind === 'text' || askUser.kind === 'paste_connection_string') && (
            <form
              onSubmit={(e) => { e.preventDefault(); submitAnswer(answer) }}
              className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 focus-within:border-ai/40"
            >
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={askUser.kind === 'paste_connection_string' ? 'postgres://…' : 'Type your answer…'}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!answer.trim() || submitting}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai text-ai-foreground disabled:opacity-40"
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
