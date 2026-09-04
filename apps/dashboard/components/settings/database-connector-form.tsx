'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card } from '@/components/kit'
import { Database, CheckCircle2, Loader2, XCircle, RefreshCw, Trash2 } from 'lucide-react'

type Engine = 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'supabase'

const ENGINES: { value: Engine; label: string; beta?: boolean }[] = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'mysql', label: 'MySQL', beta: true },
  { value: 'mongodb', label: 'MongoDB', beta: true },
  { value: 'sqlite', label: 'SQLite (via Turso/libSQL)', beta: true },
  { value: 'redis', label: 'Redis', beta: true },
]

type Status = {
  connected: boolean
  engine?: Engine
  displayHost?: string | null
  displayDatabase?: string | null
  displayUsername?: string | null
  lastTestAt?: string | null
  lastTestOk?: boolean | null
  tableCount?: number
}

type Step = 'connect' | 'introspect' | 'readonly'
const STEP_LABELS: Record<Step, string> = {
  connect: 'Connect',
  introspect: 'Introspect schema',
  readonly: 'Verify read-only',
}

const ERROR_MESSAGES: Record<string, string> = {
  bad_host: 'Could not reach the host — check the hostname and port.',
  auth_failed: 'Authentication failed — check the username and password.',
  not_read_only: 'This credential has write access. PAAQ requires a read-only user — see the setup steps below.',
  unsupported_engine: 'Unsupported database engine.',
  invalid_auth: 'Could not authenticate this request — try refreshing the page.',
  unknown: 'Something went wrong testing this connection.',
}

const READONLY_SETUP: Partial<Record<Engine, { title: string; steps: string[]; sql?: string }>> = {
  postgres: {
    title: 'PostgreSQL read-only user',
    steps: [
      'Run the SQL below in your database (as an admin user).',
      'Build a connection string with the new user: postgresql://paaq_readonly:YOUR_PASSWORD@HOST:5432/DATABASE',
      'Do not use the default postgres superuser — it always has write access.',
    ],
    sql: `-- Run while connected to your target database
CREATE ROLE paaq_readonly WITH LOGIN PASSWORD 'choose_a_strong_password';

GRANT USAGE ON SCHEMA public TO paaq_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO paaq_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO paaq_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO paaq_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO paaq_readonly;`,
  },
  supabase: {
    title: 'Supabase read-only user',
    steps: [
      'Open your Supabase project → SQL Editor and run the SQL below.',
      'Use the direct (not pooler) connection string with the new user from Project Settings → Database.',
      'Never paste the service_role key or the postgres superuser string — both have full write access.',
    ],
    sql: `-- Supabase: read-only role for PAAQ (run in SQL Editor)
CREATE ROLE paaq_readonly WITH LOGIN PASSWORD 'choose_a_strong_password';

GRANT USAGE ON SCHEMA public TO paaq_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO paaq_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO paaq_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO paaq_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO paaq_readonly;`,
  },
  mysql: {
    title: 'MySQL read-only user',
    steps: [
      'Create a user with SELECT only on your database.',
      'Example: CREATE USER \'paaq_readonly\'@\'%\' IDENTIFIED BY \'password\'; GRANT SELECT ON mydb.* TO \'paaq_readonly\'@\'%\';',
    ],
  },
}

async function fetchCredentials(projectId: string) {
  const sb = createClient()
  const { data } = await sb
    .from('access_tokens')
    .select('token')
    .eq('project_id', projectId)
    .eq('token_type', 'sdk_token')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return data?.token as string | undefined
}

