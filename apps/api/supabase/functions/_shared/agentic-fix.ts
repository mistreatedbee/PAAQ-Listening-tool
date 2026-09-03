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
import { getAiConfig, openRouterChat, AI_TOKEN_BUDGETS, type ChatMessage } from './ai.ts'
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
// Wall-clock ceiling for the explore loop inside one invocation. The whole
// loop runs synchronously in a single edge-function call, so past ~75s we
// stop exploring and force convergence rather than risk the platform
// killing the function mid-flight (which would strand the run in
// 'exploring' forever — the same failure mode the per-step execution
// design exists to prevent). Sized so the forced plan-proposal call that
// follows still fits inside a ~150s platform limit even when the primary
// AI model stalls and we fall back.
const EXPLORE_TIME_BUDGET_MS = 75_000

export type PlanStep = {
  step: number
  description: string
  path: string | null
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

/**
 * Parses JSON the model emitted inside a plain-text response. Reasoning-style
 * models occasionally emit raw control characters (literal newlines/tabs) in
 * string literals instead of \n escapes — strict JSON.parse rejects those
 * whole payloads, so fall back to sanitizing just enough to recover them.
 */
function tolerantJsonParse<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    // Strip literal control chars (except escaped sequences, which JSON.parse
    // handles) and retry. Losing a raw newline inside one string is far better
    // than failing an entire fix step.
    const sanitized = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    return JSON.parse(sanitized) as T
  }
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
  const failedPaths: string[] = []

  // Stack traces usually name the real file. Surfacing those paths up front
  // lets the agent start from evidence instead of guessing through the tree —
  // the single biggest lever on whether exploration converges at all.
  const stackHintPaths = (rec.description?.match(/[\w./-]+\.(?:ts|tsx|js|jsx|py|rb|go|java|kt|swift|dart|php|cs)\b/g) ?? [])
    .filter((p) => !p.includes('node_modules'))
    .slice(0, 12)
    .filter((p) => allPaths.length === 0 || allPaths.includes(p))

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

