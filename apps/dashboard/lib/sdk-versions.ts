/** Canonical latest SDK versions — update when publishing new SDK releases. */
export const LATEST_SDK_VERSIONS: Record<string, string> = {
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

export function parseSemver(v: string): [number, number, number] {
  const parts = v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

export function isSdkOutdated(installed: string, latest: string): boolean {
  const a = parseSemver(installed)
  const b = parseSemver(latest)
  if (a[0] !== b[0]) return a[0] < b[0]
  if (a[1] !== b[1]) return a[1] < b[1]
  return a[2] < b[2]
}

export function latestForPlatform(platform: string): string {
  const key = platform.toLowerCase()
  return LATEST_SDK_VERSIONS[key] ?? LATEST_SDK_VERSIONS.web
}

/** Agent-ready prompt for upgrading the PAAQ SDK in a connected project. */
export function buildSdkUpgradePrompt(platform: string, current: string, latest: string): string {
  const pkg = platform === 'nodejs' ? '@paaq/mcp-server' : '@paaq/web-sdk'
  return `Upgrade the PAAQ SDK for this project from v${current} to v${latest} (${platform}).

1. Update the package: npm install ${pkg}@${latest}
2. Ensure init still passes projectId and sdkToken from the PAAQ dashboard Connect page.
3. Verify performance monitoring is enabled (installPerfMonitoring runs after init in v1.2+).
4. Confirm X-SDK-Version header reports ${latest} on sdk-init and heartbeat calls.
5. Run the app and confirm events appear in the PAAQ dashboard within 60 seconds.`
}
