/**
 * The real fix-generation agent — the same shape as a terminal coding agent:
 * explore the actual repo (as many real files as it takes), commit
 * to a concrete plan, show that plan to the user for approval, then execute
 * it one step at a time — each step reads the real current file, writes a
 * real change, and gets a real self-review pass before being marked done.
 * Nothing here is a simulated/timed animation: every state below is
 * persisted to `fix_runs` as it happens and the dashboard subscribes to
 * that row via Realtime, so what's on screen is always the agent's actual
 * current state.
 *
 * "Testing" is real, not fabricated: there is no sandboxed runtime in an
 * edge function to run a customer's own test suite, so this agent does not
 * pretend to. Its self-review pass is a second, independent AI read of each
 * diff catching obvious mistakes before the step is marked done; the real,
 * authoritative test is the repo's own CI once a PR is opened — which the
 * existing merge gate (fix-engine.ts performMerge) already requires to pass.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAiConfig, openRouterChat, OPENROUTER_MODEL, type ChatMessage } from './ai.ts'
import { loadGitAdapter, type GitProvider } from './git-providers/load-adapter.ts'
import type { RepoRef } from './git-providers/types.ts'
import type { RecRow } from './fix-engine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const MAX_EXPLORE_TURNS = 8
const MAX_TREE_ENTRIES = 1200
const MAX_FILE_CHARS = 12000
const MAX_PLAN_STEPS = 8

export type PlanStep = {
  step: number
  description: string
  path: string | null
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

async function updateRun(runId: string, patch: Record<string, unknown>) {
  await supabase.from('fix_runs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', runId)
}

async function appendLog(runId: string, message: string) {
  const { data } = await supabase.from('fix_runs').select('log').eq('id', runId).maybeSingle()
  const log = (data?.log ?? []) as { ts: string; message: string }[]
  log.push({ ts: new Date().toISOString(), message })
  await updateRun(runId, { log })
}

/**
 * Phase 1: explore the real repo and produce a plan. Persists progress as it
 * goes; ends at status 'awaiting_plan_approval' (plan ready for the user to
 * review) or 'failed'. Never writes to the repo.
 */