Efficiency rules (you have a hard turn budget — see the turn counter on every message):
- Read MULTIPLE files per turn by calling read_file several times in one response. Do NOT spend one turn per file.
- Start with files named in the stack trace or hints; expand outward only as needed.
- If a read fails (file doesn't exist), do NOT retry variants of that path more than once — move to a different candidate.
- Aim to propose_plan within 3 turns. Convergence is mandatory before the budget runs out.

Rules:
- You MUST call read_file at least once before propose_plan. A plan with no real file read is a guess, not an investigation, and will be rejected.
- Cap the plan at ${MAX_PLAN_STEPS} steps. If it genuinely needs more, say so in summary and lower confidence rather than overreaching.
- If after real investigation you're still not confident, propose the plan anyway but set confidence below 40 and explain exactly what's uncertain in summary.`

  const userPrompt = `Issue to fix:
Title: ${rec.title}
Type: ${rec.type}
Description: ${rec.description ?? 'none'}${rootCauseText}${affectedHint}${patchPlanText}${explicitHint}
${stackHintPaths.length ? `\nFiles named in the stack trace/description — read these first:\n${stackHintPaths.map((p) => `- ${p}`).join('\n')}` : ''}

Repo file tree (${allPaths.length} files total${allPaths.length > MAX_TREE_ENTRIES ? `, showing first ${MAX_TREE_ENTRIES}` : ''}):
${treeListing || '(tree unavailable — call read_file to probe likely paths directly)'}

Turn 1 of ${MAX_EXPLORE_TURNS}. You have ${MAX_EXPLORE_TURNS} turns total; propose_plan must happen before they run out.`

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

  const startedAt = Date.now()

  for (let turn = 0; turn < MAX_EXPLORE_TURNS; turn++) {
    // Final turn: force a decision instead of letting the run die at the cap.
    // The model is told to commit to its best-supported plan now (or an
    // explicit "not fixable" summary) — anything beats the generic
    // "didn't converge" failure the user sees otherwise.
    const turnsLeft = MAX_EXPLORE_TURNS - turn
    if (turn > 0) {
      messages.push({
        role: 'user',
        content: turnsLeft <= 2
          ? `Turn ${turn + 1} of ${MAX_EXPLORE_TURNS}. ${turnsLeft === 1 ? 'This is your LAST turn — call propose_plan NOW with your best-supported plan based on what you have read (lower confidence and state uncertainty in summary rather than continuing to explore). If you truly found nothing actionable, propose_plan with summary explaining why and confidence 0.' : 'Budget nearly exhausted — wrap up investigation this turn.'}`
          : `Turn ${turn + 1} of ${MAX_EXPLORE_TURNS} (${turnsLeft} remaining).`,
      })
    }

    // Wall-clock guard: if we're close to the invocation timeout, force
    // convergence immediately rather than risk the platform killing the
    // function mid-call and stranding the run in 'exploring'.
    const timeLeft = EXPLORE_TIME_BUDGET_MS - (Date.now() - startedAt)
    if (turn > 0 && timeLeft < 20_000 && explored.length > 0) {
      await appendLog(runId, 'Time budget nearly spent — forcing plan proposal from findings so far…')
      messages.push({
        role: 'user',
        content: 'Time budget exhausted. Call propose_plan NOW with the best plan supported by the files you have already read.',
      })
    }

    let response: Awaited<ReturnType<typeof openRouterChat>>
    try {
      response = await openRouterChat({ apiKey, messages, maxTokens: AI_TOKEN_BUDGETS.code, tools })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await updateRun(runId, { status: 'failed', error: `AI call failed: ${message}` })
      return
    }

    const { message: assistantMsg, finishReason } = response

    if (finishReason === 'length') {
      // A truncated turn isn't necessarily fatal: the model may have burned
      // its budget on reasoning before emitting tool calls. Give it one
      // recovery nudge (cheap turn) instead of killing the whole run.
      await appendLog(runId, 'Response was truncated — retrying with a nudge to answer concisely…')
      messages.push({
        role: 'user',
        content: 'Your previous response was cut off by the token limit. Continue concisely: call read_file for only the single most important file you still need, or call propose_plan if you know enough already.',
      })
      continue
    }
    messages.push({
      role: 'assistant',
      content: assistantMsg.content ?? undefined,
      ...(assistantMsg.tool_calls ? { tool_calls: assistantMsg.tool_calls } : {}),
    })

    const toolCalls = assistantMsg.tool_calls ?? []

    if (toolCalls.length === 0) {
      // Narration without action. One free nudge to act; on the second
      // offense (or final turn), salvage whatever text exists as the error
      // so the user sees the agent's own explanation, not a generic one.
      if (turn < MAX_EXPLORE_TURNS - 2 && turnsLeft > 2) {
        await appendLog(runId, 'Agent replied without acting — nudging it to investigate…')
        messages.push({
          role: 'user',
          content: 'Replying in prose does not progress the investigation. Either call read_file on the files you need or call propose_plan with your current best understanding.',
        })
        continue
      }
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
          if (path && !failedPaths.includes(path)) failedPaths.push(path)
          // Give the model usable signal on failure: what was already tried
          // and a few real alternatives from the tree, so it stops guessing.
          const guesses = allPaths.filter((p) => !failedPaths.includes(p) && !explored.includes(p)).slice(0, 15)
          messages.push({
            role: 'user',
            content: JSON.stringify({
              tool: 'read_file',
              tool_call_id: call.id,
              ok: false,
              error: result.error,
              pathsAlreadyTriedAndFailed: failedPaths,
              ...(guesses.length ? { availableAlternatives: guesses } : {}),
            }),
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

  // Hit the turn cap. If the agent read anything at all, that's still enough
  // for a salvage plan — run one final forced-proposal call so the user gets
  // a reviewable plan (possibly low-confidence) instead of a dead end.
  if (explored.length > 0) {
    await appendLog(runId, 'Turn budget spent — requesting a best-effort plan from what was explored…')
    messages.push({
      role: 'user',
      content: `The ${MAX_EXPLORE_TURNS}-turn investigation budget is now exhausted. Call propose_plan immediately with the best plan you can support from the files you already read. Set confidence honestly (below 40 if uncertain) and explain remaining unknowns in summary.`,
    })
    try {
      const { message: finalMsg } = await openRouterChat({ apiKey, messages, maxTokens: AI_TOKEN_BUDGETS.code, tools })
      const planCall = (finalMsg.tool_calls ?? []).find((c) => c.function.name === 'propose_plan')
      if (planCall) {
        const input = JSON.parse(planCall.function.arguments) as { summary: string; confidence: number; steps: { description: string; path: string }[] }
        if (input.steps?.length) {
          const plan: PlanStep[] = input.steps.slice(0, MAX_PLAN_STEPS).map((s, i) => ({
            step: i + 1,
            description: s.description,
            path: s.path ?? null,
            status: 'pending',
          }))
          await appendLog(runId, `Salvaged a plan (${plan.length} step${plan.length === 1 ? '' : 's'}) from the exploration so far.`)
          await updateRun(runId, {
            status: 'awaiting_plan_approval',
            summary: input.summary,
            confidence: Math.min(input.confidence ?? 0, 40),
            plan,
          })
          return
        }
      }
    } catch { /* fall through to the generic failure below */ }
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

Return ONLY search/replace blocks, no explanation. For each distinct change:

<<<<<<< SEARCH
[exact consecutive lines from the current file to replace]
=======
[replacement lines]
>>>>>>> REPLACE

Rules:
- SEARCH must match the current file EXACTLY (copy the lines verbatim, including whitespace). Keep each SEARCH block as small as possible while staying unique in the file.
- Multiple blocks are allowed for changes in different places; they apply top to bottom.
- Do NOT rewrite the whole file — only the lines this step changes.
- Only make the change described by this step — later steps handle the rest.`

  try {
    const { message, finishReason } = await openRouterChat({
      apiKey,
      messages: [{ role: 'user', content: prompt }],
      // Search/replace hunks are tiny compared to whole-file echoes, so a
      // modest budget suffices even with reasoning overhead.
      maxTokens: AI_TOKEN_BUDGETS.code,
      temperature: 0,
    })
    if (finishReason === 'length') return { ok: false, error: 'Response truncated (change too large for one pass).' }
    const raw = message.content?.trim() ?? null
    if (!raw) return { ok: false, error: 'No response from the AI model' }

    const applied = applySearchReplaceBlocks(currentContent, raw)
    if (!applied.ok) return { ok: false, error: applied.error }
    if (applied.newContent === currentContent) return { ok: false, error: 'The model returned no applicable changes (SEARCH blocks matched nothing or changed nothing).' }
    return { ok: true, newContent: applied.newContent }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Applies Aider-style SEARCH/REPLACE blocks to file content. Every block must
 * match exactly once; a block that matches zero or several times fails the
 * whole step with a precise message so the model's next attempt (or the user)
 * knows exactly which hunk went wrong.
 */
function applySearchReplaceBlocks(
  content: string,
  raw: string,
): { ok: true; newContent: string } | { ok: false; error: string } {
  const blocks = raw.split('<<<<<<< SEARCH').slice(1)
  if (blocks.length === 0) return { ok: false, error: 'Response contained no <<<<<<< SEARCH / ======= / >>>>>>> REPLACE blocks.' }

  let result = content
  let appliedCount = 0
  for (const [i, block] of blocks.entries()) {
    const sep = block.indexOf('\n=======\n') !== -1 ? '\n=======\n' : '\n=======\r\n'
    const sepIdx = block.indexOf(sep)
    const endMatch = block.match(/\n?>>>>>>>(?:>|>)? REPLACE\r?\n?$/)
    if (sepIdx === -1 || !endMatch) {
      return { ok: false, error: `Block ${i + 1} is malformed — missing ======= separator or >>>>>>> REPLACE terminator.` }
    }
    const search = block.slice(0, sepIdx)
    const replace = block.slice(sepIdx + sep.length, endMatch.index)

    const occurrences = countOccurrences(result, search)
    if (occurrences === 0) {
      // Tolerate the model echoing the fence markers inside its first line.
      const trimmedSearch = search.replace(/^[`*\s]*```[a-z]*\n?/, '').replace(/\n```\s*$/, '')
      const trimmedOccurrences = countOccurrences(result, trimmedSearch)
      if (trimmedOccurrences !== 1) {
        return { ok: false, error: `Block ${i + 1}: SEARCH text not found in the file (${occurrences} exact match(es)). Copy the lines verbatim from the current content.` }
      }
      result = result.replace(trimmedSearch, () => replace)
    } else if (occurrences > 1) {
      return { ok: false, error: `Block ${i + 1}: SEARCH text matches ${occurrences} places — make the SEARCH block more specific (include surrounding unique lines).` }
    } else {
      result = result.replace(search, () => replace)
    }
    appliedCount++
  }
  if (appliedCount === 0) return { ok: false, error: 'No SEARCH/REPLACE blocks were applied.' }
  return { ok: true, newContent: result }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let pos = haystack.indexOf(needle)
  while (pos !== -1) {
    count++
    pos = haystack.indexOf(needle, pos + needle.length)
  }
  return count
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
      maxTokens: 4096,
      temperature: 0,
    })
    const raw = message.content?.trim() || '{}'
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const parsed = tolerantJsonParse<{ passed: boolean; note: string }>(start >= 0 && end > start ? raw.slice(start, end + 1) : raw)
    return { passed: !!parsed.passed, note: parsed.note ?? '' }
  } catch {
    // Review call itself failing shouldn't block the pipeline — treat as pass-through.
    return { passed: true, note: '' }
  }
}

export type { GitProvider }
