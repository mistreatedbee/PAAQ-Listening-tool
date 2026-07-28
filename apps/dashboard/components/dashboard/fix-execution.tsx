'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, XCircle, X, GitBranch, ExternalLink, ShieldAlert } from 'lucide-react'

type Phase = 'idle' | 'generating' | 'review' | 'opening_pr' | 'pr_open' | 'merging' | 'merged' | 'blocked' | 'failed'

type ChangesetItem = { path: string; newContent: string }

export function FixExecution({
  projectId,
  recommendationId,
  title,
  canMerge,
  onClose,
}: {
  projectId: string
  recommendationId: string
  title: string
  /** Whether the current user's role allows the merge action — hides the button otherwise. */
  canMerge: boolean
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [needsFileSelection, setNeedsFileSelection] = useState<string[] | null>(null)
  const [filePathInput, setFilePathInput] = useState('')
  const [changeset, setChangeset] = useState<ChangesetItem[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    void runGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runGenerate(explicitPath?: string) {
    setPhase('generating')
    setError(null)
    setNeedsFileSelection(null)
    const res = await fetch('/api/fix/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId, filePath: explicitPath }),
    }).then((r) => r.json())

    if (!res.ok) {
      if (res.needsFileSelection) {
        setNeedsFileSelection(res.candidates ?? [])
        setPhase('idle')
        setError(res.error)
        return
      }
      setError(res.error ?? 'Failed to generate a fix')
      setPhase('failed')
      return
    }

    setSummary(res.summary)
    setChangeset(res.changes)
    setPhase('review')
  }

  async function runOpenPr() {
    setPhase('opening_pr')
    setError(null)
    const res = await fetch('/api/fix/open-pr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId, changeset }),
    }).then((r) => r.json())

    if (!res.ok) {
      setError(res.error ?? 'Failed to open a pull request')
      setPhase('failed')
      return
    }
    setPrUrl(res.prUrl)
    setPhase('pr_open')
  }

  async function runMerge() {
    setPhase('merging')
    setError(null)
    const res = await fetch('/api/fix/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId }),
    }).then((r) => r.json())

    if (!res.ok) {
      if (res.blockedByProtection) {
        setError(res.error)
        setPhase('blocked')
        return
      }
      setError(res.error ?? 'Merge failed')
      setPhase('failed')
      return
    }
    setPhase('merged')
  }

  const updateChangesetContent = (idx: number, value: string) => {
    setChangeset((prev) => prev.map((c, i) => (i === idx ? { ...c, newContent: value } : c)))
  }

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 transition-opacity duration-200',
      mounted ? 'opacity-100' : 'opacity-0',
    )}>
      <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-6 pt-5 pb-4">
          <div className="min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-ai">Execute fix</span>
            <h2 className="mt-1 text-sm font-semibold text-foreground leading-snug line-clamp-2">{title}</h2>
          </div>
          {(phase === 'merged' || phase === 'failed' || phase === 'blocked' || needsFileSelection) && (
            <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-4">
          {phase === 'generating' && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-ai" /> Generating a fix from the connected repo…
            </div>
          )}

          {needsFileSelection && (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm text-warning">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" /> {error}
              </p>
              {needsFileSelection.length > 0 && (
                <div className="space-y-1.5">
                  {needsFileSelection.map((c) => (
                    <button
                      key={c}
                      onClick={() => runGenerate(c)}
                      className="block w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left font-mono text-xs text-foreground hover:bg-accent"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={filePathInput}
                  onChange={(e) => setFilePathInput(e.target.value)}
                  placeholder="src/path/to/file.ts"
                  className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-xs focus:ring-2 focus:ring-ai/30"
                />
                <button
                  onClick={() => filePathInput.trim() && runGenerate(filePathInput.trim())}
                  className="rounded-lg bg-ai px-3 py-2 text-xs font-medium text-ai-foreground hover:opacity-90"
                >
                  Use this path
                </button>
              </div>
            </div>
          )}

          {phase === 'review' && (
            <div className="space-y-3">
              {summary && <p className="text-sm text-foreground">{summary}</p>}
              {changeset.map((c, idx) => (
                <div key={c.path} className="rounded-lg border border-border/60">
                  <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-1.5">
                    <span className="font-mono text-xs text-foreground">{c.path}</span>
                  </div>
                  <textarea
                    value={c.newContent}
                    onChange={(e) => updateChangesetContent(idx, e.target.value)}
                    rows={10}
                    className="w-full resize-y bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {(phase === 'opening_pr' || phase === 'pr_open' || phase === 'merging' || phase === 'merged') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm">
                {phase === 'opening_pr' ? (
                  <><Loader2 className="h-4 w-4 animate-spin text-ai" /> Opening a pull request…</>
                ) : (
                  <><GitBranch className="h-4 w-4 text-intel" /> Pull request opened</>
                )}
              </div>
              {prUrl && (
                <a href={prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-ai hover:underline">
                  {prUrl} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {phase === 'merging' && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-ai" /> Merging…
                </div>
              )}
              {phase === 'merged' && (
                <div className="flex items-center gap-2.5 text-sm font-medium text-healthy">
                  <CheckCircle2 className="h-4 w-4" /> Merged to main
                </div>
              )}
            </div>
          )}

          {(phase === 'blocked' || phase === 'failed') && (
            <div className="flex items-start gap-2.5 rounded-lg border border-critical/25 bg-critical/5 px-3 py-2.5 text-sm text-critical">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{phase === 'blocked' ? 'Blocked by branch protection' : 'Failed'}</p>
                <p className="mt-0.5 text-xs text-critical/80">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-6 py-4 flex justify-end gap-2">
          {phase === 'review' && (
            <button onClick={runOpenPr} className="rounded-lg bg-ai px-4 py-2 text-sm font-medium text-ai-foreground hover:opacity-90">
              Looks good — Open PR
            </button>
          )}
          {phase === 'pr_open' && canMerge && (
            <button onClick={runMerge} className="rounded-lg bg-healthy px-4 py-2 text-sm font-semibold text-healthy-foreground hover:opacity-90">
              Approve &amp; Merge
            </button>
          )}
          {phase === 'pr_open' && !canMerge && (
            <p className="text-xs text-muted-foreground">Only owners/admins can approve and merge.</p>
          )}
          {(phase === 'merged' || phase === 'failed' || phase === 'blocked') && (
            <button onClick={onClose} className="rounded-lg border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