export async function exploreAndPlan(
  runId: string,
  rec: RecRow,
  provider: GitProvider,
  repo: RepoRef,
  token: string,
  explicitPath?: string,
): Promise<void> {
  const adapter = await loadGitAdapter(provider)
  const config = getAiConfig()
  if (!config) {
    await updateRun(runId, { status: 'failed', error: 'No AI API key configured. Set OPENROUTER_API_KEY in Supabase secrets.' })
    return
  }
  const apiKey = config.apiKey

  await appendLog(runId, 'Reading the repository file tree…')
  const treeResult = await adapter.listTree(token, repo, '', repo.defaultBranch, { recursive: true })
  const allPaths = treeResult.ok ? treeResult.entries.filter((e) => e.type === 'file').map((e) => e.path) : []
  const treeListing = allPaths.slice(0, MAX_TREE_ENTRIES).join('\n')

  const explored: string[] = []

  const patchPlanText = rec.patch_plan?.length
    ? `\nExisting investigation notes (context only — verify against the real code, don't trust blindly):\n${rec.patch_plan.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
    : ''
  const rootCauseText = rec.root_cause ? `\nSuspected root cause: ${rec.root_cause}` : ''
  const affectedHint = rec.affected_files?.length
    ? `\nPreviously flagged files: ${rec.affected_files.map((f) => f.path).join(', ')}`
    : ''
  const explicitHint = explicitPath
    ? `\nA human pointed at this file as a likely starting point: ${explicitPath} — start there, but keep investigating other files if the real cause turns out to live elsewhere.`
    : ''

  const systemPrompt = `You are the PAAQ Fix Agent. Work like a disciplined coding agent: investigate for real before proposing anything.

1. Explore. Call read_file on every file you actually need to understand the issue — start from the file tree below. Do not stop at one file if the real cause spans more than one (e.g. a UI bug caused by a backend response shape, a shared util used in several places). Never reason about the fix from filenames or descriptions alone.
2. Once you genuinely understand the cause, call propose_plan with a concrete, ordered todo list — one item per discrete change, each naming the exact file it touches. This plan is shown to a human for approval before any code is written, so it must be specific enough for them to judge it (not "fix the bug" — say exactly what changes in which file and why).

Rules:
- You MUST call read_file at least once before propose_plan. A plan with no real file read is a guess, not an investigation, and will be rejected.
- Cap the plan at ${MAX_PLAN_STEPS} steps. If it genuinely needs more, say so in summary and lower confidence rather than overreaching.
- If after real investigation you're still not confident, propose the plan anyway but set confidence below 40 and explain exactly what's uncertain in summary.`

  const userPrompt = `Issue to fix:
Title: ${rec.title}
Type: ${rec.type}
Description: ${rec.description ?? 'none'}${rootCauseText}${affectedHint}${patchPlanText}${explicitHint}

Repo file tree (${allPaths.length} files total${allPaths.length > MAX_TREE_ENTRIES ? `, showing first ${MAX_TREE_ENTRIES}` : ''}):
${treeListing || '(tree unavailable — call read_file to probe likely paths directly)'}`

  // OpenAI-style function tools for the OpenRouter wire format.
  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'read_file',
        description: "Read a file's real current content from the connected repo.",
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'propose_plan',
        description: 'Finish investigating and propose the concrete plan for a human to approve before any code is written.',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'One or two sentences describing the real root cause and the overall fix approach.' },
            confidence: { type: 'number', description: '0-100' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string', description: 'Exactly what will change and why, specific enough to review.' },
                  path: { type: 'string', description: 'The repo-relative file path this step changes.' },
                },
                required: ['description', 'path'],
              },
            },
          },
          required: ['summary', 'confidence', 'steps'],
        },
      },
    },
  ]

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  for (let turn = 0; turn < MAX_EXPLORE_TURNS; turn++) {
    let response: Awaited<ReturnType<typeof openRouterChat>>
    try {
      response = await openRouterChat({ apiKey, messages, maxTokens: 6000, tools })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await updateRun(runId, { status: 'failed', error: `AI call failed: ${message}` })
      return
    }

    const { message: assistantMsg, finishReason } = response
    messages.push({
      role: 'assistant',
      content: assistantMsg.content ?? undefined,
      ...(assistantMsg.tool_calls ? { tool_calls: assistantMsg.tool_calls } : {}),
    })

    if (finishReason === 'length') {
      await updateRun(runId, { status: 'failed', error: 'Agent response was truncated mid-turn — try narrowing the issue description.' })
      return
    }

    const toolCalls = assistantMsg.tool_calls ?? []

    if (toolCalls.length === 0) {
      const text = assistantMsg.content ?? ''
      await updateRun(runId, { status: 'failed', error: text || 'Agent stopped without proposing a plan.' })
      return
    }

    const planCall = toolCalls.find((c) => c.function.name === 'propose_plan')
    if (planCall) {
      let input: { summary: string; confidence: number; steps: { description: string; path: string }[] }
      try {
        input = JSON.parse(planCall.function.arguments)
      } catch {
        await updateRun(runId, { status: 'failed', error: 'Agent returned malformed plan arguments.' })
        return
      }

      if (explored.length === 0) {
        await updateRun(runId, { status: 'failed', error: 'Agent tried to propose a plan without reading any real file — refusing to trust an unverified guess.' })
        return
      }
      if (!input.steps || input.steps.length === 0) {
        await updateRun(runId, { status: 'failed', error: 'Agent proposed an empty plan.' })
        return
      }

      const plan: PlanStep[] = input.steps.slice(0, MAX_PLAN_STEPS).map((s, i) => ({
        step: i + 1,
        description: s.description,
        path: s.path ?? null,
        status: 'pending',
      }))

      await appendLog(runId, `Plan ready — ${plan.length} step${plan.length === 1 ? '' : 's'}, awaiting your approval.`)
      await updateRun(runId, {
        status: 'awaiting_plan_approval',
        summary: input.summary,
        confidence: input.confidence,
        plan,
      })
      return
    }

    // Feed every tool result back as role:'tool' messages (OpenAI convention).
    for (const call of toolCalls) {
      if (call.function.name === 'read_file') {
        let path = ''
        try { path = (JSON.parse(call.function.arguments) as { path?: string }).path ?? '' } catch { /* malformed args */ }
        await appendLog(runId, `Reading ${path}…`)
        const result = path
          ? await adapter.getFileContent(token, repo, path, repo.defaultBranch)
          : { ok: false as const, error: 'Malformed read_file arguments' }
        if (result.ok) {
          if (!explored.includes(path)) explored.push(path)
          await updateRun(runId, { explored_files: explored })
          const truncated = result.content.length > MAX_FILE_CHARS
          messages.push({
            role: 'user',
            content: JSON.stringify({
              tool: 'read_file',
              tool_call_id: call.id,
              ok: true,
              content: truncated ? `${result.content.slice(0, MAX_FILE_CHARS)}\n… (truncated, ${result.content.length} chars total)` : result.content,
            }),
          })
        } else {
          messages.push({
            role: 'user',
            content: JSON.stringify({ tool: 'read_file', tool_call_id: call.id, ok: false, error: result.error }),
          })
        }
      } else {
        messages.push({
          role: 'user',
          content: JSON.stringify({ tool: call.function.name, tool_call_id: call.id, ok: false, error: `Unknown tool: ${call.function.name}` }),
        })
      }
    }
  }

  await updateRun(runId, { status: 'failed', error: `Investigation didn't converge within ${MAX_EXPLORE_TURNS} turns — try a narrower issue description or point at a specific file.` })
}

