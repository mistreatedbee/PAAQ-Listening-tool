import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  isSdkOutdated,
  buildSdkUpgradePrompt,
  buildSdkReleaseMessage,
  LATEST_SDK_VERSIONS,
  mergeRemoteCatalog,
  resolvedLatestVersion,
  shouldCheckSdkUpgrade,
} from './sdk-versions.ts'

export type SyncSdkUpdatesResult = { notified: number; outdated: number }

/** Merge DB catalog with bundled defaults — bundled platforms always win. */
export async function loadLatestVersions(
  supabase: SupabaseClient,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('sdk_release_catalog')
    .select('platform, latest_version')

  if (error || !data?.length) return { ...LATEST_SDK_VERSIONS }

  const remote: Record<string, string> = {}
  for (const row of data) {
    remote[row.platform] = row.latest_version
  }
  return mergeRemoteCatalog(remote)
}

function latestFor(
  versions: Record<string, string>,
  platform: string,
): string {
  return resolvedLatestVersion(versions, platform)
}

/** Create in-app notifications for SDK installations running behind latest. */
export async function syncSdkUpdateNotifications(
  supabase: SupabaseClient,
  projectId: string,
): Promise<SyncSdkUpdatesResult> {
  const versions = await loadLatestVersions(supabase)
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: installations } = await supabase
    .from('sdk_installations')
    .select('id, platform, sdk_version, device_id, last_seen')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .gte('last_seen', recentCutoff)
    .order('last_seen', { ascending: false })

  const { data: existing } = await supabase
    .from('notifications')
    .select('id, message, type')
    .eq('project_id', projectId)
    .eq('type', 'sdk_update')
    .order('created_at', { ascending: false })
    .limit(50)

  const existingPlatforms = new Set(
    (existing ?? []).map((n) => {
      const m = String(n.message).match(/^SDK update available: (\w+)/)
      return m?.[1] ?? ''
    }).filter(Boolean),
  )

  let notified = 0
  let outdated = 0
  const seenPlatforms = new Set<string>()

  for (const inst of installations ?? []) {
    if (!shouldCheckSdkUpgrade(inst.platform, inst.sdk_version, inst.device_id)) continue
    const latest = latestFor(versions, inst.platform)
    if (!isSdkOutdated(inst.sdk_version, latest)) continue
    if (seenPlatforms.has(inst.platform)) continue
    seenPlatforms.add(inst.platform)
    outdated++

    if (existingPlatforms.has(inst.platform)) continue

    const message = `SDK update available: ${inst.platform} v${inst.sdk_version} → v${latest}. ${buildSdkUpgradePrompt(inst.platform, inst.sdk_version, latest)}`

    const { error } = await supabase.from('notifications').insert({
      project_id: projectId,
      type: 'sdk_update',
      message,
      severity: 'info',
      read: false,
    })

    if (!error) notified++
  }

  return { notified, outdated }
}

export type AnnounceSdkReleaseResult = {
  projects: number
  announced: number
  catalog_updated: number
}

/** Broadcast a new SDK publish to every project and refresh the version catalog. */
export async function announceSdkRelease(
  supabase: SupabaseClient,
  input: {
    packageName: string
    version: string
    platforms: string[]
    releaseNotes?: string
  },
): Promise<AnnounceSdkReleaseResult> {
  const { packageName, version, platforms, releaseNotes } = input
  let catalogUpdated = 0

  for (const platform of platforms) {
    const { error } = await supabase.from('sdk_release_catalog').upsert(
      {
        platform,
        package_name: packageName,
        latest_version: version,
        release_notes: releaseNotes ?? null,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'platform' },
    )
    if (!error) catalogUpdated++
  }

  const { data: projects } = await supabase.from('projects').select('id')
  const message = buildSdkReleaseMessage(packageName, version, platforms, releaseNotes)

  let announced = 0
  for (const project of projects ?? []) {
    const { data: prior } = await supabase
      .from('sdk_release_announcements')
      .select('id')
      .eq('project_id', project.id)
      .eq('package_name', packageName)
      .eq('version', version)
      .maybeSingle()

    if (prior) continue

    const { data: notification, error: notifyErr } = await supabase
      .from('notifications')
      .insert({
        project_id: project.id,
        type: 'sdk_update',
        message,
        severity: 'info',
        read: false,
      })
      .select('id')
      .single()

    if (notifyErr || !notification) continue

    await supabase.from('sdk_release_announcements').insert({
      project_id: project.id,
      package_name: packageName,
      version,
    })

    await syncSdkUpdateNotifications(supabase, project.id)
    announced++
  }

  return {
    projects: projects?.length ?? 0,
    announced,
    catalog_updated: catalogUpdated,
  }
}
