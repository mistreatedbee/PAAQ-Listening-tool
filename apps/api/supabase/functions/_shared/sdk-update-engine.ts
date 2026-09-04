import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LATEST: Record<string, string> = {
  react: '1.2.7',
  nextjs: '1.2.7',
  vue: '1.2.7',
  vanilla: '1.2.7',
  web: '1.2.7',
  nodejs: '1.2.6',
  python: '1.0.0',
  'react-native': '1.0.0',
  ios: '1.0.0',
  android: '1.0.0',
}

function parseVer(v: string): [number, number, number] {
  const p = v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0]
}

function isOlder(installed: string, latest: string): boolean {
  const a = parseVer(installed)
  const b = parseVer(latest)
  if (a[0] !== b[0]) return a[0] < b[0]
  if (a[1] !== b[1]) return a[1] < b[1]
  return a[2] < b[2]
}

function latestFor(platform: string): string {
  return LATEST[platform.toLowerCase()] ?? LATEST.web
}

function upgradePrompt(platform: string, current: string, latest: string): string {
  const pkg = platform === 'nodejs' ? '@paaq/mcp-server' : '@paaq/web-sdk'
  return `Copy this agent prompt: Upgrade PAAQ SDK ${platform} v${current} → v${latest}. Run npm install ${pkg}@${latest}, re-init with your dashboard SDK token, and verify X-SDK-Version is ${latest}.`
}

export type SyncSdkUpdatesResult = { notified: number; outdated: number }

/** Create in-app notifications for SDK installations running behind latest. */
export async function syncSdkUpdateNotifications(
  supabase: SupabaseClient,
  projectId: string,
): Promise<SyncSdkUpdatesResult> {
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: installations } = await supabase
    .from('sdk_installations')
    .select('id, platform, sdk_version, last_seen')
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
    const latest = latestFor(inst.platform)
    if (!isOlder(inst.sdk_version, latest)) continue
    if (seenPlatforms.has(inst.platform)) continue
    seenPlatforms.add(inst.platform)
    outdated++

    if (existingPlatforms.has(inst.platform)) continue

    const message = `SDK update available: ${inst.platform} v${inst.sdk_version} → v${latest}. ${upgradePrompt(inst.platform, inst.sdk_version, latest)}`

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
