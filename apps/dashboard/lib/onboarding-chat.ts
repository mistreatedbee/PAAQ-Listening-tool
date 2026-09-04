export type AskUser = {
  question: string
  kind: 'text' | 'confirm' | 'choose_provider' | 'paste_connection_string'
  options?: string[]
}

type MessageRow = {
  role: string
  content: unknown
}

function parseToolResult(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

/** Extract ask_user or connect_repository UI hints from tool result rows. */
export function findPendingUserInput(messages: MessageRow[]): AskUser | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'tool') continue
    const content = messages[i].content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (!block || typeof block !== 'object') continue
      const parsed = parseToolResult((block as Record<string, unknown>).content)
      if (!parsed) continue

      if (typeof parsed.question === 'string' && typeof parsed.kind === 'string') {
        return {
          question: parsed.question,
          kind: parsed.kind as AskUser['kind'],
          options: Array.isArray(parsed.options) ? parsed.options as string[] : undefined,
        }
      }

      if (parsed.awaitingUser && parsed.kind === 'choose_provider') {
        return {
          question: typeof parsed.question === 'string'
            ? parsed.question
            : 'Connect a git provider to access your repositories.',
          kind: 'choose_provider',
          options: Array.isArray(parsed.options) ? parsed.options as string[] : undefined,
        }
      }

      if (parsed.needsOAuth) {
        return {
          question: 'Connect your git account to list repositories and open an SDK integration PR.',
          kind: 'choose_provider',
        }
      }
    }
  }
  return null
}

/** Strip raw tool-use JSON the model sometimes leaks into assistant text. */
export function sanitizeAssistantText(text: string): string {
  return text
    .replace(/\[\s*\{[^[\]]*"type"\s*:\s*"tool_use"[^[\]]*\}\s*\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const TOOL_LABELS: Record<string, string> = {
  list_repos: 'Listed repositories',
  connect_repository: 'Checked repository connection',
  list_repo_tree: 'Scanned repository files',
  read_repo_file: 'Read a repository file',
  generate_sdk_snippet: 'Generated SDK integration',
  write_sdk_file_via_pr: 'Opened pull request',
  configure_db_connection: 'Searched for database config',
  verify_database: 'Verified database connection',
  verify_backend: 'Checked backend SDK traffic',
  verify_frontend: 'Checked frontend SDK traffic',
  send_test_event: 'Sent test event',
  activate_monitoring: 'Activated monitoring',
  ask_user: 'Waiting for your input',
}

export function toolResultLabel(content: unknown): string | null {
  if (!Array.isArray(content)) return null
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const parsed = parseToolResult((block as Record<string, unknown>).content)
    if (!parsed) continue
    if (parsed.awaitingUser) return 'Needs your git connection'
    if (parsed.needsOAuth) return 'Git provider not connected yet'
    if (parsed.ok === true && parsed.repo) return `Connected to ${parsed.repo}`
    if (parsed.prUrl) return 'Opened SDK integration PR'
  }
  return null
}

export function inferToolLabelFromAssistantText(text: string): string | null {
  const match = text.match(/"name"\s*:\s*"([^"]+)"/)
  if (!match) return null
  return TOOL_LABELS[match[1]] ?? `Ran ${match[1].replace(/_/g, ' ')}`
}
