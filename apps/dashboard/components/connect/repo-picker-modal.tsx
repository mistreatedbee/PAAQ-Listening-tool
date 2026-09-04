'use client'

import { useState } from 'react'
import { Loader2, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REPO_PROVIDERS, type RepoListItem } from '@/lib/repo-providers'

export function RepoPickerModal({
  projectId,
  provider,
  repos,
  loading,
  onClose,
  onSelected,
}: {
  projectId: string
  provider: string
  repos: RepoListItem[]
  loading: boolean
  onClose: () => void
  onSelected: (repoFullName: string) => void | Promise<void>
}) {
  const [selecting, setSelecting] = useState<string | null>(null)
  const providerLabel = REPO_PROVIDERS.find((p) => p.id === provider)?.label ?? provider

  async function pick(repoFullName: string) {
    if (selecting) return
    setSelecting(repoFullName)
    try {
      const picked = repos.find((r) => r.full_name === repoFullName)
      const res = await fetch('/api/repo/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          provider,
          repo: {
            fullName: repoFullName,
            defaultBranch: picked?.default_branch ?? 'main',
            private: picked?.private ?? false,
          },
        }),
      })
      const data = await res.json().catch(() => ({ ok: false }))
      if (!data.ok) throw new Error(data.error ?? 'Failed to select repository')
      await onSelected(repoFullName)
    } catch {
      setSelecting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Select a repository</p>
            <p className="text-xs text-muted-foreground mt-0.5">Connected via {providerLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto px-5 py-3 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories…
            </div>
          ) : repos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No repositories found for this account.</p>
          ) : repos.map((repo) => (
            <button
              key={repo.full_name}
              onClick={() => pick(repo.full_name)}
              disabled={!!selecting}
              className={cn(
                'w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all',
                selecting === repo.full_name
                  ? 'border-ai/30 bg-ai/5'
                  : 'border-border/50 bg-background/30 hover:border-border hover:bg-accent/30',
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{repo.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{repo.private ? 'Private' : 'Public'} · {repo.default_branch}</p>
              </div>
              {selecting === repo.full_name
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ai shrink-0" />
                : <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