export function DatabaseConnectorForm() {
  const { app } = useConnectedApp()
  const [sdkToken, setSdkToken] = useState<string | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)

  const [engine, setEngine] = useState<Engine>('postgres')
  const [connectionString, setConnectionString] = useState('')
  const [testing, setTesting] = useState(false)
  const [testPassed, setTestPassed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [retesting, setRetesting] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [currentStep, setCurrentStep] = useState<Step | null>(null)
  const [errorCategory, setErrorCategory] = useState<string | null>(null)
  const [failedStep, setFailedStep] = useState<Step | null>(null)
  const [showReadonlyHelp, setShowReadonlyHelp] = useState(false)

  async function callConnector(sdkTok: string, action: string, body: Record<string, unknown> = {}) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/db-connector`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sdkTok}`,
        'X-Project-ID': app.apiKey,
      },
      body: JSON.stringify({ action, ...body }),
    })
    return res.json()
  }

  useEffect(() => {
    if (app.id === '__loading__') return
    let cancelled = false
    fetchCredentials(app.id).then(async (token) => {
      if (cancelled || !token) { setLoading(false); return }
      setSdkToken(token)
      const data = await callConnector(token, 'status')
      if (!cancelled) {
        setStatus(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id])

  const resetTestState = () => {
    setTestPassed(false)
    setErrorCategory(null)
    setFailedStep(null)
    setCurrentStep(null)
  }

  const handleTest = async () => {
    if (!sdkToken || !connectionString.trim()) return
    setTesting(true)
    resetTestState()
    setCurrentStep('connect')
    const data = await callConnector(sdkToken, 'test', { engine, connectionString: connectionString.trim() })
    setTesting(false)
    if (data.ok) {
      setTestPassed(true)
      setCurrentStep(null)
    } else {
      setFailedStep((data.step as Step) ?? 'connect')
      setErrorCategory(data.errorCategory ?? 'unknown')
      setCurrentStep(null)
      if (data.errorCategory === 'not_read_only') setShowReadonlyHelp(true)
    }
  }

  const handleSave = async () => {
    if (!sdkToken || !testPassed) return
    setSaving(true)
    const data = await callConnector(sdkToken, 'save', { engine, connectionString: connectionString.trim() })
    setSaving(false)
    if (data.connected) {
      setStatus(data)
      setConnectionString('') // never keep the raw secret in memory longer than necessary
      setTestPassed(false)
      setReplacing(false)
    } else {
      setErrorCategory(data.errorCategory ?? 'unknown')
      setFailedStep((data.step as Step) ?? null)
    }
  }

  const handleRetest = async () => {
    if (!sdkToken) return
    setRetesting(true)
    const data = await callConnector(sdkToken, 'retest')
    setRetesting(false)
    if (data.connected) setStatus(data)
    else setStatus((prev) => (prev ? { ...prev, lastTestOk: false } : prev))
  }

  const handleDisconnect = async () => {
    if (!sdkToken) return
    await callConnector(sdkToken, 'disconnect')
    setStatus({ connected: false })
    setReplacing(false)
  }

  if (loading) {
    return (
      <Card className="p-5">
        <div className="h-20 animate-pulse rounded-md bg-muted" />
      </Card>
    )
  }

  const showForm = !status?.connected || replacing
  const readonlyGuide = READONLY_SETUP[engine]

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Database className="h-5 w-5 text-ai shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Database Connector</p>
          <p className="text-xs text-muted-foreground mt-1">
            PAAQ uses read-only access to understand your schema — table and column names only,
            never row data. Every connection is verified as read-only before it's saved, and the
            connection string is encrypted at rest and never shown again once saved.
          </p>
        </div>
      </div>

      {!showForm && status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-healthy/30 bg-healthy/5 px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-healthy shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {ENGINES.find((e) => e.value === status.engine)?.label ?? status.engine}
                {status.displayUsername ? `://${status.displayUsername}:••••••••` : '://••••••••'}
                {status.displayHost ? `@${status.displayHost}` : ''}
                {status.displayDatabase ? `/${status.displayDatabase}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status.tableCount ?? 0} table{status.tableCount === 1 ? '' : 's'} detected
                {status.lastTestAt ? ` · last tested ${new Date(status.lastTestAt).toLocaleString()}` : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRetest}
              disabled={retesting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              {retesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Re-test connection
            </button>
            <button
              onClick={() => setReplacing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Replace
            </button>
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 rounded-lg border border-critical/30 bg-critical/5 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Engine</label>
            <select
              value={engine}
              onChange={(e) => { setEngine(e.target.value as Engine); resetTestState() }}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ai/30"
            >
              {ENGINES.map((e) => (
                <option key={e.value} value={e.value}>{e.label}{e.beta ? ' (beta)' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Connection string</label>
            <input
              type="text"
              value={connectionString}
              onChange={(e) => { setConnectionString(e.target.value); resetTestState() }}
              placeholder="postgresql://readonly_user:password@host:5432/dbname"
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-xs focus:ring-2 focus:ring-ai/30"
            />
            {errorCategory && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-critical">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {ERROR_MESSAGES[errorCategory] ?? ERROR_MESSAGES.unknown}
                {failedStep && <span className="text-muted-foreground">({STEP_LABELS[failedStep]})</span>}
              </p>
            )}

            {readonlyGuide && (
              <details
                className="mt-3 rounded-lg border border-border/60 bg-muted/30"
                open={showReadonlyHelp || errorCategory === 'not_read_only'}
              >
                <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-foreground">
                  How to create a read-only user ({readonlyGuide.title})
                </summary>
                <div className="border-t border-border/50 px-3 py-3 space-y-2">
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-muted-foreground">
                    {readonlyGuide.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {readonlyGuide.sql && (
                    <div className="relative">
                      <pre className="overflow-x-auto rounded-md border border-border/50 bg-background p-2.5 font-mono text-[10px] text-foreground whitespace-pre-wrap">
                        {readonlyGuide.sql}
                      </pre>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(readonlyGuide.sql!)}
                        className="absolute right-2 top-2 rounded border border-border/60 bg-card px-2 py-0.5 text-[9px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        Copy SQL
                      </button>
                    </div>
                  )}
                </div>
              </details>
            )}
            {testPassed && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-healthy">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Connection verified — read-only confirmed.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing || !connectionString.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {currentStep ? STEP_LABELS[currentStep] + '…' : 'Testing…'}
                </>
              ) : (
                'Test connection'
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={!testPassed || saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-xs font-medium text-ai-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
            {replacing && (
              <button
                onClick={() => { setReplacing(false); setConnectionString(''); resetTestState() }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