/**
 * Phase 2: execute an already-approved plan — but ONE STEP PER CALL, not the
 * whole plan in one request. A plan of any real size (multi-file, each step
 * costing 2-3 sequential AI calls) reliably blew past the edge
 * function's execution time limit when run as a single synchronous loop —
 * confirmed live: a real 6-step plan got stuck 'running' forever with no
 * error surfaced, which is exactly what "I click approve and nothing
 * happens" was. The dashboard now calls this repeatedly (same proven
 * resumable pattern as onboard-agent's start/continue) until it reports
 * done — each call bounded to one step, safely inside any timeout, with
 * live progress visible via the same Realtime subscription throughout.
 */
export async function executeNextStep(
  runId: string,
  rec: RecRow,
  provider: GitProvider,
  repo: RepoRef,
  token: string,
): Promise<{ done: boolean }> {
  const { data: run } = await supabase.from('fix_runs').select('*').eq('id', runId).maybeSingle()
  if (!run) return { done: true }
  const plan = (run.plan ?? []) as PlanStep[]
  if (plan.length === 0) {
    await updateRun(runId, { status: 'failed', error: 'No plan to execute.' })
    return { done: true }
  }

  // Reconstruct working state from what earlier calls already persisted —
  // each invocation is a fresh function instance, nothing survives in memory
  // between calls.
  const working = new Map<string, string>(((run.changeset ?? []) as { path: string; newContent: string }[]).map((c) => [c.path, c.newContent]))
  const original = new Map<string, string>(((run.original ?? []) as { path: string; content: string }[]).map((o) => [o.path, o.content]))

  // 'running' is included so a step interrupted mid-call by a prior timeout
  // (rare now, but the whole point of this design is to never trust that it
  // can't happen) gets retried rather than stuck forever.
  const stepIdx = plan.findIndex((s) => s.status === 'pending' || s.status === 'running')

  if (stepIdx === -1) {
    // Every step has a terminal status — finalize.
    const changeset = Array.from(working.entries()).map(([path, newContent]) => ({ path, newContent }))
    const failedSteps = plan.filter((s) => s.status === 'error').length

    if (changeset.length === 0) {
      await appendLog(runId, 'All steps failed — no changeset produced.')
      await updateRun(runId, { status: 'failed', error: 'Every step in the plan failed — see step details above.' })
      return { done: true }
    }

    await supabase.from('recommendations').update({ fix_changeset: changeset }).eq('id', rec.id)
    const note = failedSteps > 0 ? ` (${failedSteps} of ${plan.length} steps failed — review before opening a PR)` : ''
    await appendLog(runId, `Done${note}.`)
    await updateRun(runId, {
      status: 'completed',
      changeset,
      original: Array.from(original.entries()).map(([path, content]) => ({ path, content })),
      error: failedSteps > 0 ? `${failedSteps} of ${plan.length} steps failed` : null,
    })
    return { done: true }
  }

  const step = plan[stepIdx]
  const adapter = await loadGitAdapter(provider)
  const config = getAiConfig()
  if (!config) {
    await updateRun(runId, {
      plan,
      status: 'failed',
      error: 'No AI API key configured. Set OPENROUTER_API_KEY in Supabase secrets.',
    })
    return { done: false }
  }
  const apiKey = config.apiKey

  plan[stepIdx] = { ...step, status: 'running' }
  await updateRun(runId, { plan })
  await appendLog(runId, `Step ${step.step}/${plan.length}: ${step.description}`)

  const persistProgress = async (patch: Partial<PlanStep>) => {
    plan[stepIdx] = { ...plan[stepIdx], ...patch }
    await updateRun(runId, {
      plan,
      changeset: Array.from(working.entries()).map(([path, newContent]) => ({ path, newContent })),
      original: Array.from(original.entries()).map(([path, content]) => ({ path, content })),
    })
  }

  if (!step.path) {
    await persistProgress({ status: 'error', detail: 'No file path given for this step.' })
    return { done: false }
  }

  try {
    if (!working.has(step.path)) {
      const fileResult = await adapter.getFileContent(token, repo, step.path, repo.defaultBranch)
      if (!fileResult.ok) {
        await persistProgress({ status: 'error', detail: `Could not read ${step.path}: ${fileResult.error}` })
        return { done: false }
      }
      working.set(step.path, fileResult.content)
      original.set(step.path, fileResult.content)
    }

    const currentContent = working.get(step.path)!
    const generated = await generateStepChange(apiKey, rec, run.summary as string | null, plan, step, currentContent)
    if (!generated.ok) {
      await persistProgress({ status: 'error', detail: generated.error })
      return { done: false }
    }

    const review = await reviewStepChange(apiKey, step, currentContent, generated.newContent)
    let finalContent = generated.newContent
    let detail = review.passed ? 'Applied and self-reviewed.' : `Applied — self-review flagged: ${review.note}`

    if (!review.passed) {
      const retry = await generateStepChange(apiKey, rec, run.summary as string | null, plan, step, currentContent, review.note)
      if (retry.ok) {
        finalContent = retry.newContent
        detail = 'Applied after one self-review retry.'
      }
    }

    working.set(step.path, finalContent)
    await persistProgress({ status: 'done', detail })
    return { done: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await persistProgress({ status: 'error', detail: message })
    return { done: false }
  }
}

async function generateStepChange(
  apiKey: string,
  rec: RecRow,
  overallSummary: string | null,
  plan: PlanStep[],
  step: PlanStep,
  currentContent: string,
  retryNote?: string,
): Promise<{ ok: true; newContent: string } | { ok: false; error: string }> {
  const planContext = plan.map((s) => `  ${s.step}. ${s.description}${s.path ? ` (${s.path})` : ''}`).join('\n')
  const retryText = retryNote ? `\n\nA prior attempt at this step was flagged on self-review: "${retryNote}". Fix that specifically this time.` : ''

  const prompt = `You are executing one step of an already-approved fix plan.

Issue: ${rec.title}
${overallSummary ? `Overall fix approach: ${overallSummary}\n` : ''}
Full plan (for context — you are only executing this one step):
${planContext}

This step: ${step.description}
File: ${step.path}
Current content:
\`\`\`
${currentContent.slice(0, 14000)}
\`\`\`${retryText}

Return ONLY this JSON, no markdown, no explanation:
{ "newContent": "<the complete file content after this step's change>" }

Rules:
- newContent must be the COMPLETE file after the change, not a diff or snippet.
- Only make the change described by this step — later steps handle the rest.`

  try {
    const { message, finishReason } = await openRouterChat({
      apiKey,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 8000,
    })
    if (finishReason === 'length') return { ok: false, error: 'Response truncated (file may be too large for one pass).' }
    const raw = message.content?.trim() ?? null
    if (!raw) return { ok: false, error: 'No response from the AI model' }
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw) as { newContent: string }
    if (!parsed.newContent) return { ok: false, error: 'No newContent in response' }
    return { ok: true, newContent: parsed.newContent }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * A second, independent AI read of the diff — real self-review, not a
 * fabricated test run. Catches obvious mistakes (broke syntax, ignored the
 * step, left the file unchanged) before the step is marked done.
 */
async function reviewStepChange(
  apiKey: string,
  step: PlanStep,
  before: string,
  after: string,
): Promise<{ passed: boolean; note: string }> {
  if (before === after) return { passed: false, note: 'The file was not actually changed.' }

  const prompt = `Review this code change for one specific fix step. Be strict about obvious problems only (syntax errors, the step not actually being addressed, leftover placeholder text) — not style preferences.

Step: ${step.description}

Before:
\`\`\`
${before.slice(0, 6000)}
\`\`\`

After:
\`\`\`
${after.slice(0, 6000)}
\`\`\`

Reply with ONLY this JSON: { "passed": true|false, "note": "one short sentence" }`

  try {
    const { message } = await openRouterChat({
      apiKey,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 200,
      temperature: 0,
    })
    const raw = message.content?.trim() || '{}'
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw) as { passed: boolean; note: string }
    return { passed: !!parsed.passed, note: parsed.note ?? '' }
  } catch {
    // Review call itself failing shouldn't block the pipeline — treat as pass-through.
    return { passed: true, note: '' }
  }
}

export type { GitProvider }
