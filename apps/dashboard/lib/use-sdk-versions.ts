'use client'

import { useEffect, useState } from 'react'
import {
  LATEST_SDK_VERSIONS,
  mergeRemoteCatalog,
  resolvedLatestVersion,
  isSdkOutdated,
  buildSdkUpgradePrompt,
  isNpmSdkPlatform,
  DATABASE_PLATFORMS,
  shouldCheckSdkUpgrade,
} from '@/lib/sdk-versions'

type VersionsState = {
  versions: Record<string, string>
  ready: boolean
}

let cached: Record<string, string> | null = null

/** Latest SDK versions — remote catalog when available, bundled fallback otherwise. */
export function useSdkVersions(): VersionsState {
  const [versions, setVersions] = useState<Record<string, string>>(
    cached ?? LATEST_SDK_VERSIONS,
  )
  const [ready, setReady] = useState(Boolean(cached))

  useEffect(() => {
    if (cached) return

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-sdk-versions`
    fetch(url, {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
    })
      .then((r) => r.json())
      .then((body) => {
        if (body?.versions) {
          cached = mergeRemoteCatalog(body.versions as Record<string, string>)
          setVersions(cached)
        }
      })
      .catch(() => { /* bundled fallback */ })
      .finally(() => setReady(true))
  }, [])

  return { versions, ready }
}

export function latestForPlatformRemote(
  versions: Record<string, string>,
  platform: string,
): string {
  return resolvedLatestVersion(versions, platform)
}

export {
  isSdkOutdated,
  buildSdkUpgradePrompt,
  isNpmSdkPlatform,
  DATABASE_PLATFORMS,
  shouldCheckSdkUpgrade,
  mergeRemoteCatalog,
  resolvedLatestVersion,
}
