'use client'

import { useState } from 'react'
import { Card, CardHead, Confidence } from '@/components/kit'
import { Sparkles, RefreshCw } from 'lucide-react'

export type SessionAiSummary = {
  narrative: string
  confidence: number | null
  generated_at: string
}

export function AiSummaryPanel({
  sessionId,
  summary,
  onGenerated,
}: {
  sessionId: string
  summary: SessionAiSummary | null
  onGenerated: (summary: SessionAiSummary) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/session-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Failed to generate summary')
      } else {
        onGenerated({ narrative: data.narrative, confidence: data.confidence, generated_at: new Date().toISOString() })
      }
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHead title="AI narrative" desc="A plain-language summary of this session" icon={<Sparkles className="h-4 w-4 text-ai" />} />
      <div className="px-5 pb-5">
        {summary ? (
          <>
            <p className="text-sm leading-relaxed text-foreground">{summary.narrative}</p>
            <div className="mt-3 flex items-center justify-between">
              {summary.confidence != null && <Confidence value={Math.round(summary.confidence * 100)} />}
              <button
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Regenerate
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">No summary generated yet.</p>
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Generating…' : 'Generate AI Summary'}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-critical">{error}</p>}
      </div>
    </Card>
  )
}
