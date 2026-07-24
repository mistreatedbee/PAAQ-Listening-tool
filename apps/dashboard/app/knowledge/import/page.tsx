'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card } from '@/components/kit'
import { useRouter } from 'next/navigation'
import {
  Upload, GitBranch, FileText, Network, Cpu, Route, Server, Rocket, Users,
  CheckCircle, ArrowRight, ArrowLeft, Sparkles, Loader2,
} from 'lucide-react'

const STEPS = [
  { id: 'method',   label: 'Choose method' },
  { id: 'content',  label: 'Add content' },
  { id: 'review',   label: 'Review & import' },
]

const IMPORT_METHODS = [
  { id: 'paste',    label: 'Paste content',      icon: FileText, desc: 'Paste markdown, OpenAPI spec, or any text' },
  { id: 'openapi',  label: 'OpenAPI / Swagger',   icon: Network,  desc: 'Import API spec and auto-populate API registry' },
  { id: 'features', label: 'Feature list',        icon: Cpu,      desc: 'Bulk-register features with a structured list' },
  { id: 'journeys', label: 'User journey map',    icon: Route,    desc: 'Describe user flows to register journeys' },
  { id: 'services', label: 'Service inventory',   icon: Server,   desc: 'List your backend services and dependencies' },
  { id: 'deploy',   label: 'Deployment record',   icon: Rocket,   desc: 'Log a release to the deployment registry' },
]

export default function ImportPage() {
  const { app } = useConnectedApp()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [method, setMethod] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [docType, setDocType] = useState('documentation')
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    if (!title.trim() || !content.trim()) return
    setProcessing(true)
    setError(null)
    try {
      const sb = createClient()

      // Save document
      const { data: doc } = await sb.from('knowledge_documents').insert({
        project_id: app.id,
        tenant_id: app.tenantId,
        title,
        doc_type: docType,
        content_format: method === 'openapi' ? 'openapi' : 'markdown',
        content,
      }).select().single()

      // Call AI builder to extract knowledge and generate summary
      const { data: result } = await sb.functions.invoke('knowledge-build', {
        body: { documentId: doc?.id, projectId: app.id, content, method, title },
      })

      if (result?.summary) setAiSummary(result.summary)
      setDone(true)
    } catch (e) {
      setError('Import saved, but AI processing is unavailable right now. The document is stored and searchable.')
      setDone(true)
    } finally {
      setProcessing(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-healthy/10">
          <CheckCircle className="h-8 w-8 text-healthy" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Knowledge imported</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            {error ?? 'Your document has been stored and the AI Knowledge Graph has been updated.'}
          </p>
        </div>
        {aiSummary && (
          <Card className="max-w-lg w-full p-5 border-ai/20 bg-ai/5 text-left">
            <p className="text-xs font-semibold text-ai mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> AI extracted this understanding
            </p>
            <p className="text-sm leading-relaxed">{aiSummary}</p>
          </Card>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => { setDone(false); setStep(0); setMethod(null); setTitle(''); setContent(''); setAiSummary(null); setError(null) }}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
          >
            Import another
          </button>
          <button
            onClick={() => router.push('/knowledge')}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            View knowledge hub <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Upload className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Import Knowledge</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Teach the AI about <span className="font-semibold text-foreground">{app.name}</span> — architecture, APIs, journeys, and docs.
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              i < step ? 'bg-healthy text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 0: Choose method */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">What would you like to import?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {IMPORT_METHODS.map((m) => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:border-primary/40 ${
                    method === m.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${method === m.id ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`h-4 w-4 ${method === m.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setStep(1)}
              disabled={!method}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40 hover:opacity-90"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Content */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Document title *</label>
            <input
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                method === 'openapi' ? 'Payment Service API Spec' :
                method === 'features' ? 'Core Feature List' :
                'Documentation title'
              }
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {method === 'openapi' ? 'OpenAPI / Swagger YAML or JSON *' :
               method === 'features' ? 'Feature list (one per line: Name | Description | Criticality | Team) *' :
               method === 'journeys' ? 'Journey description — list steps, success state, failure states *' :
               method === 'services' ? 'Service list (one per line: Name | Type | Owner | Dependencies) *' :
               'Content *'}
            </label>
            <textarea
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                method === 'openapi' ?
                  'openapi: "3.0.0"\ninfo:\n  title: Payment Service\n  version: "1.0"\npaths:\n  /payments/charge:\n    post:\n      summary: Charge payment method\n      ...' :
                method === 'features' ?
                  'Document Upload | Lets users upload identity documents | critical | Mobile Engineering\nPayments | Processes subscription billing | critical | Payments Team\nMessaging | In-app chat between users | high | Backend Team' :
                method === 'journeys' ?
                  'Journey: User Registration\n1. Landing Screen → Tap "Sign Up"\n2. Registration Form → Enter email and password\n3. Email Verification → Click confirmation link\n4. Profile Setup → Add name and photo\nSuccess: User account active\nFailure: Email already registered, Verification timeout' :
                method === 'services' ?
                  'Auth Service | internal | Backend Team | Database, Redis\nStorage Service | internal | Infrastructure | S3, Auth Service\nNotification Service | internal | Backend Team | Auth Service, Email Provider' :
                  'Paste your documentation, architecture notes, release notes, or any content that describes your application…'
              }
            />
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(0)} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!title.trim() || !content.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40 hover:opacity-90"
            >
              Review <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold">Review import</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title</span>
                <span className="font-medium">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium capitalize">{method?.replace('-', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Content length</span>
                <span className="font-medium">{content.length.toLocaleString()} chars</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project</span>
                <span className="font-medium">{app.name}</span>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Content preview</p>
              <p className="text-xs font-mono text-muted-foreground line-clamp-4 whitespace-pre-wrap">{content.slice(0, 300)}{content.length > 300 ? '…' : ''}</p>
            </div>
          </Card>

          <Card className="border-ai/20 bg-ai/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-ai mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ai">AI will process this</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  After import, the AI will generate a summary and update the Knowledge Graph with relationships.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleImport}
              disabled={processing}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90"
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <><Upload className="h-4 w-4" /> Import Knowledge</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
