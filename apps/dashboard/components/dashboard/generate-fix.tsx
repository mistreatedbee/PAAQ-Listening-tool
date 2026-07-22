'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { Sparkles, Loader2, ChevronDown, ChevronUp, Copy, Check, AlertTriangle, Lightbulb, ShieldCheck, Code2 } from 'lucide-react'

type FixResult = {
  rootCause: string
  fix: string
  codeExample: string | null
  language: string | null
  confidence: number
  affectedArea: string
  prevention: string
  severity: string
}

type ErrorPayload = {
  errorId?: string
  message: string
  errorType?: string | null
  severity?: string | null
  screen?: string | null
  stackTrace?: string | null
  context?: Record<string, unknown> | null
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-healthy' : value >= 55 ? 'bg-warning' : 'bg-critical'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-foreground">{value}%</span>
    </div>
  )
}

function CodeBlock({ code, language }: { code: string; language: string | null }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative rounded-lg border border-border/60 bg-muted/60">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {language ?? 'code'}
        </span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-healthy" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs text-foreground/90 whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

export function GenerateFix({ payload, compact = false }: { payload: ErrorPayload; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<FixResult | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  async function handleGenerate() {
    setState('loading')
    setResult(null)
    setErrMsg(null)
    try {
      const sb = createClient()
      const { data, error } = await sb.functions.invoke('generate-fix', {
        body: {
          errorId: payload.errorId,
          message: payload.message,
          errorType: payload.errorType,
          severity: payload.severity,
          screen: payload.screen,
          stackTrace: payload.stackTrace,
          context: payload.context,
        },
      })
      if (error) throw new Error(error.message)
      if (!data?.ok || !data?.fix) throw new Error(data?.error ?? 'No fix returned')
      setResult(data.fix as FixResult)
      setState('done')
      setExpanded(true)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Unknown error')
      setState('error')
    }
  }

  return (
    <div className="space-y-3">
      {/* Trigger button */}
      {state === 'idle' && (
        <button
          onClick={handleGenerate}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-ai/30 bg-ai/8 px-3.5 py-2 text-sm font-semibold text-ai transition-all hover:bg-ai/15 hover:border-ai/50',
            compact && 'text-xs px-2.5 py-1.5',
          )}
        >
          <Sparkles className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-4 w-4')} />
          Generate Fix
        </button>
      )}

      {/* Loading state */}
      {state === 'loading' && (
        <div className="flex items-center gap-3 rounded-xl border border-ai/20 bg-ai/5 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-ai shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">AI agent analysing this error…</p>
            <p className="text-xs text-muted-foreground">Reading error type, screen context, and stack trace</p>
          </div>
          <span className="ml-auto font-mono text-[9px] font-bold tracking-widest text-ai/70">AI</span>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="rounded-xl border border-critical/20 bg-critical/5 px-4 py-3">
          <p className="text-sm font-semibold text-critical">Fix generation failed</p>
          <p className="text-xs text-muted-foreground mt-0.5">{errMsg}</p>
          <button onClick={handleGenerate} className="mt-2 text-xs font-medium text-intel hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Result */}
      {state === 'done' && result && (
        <div className="rounded-xl border border-ai/20 bg-ai/5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-ai/15 px-4 py-2.5">
            <Sparkles className="h-3.5 w-3.5 text-ai shrink-0" />
            <span className="text-xs font-bold tracking-wide text-foreground">AI-Generated Fix</span>
            <span className="font-mono text-[9px] font-bold tracking-widest text-ai/70 bg-ai/10 border border-ai/20 rounded px-1.5 py-0.5">AI</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Confidence</span>
                <div className="w-24">
                  <ConfidenceBar value={result.confidence} />
                </div>
              </div>
              <button onClick={() => setExpanded((e) => !e)} className="text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {expanded && (
            <div className="space-y-4 p-4">
              {/* Root cause */}
              <div className="flex gap-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Root Cause</p>
                  <p className="text-sm text-foreground leading-relaxed">{result.rootCause}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Affected area: <span className="font-semibold text-foreground">{result.affectedArea}</span></p>
                </div>
              </div>

              {/* Fix steps */}
              <div className="flex gap-3">
                <Lightbulb className="h-4 w-4 shrink-0 text-ai mt-0.5" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Fix</p>
                  <div className="space-y-1.5">
                    {result.fix.split('\n').filter((l) => l.trim()).map((line, i) => (
                      <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Code example */}
              {result.codeExample && (
                <div className="flex gap-3">
                  <Code2 className="h-4 w-4 shrink-0 text-intel mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Code Example</p>
                    <CodeBlock code={result.codeExample} language={result.language} />
                  </div>
                </div>
              )}

              {/* Prevention */}
              <div className="flex gap-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-healthy mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Prevention</p>
                  <p className="text-sm text-foreground">{result.prevention}</p>
                </div>
              </div>

              {/* Regenerate */}
              <div className="border-t border-ai/15 pt-3">
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ai transition-colors"
                >
                  <Sparkles className="h-3 w-3" /> Regenerate fix
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
