'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, XCircle, X, GitBranch, ExternalLink,
  ShieldAlert, Settings, Rocket, FileCode2, Sparkles, GitMerge,
  GitPullRequest, Search, Wrench,
} from 'lucide-react'

type Phase =
  | 'pulling'
  | 'analyzing'
  | 'writing'
  | 'opening_pr'
  | 'merging'
  | 'deployed'
  | 'needs_file'
  | 'no_repo'
  | 'failed'
  | 'blocked'

const PIPELINE: Phase[] = ['pulling', 'analyzing', 'writing', 'opening_pr', 'merging', 'deployed']

type StepDef = { id: Phase; label: string; icon: React.ElementType; color: string }
const STEPS: StepDef[] = [
  { id: 'pulling',    label: 'Reading source',  icon: Search,        color: 'text-intel' },
  { id: 'analyzing',  label: 'Analyzing code',   icon: Sparkles,      color: 'text-ai' },
  { id: 'writing',    label: 'Writing fix',      icon: Wrench,        color: 'text-warning' },
  { id: 'opening_pr', label: 'Creating PR',      icon: GitPullRequest, color: 'text-intel' },
  { id: 'merging',    label: 'Merging to main',  icon: GitMerge,      color: 'text-healthy' },
  { id: 'deployed',   label: 'Deployed',         icon: CheckCircle2,  color: 'text-healthy' },
]

