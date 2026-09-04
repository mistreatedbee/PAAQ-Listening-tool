import { describe, expect, it } from 'vitest'
import { findPendingUserInput, sanitizeAssistantText } from './onboarding-chat'

describe('onboarding-chat', () => {
  it('finds choose_provider from connect_repository tool output', () => {
    const messages = [{
      role: 'tool',
      content: [{
        type: 'tool_result',
        tool_use_id: 'x',
        content: JSON.stringify({
          ok: false,
          awaitingUser: true,
          kind: 'choose_provider',
          question: 'Connect git',
          options: ['github'],
        }),
      }],
    }]
    expect(findPendingUserInput(messages)?.kind).toBe('choose_provider')
  })

  it('strips leaked tool_use JSON from assistant text', () => {
    const raw = `I'll connect your repo.\n[{"id":"list_repos:0","name":"list_repos","type":"tool_use","input":{"provider":"github"}}]`
    expect(sanitizeAssistantText(raw)).toBe("I'll connect your repo.")
  })
})
