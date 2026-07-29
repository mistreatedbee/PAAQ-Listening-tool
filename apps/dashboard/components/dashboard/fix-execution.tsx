'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, XCircle, X, GitBranch, ExternalLink,
  ShieldAlert, Settings, Rocket, FileCode2, Sparkles, GitMerge,
  GitPullRequest, Search, Wrench, Loader2,
} from 'lucide-react'

type Phase =
  | 'pulling'       // connecting + reading file from repo
  | 'analyzing'     // AI analyzing root cause
  | 'writing'       // AI writing the code fix
  | 'opening_pr'    // creating branch + PR
  | 'merging'       // merging to main
  | 'deployed'      // success
  | 'needs_file'    // fallback: couldn't find file
  | 'no_repo'       // no repo connected
  | 'failed'        // unrecoverable error
  | 'blocked'       // branch protection blocked merge

type Step = { id: Phase; label: string; icon: React.ReactNode }

const STEPS: Step[] = [
  { id: 'pulling',    label: 'Reading source',      icon: <Search className="h-3.5 w-3.5" /> },
  { id: 'analyzing',  label: 'Analyzing code',       icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: 'writing',    label: 'Writing fix',          icon: <Wrench className="h-3.5 w-3.5" /> },
  { id: 'opening_pr', label: 'Creating PR',          icon: <GitPullRequest className="h-3.5 w-3.5" /> },
  { id: 'merging',    label: 'Merging to main',      icon: <GitMerge className="h-3.5 w-3.5" /> },
  { id: 'deployed',   label: 'Deployed',             icon: <Rocket className="h-3.5 w-3.5" /> },
]

const PHASE_MESSAGES: Record<string, string[]> = {
  pulling: [
    'Connecting to repository…',
    'Reading source files from GitHub…',
    'Locating the affected code…',
    'Fetching file contents…',
  ],
  analyzing: [
    'Claude is analyzing the root cause…',
    'Cross-referencing telemetry with the code…',
    'Identifying the exact lines to change…',
    'Understanding the problem deeply…',
  ],
  writing: [
    'Writing the fix…',
    'Crafting a minimal, surgical patch…',
    'Applying the change to the source file…',
    'Verifying the fix logic…',
  ],
  opening_pr: [
    'Creating a new branch…',
    'Committing the changes…',
    'Opening a pull request on GitHub…',
    'Linking PR to this recommendation…',
  ],
  merging: [
    'Approving the pull request…',
    'Merging changes to main…',
    'Updating the deployment registry…',
    'Almost there…',
  ],
}

type DeployedInfo = {
  summary: string | null
  confidence: number | null
  filePath: string | null
  prUrl: string | null
  prNumber: number | null
  branch: string | null
}

type ChangesetItem = { path: string; newContent: string }

