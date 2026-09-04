'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { cn } from '@/lib/utils'

type Props = {
  projectId: string
  projectName: string
  className?: string
  onRemoved?: () => void
}

export function RemoveApplicationPanel({ projectId, projectName, className, onRemoved }: Props) {
  const router = useRouter()
  const { reloadApps, allApps } = useConnectedApp()
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameMatches = confirmName.trim() === projectName.trim()
  const otherApps = allApps.filter((a) => a.id !== projectId)

  async function handleRemove() {
    if (!nameMatches || removing) return

    setRemoving(true)
    setError(null)

    try {
      const res = await fetch('/api/projects/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Failed to remove application')
        return
      }

      setOpen(false)
      setConfirmName('')
      reloadApps()
      onRemoved?.()

      if (otherApps.length > 0) {
        router.push('/setup')
      } else {
        router.push('/admin/tenants/new')
      }
    } catch {
      setError('Failed to remove application')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className={cn('rounded-2xl border border-critical/30 bg-critical/5', className)}>
      <div className="flex items-start gap-3 px-5 py-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Remove application</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Archives this application, revokes its SDK keys, and removes it from your workspace.
            Historical data is kept but the SDK will stop sending events.
          </p>
        </div>
      </div>

      {!open ? (
        <div className="border-t border-critical/20 px-5 py-4">
          <button
            type="button"
            onClick={() => { setOpen(true); setError(null) }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-critical/40 bg-background px-3 py-2 text-xs font-semibold text-critical hover:bg-critical/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove application
          </button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-critical/20 px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Type <span className="font-semibold text-foreground">{projectName}</span> to confirm.
          </p>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={projectName}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-critical/20"
            autoComplete="off"
          />
          {error && (
            <p className="text-xs text-critical">{error}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRemove}
              disabled={!nameMatches || removing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-critical px-3 py-2 text-xs font-semibold text-white hover:bg-critical/90 disabled:opacity-50"
            >
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remove permanently
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmName(''); setError(null) }}
              disabled={removing}
              className="rounded-lg border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
