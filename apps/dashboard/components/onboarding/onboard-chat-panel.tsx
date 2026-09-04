'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { Bot, User, Wrench, ArrowUp, Loader2 } from 'lucide-react'
import { GitProviderButtons } from '@/components/connect/git-provider-buttons'
import {
  findPendingUserInput,
  sanitizeAssistantText,
  toolResultLabel,
  inferToolLabelFromAssistantText,
  type AskUser,
} from '@/lib/onboarding-chat'
import type { GitProviderId } from '@/lib/repo-providers'

type RunStatus = 'running' | 'awaiting_input' | 'succeeded' | 'failed' | 'cancelled'

type MessageRow = {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: unknown
  created_at: string
}

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

export function OnboardChatPanel({
  runId,
  projectId,
  status,
  currentStep,
}: {
  runId: string
  projectId: string
  status: RunStatus
  currentStep?: string | null
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

  let askUser: AskUser | null = findPendingUserInput(messages)
  const needsGitConnect = status === 'awaiting_input' && currentStep === 'connect_repository' && !askUser
  if (needsGitConnect) {
    askUser = {
      question: 'Connect your git account so the agent can find your repository and open an SDK integration PR.',
      kind: 'choose_provider',
    }
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

  const returnTo = `/connect/${runId}`

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/70 bg-sidebar overflow-hidden">
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

      <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          messages.map((m) => {
            if (m.role === 'tool') {
              const label = toolResultLabel(m.content) ?? 'Completed a step'
              return (
                <div key={m.id} className="flex items-center gap-2 pl-9 text-[11px] text-muted-foreground/70">
                  <Wrench className="h-3 w-3 shrink-0" />
                  {label}
                </div>
              )
            }
            const raw = textOf(m.content)
            const text = raw ? sanitizeAssistantText(raw) : null
            const inferredTool = !text && raw ? inferToolLabelFromAssistantText(raw) : null
            if (!text && !inferredTool) return null
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
                  {text ?? inferredTool}
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

      {status === 'awaiting_input' && askUser && (
        <div className="border-t border-border/60 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-foreground">{askUser.question}</p>

          {askUser.kind === 'choose_provider' && projectId && (
            <GitProviderButtons
              projectId={projectId}
              returnTo={returnTo}
              options={askUser.options as GitProviderId[] | undefined}
            />
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
                placeholder={askUser.kind === 'paste_connection_string' ? 'postgres://user:pass@host:5432/dbname' : 'Type your answer…'}
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