function StepRow({ step, phase, activePhases }: { step: Step; phase: Phase; activePhases: Phase[] }) {
  const done = activePhases.includes(step.id)
    ? activePhases.indexOf(step.id) < activePhases.indexOf(phase)
    : false
  const active = step.id === phase
  const pending = !done && !active

  return (
    <div className={cn('flex items-center gap-2.5 text-xs transition-all duration-300', {
      'text-healthy': done,
      'text-foreground font-medium': active,
      'text-muted-foreground/40': pending,
    })}>
      <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all', {
        'border-healthy bg-healthy/15 text-healthy': done,
        'border-ai bg-ai/10 text-ai': active,
        'border-border/30 bg-transparent': pending,
      })}>
        {done ? <CheckCircle2 className="h-3 w-3" /> : step.icon}
      </div>
      <span>{step.label}</span>
      {active && <Loader2 className="h-3 w-3 animate-spin text-ai ml-auto" />}
    </div>
  )
}

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
  canMerge: boolean
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState<Phase>('pulling')
  const [msgIdx, setMsgIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [filePathInput, setFilePathInput] = useState('')
  const [deployed, setDeployed] = useState<DeployedInfo | null>(null)
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Rotate loading messages every 2.2 s
  useEffect(() => {
    msgTimer.current = setInterval(() => setMsgIdx((i) => i + 1), 2200)
    return () => { if (msgTimer.current) clearInterval(msgTimer.current) }
  }, [phase])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    void runAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Full automated pipeline: generate → open PR → merge
  async function runAll(explicitPath?: string) {
    setError(null)
    setCandidates([])

    // ── Step 1-3: generate fix ─────────────────────────────────────────────
    setPhase('pulling')
    await pause(600)
    setPhase('analyzing')

    const genRes = await fetch('/api/fix/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId, filePath: explicitPath }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Network error' }))

    if (!genRes.ok) {
      if (genRes.needsFileSelection) {
        setCandidates(genRes.candidates ?? [])
        setPhase('needs_file')
        setError(genRes.error ?? 'Could not identify the file automatically.')
        return
      }
      const msg: string = genRes.error ?? 'Failed to generate a fix'
      if (msg.toLowerCase().includes('no repository') || msg.toLowerCase().includes('no credential')) {
        setPhase('no_repo'); return
      }
      setError(msg); setPhase('failed'); return
    }

    setPhase('writing')
    await pause(500)

    const changeset: ChangesetItem[] = genRes.changes ?? []
    const filePath = changeset[0]?.path ?? null

    // ── Step 4: open PR ────────────────────────────────────────────────────
    setPhase('opening_pr')
    const prRes = await fetch('/api/fix/open-pr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId, changeset }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Network error' }))

    if (!prRes.ok) {
      setError(prRes.error ?? 'Failed to open a pull request')
      setPhase('failed'); return
    }

    // ── Step 5: merge ──────────────────────────────────────────────────────
    setPhase('merging')

    if (!canMerge) {
      setDeployed({ summary: genRes.summary, confidence: genRes.confidence, filePath, prUrl: prRes.prUrl, prNumber: prRes.prNumber, branch: prRes.branch })
      setPhase('deployed')
      return
    }

    const mergeRes = await fetch('/api/fix/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Network error' }))

    if (!mergeRes.ok) {
      if (mergeRes.blockedByProtection) {
        setError(mergeRes.error); setPhase('blocked'); return
      }
      setError(mergeRes.error ?? 'Merge failed'); setPhase('failed'); return
    }

    setDeployed({ summary: genRes.summary, confidence: genRes.confidence, filePath, prUrl: prRes.prUrl, prNumber: prRes.prNumber, branch: prRes.branch })
    setPhase('deployed')
  }

  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const activePhaseOrder: Phase[] = ['pulling', 'analyzing', 'writing', 'opening_pr', 'merging', 'deployed']
  const currentMsg = PHASE_MESSAGES[phase]?.[msgIdx % (PHASE_MESSAGES[phase]?.length ?? 1)] ?? ''
  const isTerminal = ['deployed', 'failed', 'blocked', 'no_repo', 'needs_file'].includes(phase)

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 transition-opacity duration-200',
      mounted ? 'opacity-100' : 'opacity-0',
    )}>
      <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-6 pt-5 pb-4">
          <div className="min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-ai">Execute fix</span>
            <h2 className="mt-0.5 text-sm font-semibold text-foreground leading-snug line-clamp-2">{title}</h2>
          </div>
          {isTerminal && (
            <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Progress steps — shown while running */}
          {!isTerminal && (
            <div className="space-y-2.5">
              {STEPS.map((s) => (
                <StepRow key={s.id} step={s} phase={phase} activePhases={activePhaseOrder} />
              ))}
              <p className="mt-3 text-xs text-muted-foreground animate-pulse pl-7">{currentMsg}</p>
            </div>
          )}

          {/* Deployed — success screen */}
          {phase === 'deployed' && deployed && (
            <div className="space-y-4">
              {/* Hero badge */}
              <div className="flex items-center gap-3 rounded-xl border border-healthy/30 bg-healthy/5 px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-healthy/15">
                  <Rocket className="h-4.5 w-4.5 text-healthy" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-healthy">Deployed to main</p>
                  <p className="text-xs text-muted-foreground">Changes are live in your repository</p>
                </div>
              </div>

              {/* Fix summary */}
              {deployed.summary && (
                <div className="rounded-xl border border-border/50 bg-background/50 px-4 py-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">What changed</p>
                  <p className="text-sm text-foreground leading-relaxed">{deployed.summary}</p>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-2">
                {deployed.filePath && (
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <FileCode2 className="h-3 w-3" /> File changed
                    </div>
                    <p className="font-mono text-[11px] text-foreground truncate">{deployed.filePath.split('/').pop()}</p>
                    <p className="font-mono text-[9px] text-muted-foreground truncate">{deployed.filePath}</p>
                  </div>
                )}
                {deployed.branch && (
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <GitBranch className="h-3 w-3" /> Branch
                    </div>
                    <p className="font-mono text-[11px] text-foreground truncate">{deployed.branch}</p>
                    <p className="text-[9px] text-muted-foreground">merged → main</p>
                  </div>
                )}
                {deployed.confidence != null && (
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <Sparkles className="h-3 w-3" /> AI confidence
                    </div>
                    <p className="text-sm font-semibold text-ai">{deployed.confidence}%</p>
                  </div>
                )}
                {deployed.prNumber && (
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <GitPullRequest className="h-3 w-3" /> Pull request
                    </div>
                    <p className="text-sm font-semibold text-foreground">#{deployed.prNumber}</p>
                  </div>
                )}
              </div>

              {/* PR link + deployments link */}
              <div className="flex flex-wrap gap-2">
                {deployed.prUrl && (
                  <a
                    href={deployed.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <GitPullRequest className="h-3.5 w-3.5" /> View PR on GitHub <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
                <Link
                  href="/deployments"
                  onClick={onClose}
                  className="flex items-center gap-1.5 rounded-lg border border-ai/30 bg-ai/10 px-3 py-2 text-xs font-medium text-ai hover:bg-ai/20 transition-colors"
                >
                  <Rocket className="h-3.5 w-3.5" /> View in Deployment Intelligence
                </Link>
              </div>
            </div>
          )}

          {/* Deployed — PR opened but can't merge */}
          {phase === 'deployed' && !canMerge && deployed && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5 text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
              <p className="text-xs text-muted-foreground">PR opened — only owners/admins can merge. Share the link above for approval.</p>
            </div>
          )}

          {/* No file found */}
          {phase === 'needs_file' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                <p className="text-sm text-foreground">{error}</p>
              </div>
              {candidates.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">Best matches from your repo — click one:</p>
                  <div className="space-y-1.5">
                    {candidates.map((c) => (
                      <button
                        key={c}
                        onClick={() => runAll(c)}
                        className="block w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left font-mono text-xs text-foreground hover:bg-accent hover:border-ai/40 transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Or enter a different path:</p>
                </>
              )}
              {candidates.length === 0 && (
                <p className="text-xs text-muted-foreground">Enter the repo-relative path of the file to fix:</p>
              )}
              <div className="flex gap-2">
                <input
                  value={filePathInput}
                  onChange={(e) => setFilePathInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && filePathInput.trim() && runAll(filePathInput.trim())}
                  placeholder="src/path/to/file.ts"
                  className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ai/30"
                />
                <button
                  onClick={() => filePathInput.trim() && runAll(filePathInput.trim())}
                  className="rounded-lg bg-ai px-3 py-2 text-xs font-medium text-ai-foreground hover:opacity-90"
                >
                  Run fix
                </button>
              </div>
            </div>
          )}

          {/* No repo */}
          {phase === 'no_repo' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 px-4 py-3">
                <GitBranch className="h-5 w-5 shrink-0 text-warning mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">No repository connected</p>
                  <p className="mt-1 text-xs text-muted-foreground">Connect a GitHub repo in App Settings to enable Execute Fix.</p>
                </div>
              </div>
              <ol className="space-y-1 rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground list-decimal list-inside">
                <li>Open App Settings for this project</li>
                <li>Scroll to <strong className="text-foreground">Repository</strong></li>
                <li>Click <strong className="text-foreground">GitHub</strong> → complete OAuth</li>
                <li>Click <strong className="text-foreground">Pick repo</strong> to select your repo</li>
              </ol>
              <Link href={`/apps/${projectId}`} onClick={onClose} className="flex items-center gap-2 rounded-lg border border-ai/30 bg-ai/10 px-4 py-2.5 text-sm font-medium text-ai hover:bg-ai/20 transition-colors">
                <Settings className="h-4 w-4" /> Open App Settings
              </Link>
            </div>
          )}

          {/* Blocked or failed */}
          {(phase === 'blocked' || phase === 'failed') && (
            <div className="flex items-start gap-2.5 rounded-lg border border-critical/25 bg-critical/5 px-3 py-2.5 text-sm text-critical">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{phase === 'blocked' ? 'Blocked by branch protection' : 'Failed'}</p>
                <p className="mt-0.5 text-xs text-critical/80">{error}</p>
                {phase === 'blocked' && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Temporarily disable branch protection rules in GitHub and re-run, or merge the PR manually.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isTerminal && (
          <div className="border-t border-border/60 px-6 py-4 flex justify-end">
            <button onClick={onClose} className="rounded-lg border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
