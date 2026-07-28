import type { GitAdapter } from './types.ts'

export type GitProvider = 'github' | 'gitlab' | 'azure' | 'bitbucket'

/**
 * Dynamically imports only the adapter for the requested provider, so a
 * broken provider module only affects requests for that provider instead
 * of crashing the whole function at cold start (the exact bug found and
 * fixed in db-connector's loadAdapter this session).
 */
export async function loadGitAdapter(provider: GitProvider): Promise<GitAdapter> {
  switch (provider) {
    case 'github':
      return (await import('./github.ts')).githubAdapter
    case 'gitlab':
      return (await import('./gitlab.ts')).gitlabAdapter
    case 'azure':
      return (await import('./azure.ts')).azureAdapter
    case 'bitbucket':
      return (await import('./bitbucket.ts')).bitbucketAdapter
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}