const PHASE_MESSAGES: Record<Phase, string[]> = {
  pulling:    ['Connecting to GitHub…', 'Reading source files…', 'Locating the affected code…', 'Fetching file contents…'],
  analyzing:  ['Claude is reading the code…', 'Cross-referencing telemetry with source…', 'Identifying exact lines to change…', 'Understanding the root cause deeply…'],
  writing:    ['Writing the fix…', 'Crafting a surgical patch…', 'Applying the change…', 'Verifying fix logic…'],
  opening_pr: ['Creating a new branch…', 'Committing the changes…', 'Opening pull request on GitHub…', 'Linking PR to this recommendation…'],
  merging:    ['Approving the pull request…', 'Merging changes into main…', 'Recording in Deployment Intelligence…', 'Almost there…'],
  deployed:   [],
  needs_file: [],
  no_repo:    [],
  failed:     [],
  blocked:    [],
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

function stepIndex(phase: Phase) {
  return PIPELINE.indexOf(phase)
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

  useEffect(() => {
    msgTimer.current = setInterval(() => setMsgIdx((i) => i + 1), 2400)
    return () => { if (msgTimer.current) clearInterval(msgTimer.current) }
  }, [phase])

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { void runAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runAll(explicitPath?: string) {
    setError(null); setCandidates([])

    setPhase('pulling'); await pause(700)
    setPhase('analyzing')

    const genRes = await fetch('/api/fix/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId, filePath: explicitPath }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Network error' }))

    if (!genRes.ok) {
      if (genRes.needsFileSelection) {
        setCandidates(genRes.candidates ?? []); setPhase('needs_file')
        setError(genRes.error ?? 'Could not identify the file automatically.'); return
      }
      const msg: string = genRes.error ?? 'Failed to generate a fix'
      if (msg.toLowerCase().includes('no repository') || msg.toLowerCase().includes('no credential')) {
        setPhase('no_repo'); return
      }
      setError(msg); setPhase('failed'); return
    }

    setPhase('writing'); await pause(500)

    const changeset: ChangesetItem[] = genRes.changes ?? []
    const filePath = changeset[0]?.path ?? null

    setPhase('opening_pr')
    const prRes = await fetch('/api/fix/open-pr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId, changeset }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Network error' }))

    if (!prRes.ok) { setError(prRes.error ?? 'Failed to open a pull request'); setPhase('failed'); return }

    setPhase('merging')

    if (!canMerge) {
      setDeployed({ summary: genRes.summary, confidence: genRes.confidence, filePath, prUrl: prRes.prUrl, prNumber: prRes.prNumber, branch: prRes.branch })
      setPhase('deployed'); return
    }

    const mergeRes = await fetch('/api/fix/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, recommendationId }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Network error' }))

    if (!mergeRes.ok) {
      if (mergeRes.blockedByProtection) { setError(mergeRes.error); setPhase('blocked'); return }
      setError(mergeRes.error ?? 'Merge failed'); setPhase('failed'); return
    }

    setDeployed({ summary: genRes.summary, confidence: genRes.confidence, filePath, prUrl: prRes.prUrl, prNumber: prRes.prNumber, branch: prRes.branch })
    setPhase('deployed')
  }

  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const isTerminal = ['deployed', 'failed', 'blocked', 'no_repo', 'needs_file'].includes(phase)
  const isRunning = !isTerminal
  const currentMsg = PHASE_MESSAGES[phase]?.[msgIdx % (PHASE_MESSAGES[phase]?.length ?? 1)] ?? ''
  const activeIdx = stepIndex(phase)
  const progressPct = activeIdx < 0 ? 0 : Math.round((activeIdx / (PIPELINE.length - 1)) * 100)

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 transition-opacity duration-300',
      mounted ? 'opacity-100' : 'opacity-0',
    )}>
      <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden">

        {/* Progress bar — fills as steps complete */}
        <div className="h-0.5 w-full bg-border/30">
          <div
            className="h-full bg-gradient-to-r from-ai to-healthy transition-all duration-700 ease-out"
            style={{ width: phase === 'deployed' ? '100%' : `${progressPct}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border/60">
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

          {/* ── Running: step pipeline ─────────────────────────────────── */}
          {isRunning && (
            <div className="space-y-1">
              {STEPS.map((s, i) => {
                const idx = PIPELINE.indexOf(s.id)
                const done  = idx < activeIdx
                const active = s.id === phase
                const ahead  = idx > activeIdx

                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300',
                      active  && 'bg-ai/8 border border-ai/20 shadow-sm',
                      done    && 'opacity-60',
                      ahead   && 'opacity-25',
                    )}
                  >
                    {/* Step number / check */}
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                      done   && 'bg-healthy/15 text-healthy',
                      active && 'bg-ai/15 text-ai ring-2 ring-ai/30',
                      ahead  && 'bg-muted/30 text-muted-foreground',
                    )}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <span>{i + 1}</span>}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium leading-none',
                        done   && 'text-healthy',
                        active && 'text-foreground',
                        ahead  && 'text-muted-foreground',
                      )}>
                        <s.icon className={cn('mr-1.5 inline h-3.5 w-3.5', s.color)} />{s.label}
                      </p>
                      {active && (
                        <p className="mt-1 text-xs text-muted-foreground animate-pulse">
                          {currentMsg}
                        </p>
                      )}
                    </div>

                    {/* Spinner for active */}
                    {active && (
                      <div className="shrink-0 h-4 w-4 rounded-full border-2 border-ai border-t-transparent animate-spin" />
                    )}
                    {done && (
                      <span className="shrink-0 text-[10px] text-healthy font-medium">Done</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Deployed: success ──────────────────────────────────────── */}
          {phase === 'deployed' && deployed && (
            <div className="space-y-4">
              {/* Hero */}
              <div className="rounded-xl bg-gradient-to-br from-healthy/10 to-ai/5 border border-healthy/25 px-5 py-4 flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-healthy/20">
                  <Rocket className="h-6 w-6 text-healthy" />
                </div>
                <div>
                  <p className="text-base font-bold text-healthy">Deployed to main</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Changes are live in your repository</p>
                </div>
              </div>

              {/* What changed */}
              {deployed.summary && (
                <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">What changed</p>
                  <p className="text-sm text-foreground leading-relaxed">{deployed.summary}</p>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-2">
                {deployed.filePath && (
                  <div className="rounded-lg border border-border/50 bg-background px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <FileCode2 className="h-3 w-3" /> File changed
                    </div>
                    <p className="font-mono text-[11px] text-foreground font-medium truncate">{deployed.filePath.split('/').pop()}</p>
                    <p className="font-mono text-[9px] text-muted-foreground truncate mt-0.5">{deployed.filePath}</p>
                  </div>
                )}
                {deployed.branch && (
                  <div className="rounded-lg border border-border/50 bg-background px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <GitBranch className="h-3 w-3" /> Branch
                    </div>
                    <p className="font-mono text-[11px] text-foreground font-medium truncate">{deployed.branch}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">merged → main</p>
                  </div>
                )}
                {deployed.confidence != null && (
                  <div className="rounded-lg border border-border/50 bg-background px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <Sparkles className="h-3 w-3" /> AI confidence
                    </div>
                    <p className="text-lg font-bold text-ai">{deployed.confidence}%</p>
                  </div>
                )}
                {deployed.prNumber && (
                  <div className="rounded-lg border border-border/50 bg-background px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      <GitPullRequest className="h-3 w-3" /> Pull request
                    </div>
                    <p className="text-lg font-bold text-foreground">#{deployed.prNumber}</p>
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-2">
                {deployed.prUrl && (
                  <a href={deployed.prUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                    <GitMerge className="h-3.5 w-3.5" /> View PR on GitHub <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
                <Link href="/deployments" onClick={onClose}
                  className="flex items-center gap-1.5 rounded-lg border border-ai/30 bg-ai/10 px-3 py-2 text-xs font-medium text-ai hover:bg-ai/20 transition-colors">
                  <Rocket className="h-3.5 w-3.5" /> Deployment Intelligence
                </Link>
              </div>

              {!canMerge && (
                <p className="text-[11px] text-muted-foreground">PR opened — only owners/admins can merge. Share the link above for approval.</p>
              )}
            </div>
          )}

          {/* ── Needs file ─────────────────────────────────────────────── */}
          {phase === 'needs_file' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                <p className="text-sm text-foreground">{error}</p>
              </div>
              {candidates.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">Best matches — click one:</p>
                  <div className="space-y-1.5">
                    {candidates.map((c) => (
                      <button key={c} onClick={() => runAll(c)}
                        className="block w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left font-mono text-xs text-foreground hover:bg-accent hover:border-ai/40 transition-colors">
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Or enter a different path:</p>
                </>
              )}
              {candidates.length === 0 && <p className="text-xs text-muted-foreground">Enter the repo-relative path:</p>}
              <div className="flex gap-2">
                <input value={filePathInput} onChange={(e) => setFilePathInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && filePathInput.trim() && runAll(filePathInput.trim())}
                  placeholder="src/path/to/file.ts"
                  className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ai/30" />
                <button onClick={() => filePathInput.trim() && runAll(filePathInput.trim())}
                  className="rounded-lg bg-ai px-3 py-2 text-xs font-medium text-ai-foreground hover:opacity-90">
                  Run fix
                </button>
              </div>
            </div>
          )}

          {/* ── No repo ────────────────────────────────────────────────── */}
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
                <li>Open App Settings → <strong className="text-foreground">Repository</strong></li>
                <li>Click <strong className="text-foreground">GitHub</strong> → complete OAuth</li>
                <li>Click <strong className="text-foreground">Pick repo</strong> to select your repo</li>
              </ol>
              <Link href={`/apps/${projectId}`} onClick={onClose}
                className="flex items-center gap-2 rounded-lg border border-ai/30 bg-ai/10 px-4 py-2.5 text-sm font-medium text-ai hover:bg-ai/20 transition-colors">
                <Settings className="h-4 w-4" /> Open App Settings
              </Link>
            </div>
          )}

          {/* ── Blocked / Failed ───────────────────────────────────────── */}
          {(phase === 'blocked' || phase === 'failed') && (
            <div className="flex items-start gap-2.5 rounded-lg border border-critical/25 bg-critical/5 px-3 py-2.5">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-critical" />
              <div>
                <p className="text-sm font-semibold text-critical">{phase === 'blocked' ? 'Blocked by branch protection' : 'Failed'}</p>
                <p className="mt-0.5 text-xs text-critical/80">{error}</p>
                {phase === 'blocked' && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Disable branch protection in GitHub settings, or merge the PR manually.</p>
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
