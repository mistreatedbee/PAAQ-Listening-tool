'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import {
  useSdkVersions,
  latestForPlatformRemote,
  isSdkOutdated,
  buildSdkUpgradePrompt,
} from '@/lib/use-sdk-versions'
import { Rocket, X, Copy, Check } from 'lucide-react'

type Installation = {
  id: string
  platform: string
  sdk_version: string
  last_seen: string
}

export function SdkUpdateBanner() {
  const { app } = useConnectedApp()
  const { versions } = useSdkVersions()
  const [outdated, setOutdated] = useState<Installation[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (projectId: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-sdk-updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ project_id: projectId }),
      })
    } catch { /* best-effort */ }

    const sb = createClient()
    const { data } = await sb
      .from('sdk_installations')
      .select('id, platform, sdk_version, last_seen')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('last_seen', { ascending: false })

    const stale = (data ?? []).filter((inst) =>
      isSdkOutdated(inst.sdk_version, latestForPlatformRemote(versions, inst.platform)),
    ) as Installation[]
    setOutdated(stale)
  }, [versions])

  useEffect(() => {
    if (app.id === '__loading__') return
    load(app.id)
  }, [app.id, load, versions])

  if (dismissed || outdated.length === 0) return null

  const primary = outdated[0]
  const latest = latestForPlatformRemote(versions, primary.platform)
  const prompt = buildSdkUpgradePrompt(primary.platform, primary.sdk_version, latest)

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border-b border-ai/20 bg-ai/[0.06] px-4 py-2.5">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-ai" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              SDK update available — {primary.platform} v{primary.sdk_version} → v{latest}
              {outdated.length > 1 ? ` (+${outdated.length - 1} more)` : ''}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              A newer SDK is available. Copy the agent prompt below to upgrade your connected app.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={copyPrompt}
            className="flex items-center gap-1.5 rounded-lg border border-ai/30 bg-ai/10 px-3 py-1.5 text-[11px] font-medium text-ai hover:bg-ai/20"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy agent prompt'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
