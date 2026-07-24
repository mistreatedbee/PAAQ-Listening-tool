'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  X, Zap, Terminal, Bot, ArrowRight, Sparkles, Copy, Check,
} from 'lucide-react'

const STORAGE_KEY = 'paaq_welcome_seen'

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className={cn(
        'flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all',
        copied
          ? 'border-healthy/40 bg-healthy/10 text-healthy'
          : 'border-border/60 bg-muted/60 text-muted-foreground hover:text-foreground',
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function ConnectWelcomeModal() {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    // Only show on dashboard pages, not on setup/connect/settings
    const skip = ['/setup', '/connect', '/settings', '/onboarding'].some((p) =>
      pathname.startsWith(p),
    )
    if (skip) return

    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Small delay so the layout finishes rendering
        const t = setTimeout(() => setVisible(true), 800)
        return () => clearTimeout(t)
      }
    } catch {
      // localStorage not available (SSR/private browsing)
    }
  }, [pathname])

  const dismiss = () => {
    setVisible(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  if (!visible) return null

  const mcpJson = `{
  "mcpServers": {
    "paaq": {
      "type": "stdio",
      "command": "node",
      "args": ["packages/mcp-server/index.js"]
    }
  }
}`

  const cliCmd = `node packages/cli/index.js connect`

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/40 overflow-hidden">

          {/* Header */}
          <div className="relative flex flex-col items-center px-6 pt-8 pb-5 text-center border-b border-border/60 bg-gradient-to-b from-ai/5 to-transparent">
            <button
              onClick={dismiss}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ai/10 border border-ai/20 mb-3">
              <Sparkles className="h-6 w-6 text-ai" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Welcome to PAAQ Intelligence</h2>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
              Connect your first app or website to start getting AI-powered insights.
              Choose the quickest method below.
            </p>
          </div>

          {/* Methods */}
          <div className="px-5 py-5 space-y-3">

            {/* MCP */}
            <div className="rounded-xl border border-ai/25 bg-ai/5 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai/15 border border-ai/25">
                  <Zap className="h-3.5 w-3.5 text-ai" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">MCP Server <span className="ml-1 rounded-full bg-ai/15 px-1.5 py-0.5 text-[9px] font-bold text-ai">Recommended</span></p>
                  <p className="text-[10px] text-muted-foreground">AI agents like Claude Code connect your app automatically</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">.mcp.json</span>
                  <CopyBtn text={mcpJson} />
                </div>
                <pre className="p-3 font-mono text-[10px] leading-relaxed text-[#e6edf3] whitespace-pre overflow-x-auto">{mcpJson}</pre>
              </div>
            </div>

            {/* CLI */}
            <div className="rounded-xl border border-border/50 bg-background/40 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border/50">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">CLI</p>
                  <p className="text-[10px] text-muted-foreground">Run one command in your terminal — detects your framework automatically</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-[#0d1117] px-3 py-2">
                <code className="flex-1 font-mono text-[11px] text-[#e6edf3]">{cliCmd}</code>
                <CopyBtn text={cliCmd} />
              </div>
            </div>

            {/* Agent prompt */}
            <div className="rounded-xl border border-border/50 bg-background/40 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border/50">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Agent Prompt</p>
                  <p className="text-[10px] text-muted-foreground">Paste into Claude, ChatGPT, Cursor, or any AI assistant</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-border/60 px-5 py-4 bg-muted/20">
            <Link
              href="/connect"
              onClick={dismiss}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-ai px-4 py-2.5 text-sm font-semibold text-white hover:bg-ai/90 transition-colors shadow-lg shadow-ai/20"
            >
              <Sparkles className="h-4 w-4" />
              Open full connection guide
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={dismiss}
              className="rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
