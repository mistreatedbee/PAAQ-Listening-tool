'use client'

import { REPO_PROVIDERS, type GitProviderId } from '@/lib/repo-providers'

export function GitProviderButtons({
  projectId,
  returnTo,
  options,
}: {
  projectId: string
  returnTo: string
  options?: GitProviderId[]
}) {
  const providers = options
    ? REPO_PROVIDERS.filter((p) => options.includes(p.id))
    : REPO_PROVIDERS

  return (
    <div className="flex flex-wrap gap-2">
      {providers.map((p) => {
        const Icon = p.Icon
        return (
          <a
            key={p.id}
            href={`/api/auth/${p.id}?project_id=${projectId}&returnTo=${encodeURIComponent(returnTo)}`}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-ai/40 hover:bg-ai/5 transition-colors"
          >
            <Icon className={`h-3.5 w-3.5 ${p.iconColor}`} />
            {p.label}
          </a>
        )
      })}
    </div>
  )
}
