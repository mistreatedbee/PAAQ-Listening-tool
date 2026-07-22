'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { platformIcon, timeAgo, fmt } from '@/lib/admin-utils'
import type { SdkInstallation } from '@/lib/admin-types'
import { Cpu, ArrowUpRight } from 'lucide-react'

type SdkRelease = {
  platform: string
  version: string
  released: string
  status: 'stable' | 'beta' | 'deprecated'
  downloads: number
  changelog: string
}

const SDK_RELEASES: SdkRelease[] = [
  { platform: 'flutter', version: '1.2.4', released: '2026-07-15', status: 'stable', downloads: 8420, changelog: 'Improved session tracking, bug fixes for Agora reconnect.' },
  { platform: 'react',   version: '1.1.9', released: '2026-07-10', status: 'stable', downloads: 5311, changelog: 'React 19 compat, reduced bundle size by 18%.' },
  { platform: 'nextjs',  version: '1.1.3', released: '2026-07-08', status: 'stable', downloads: 3102, changelog: 'App Router support, Server Component-safe initialisation.' },
  { platform: 'android', version: '1.0.7', released: '2026-06-28', status: 'stable', downloads: 2841, changelog: 'Android 14 compat, OkHttp retry logic.' },
  { platform: 'ios',     version: '1.0.5', released: '2026-06-20', status: 'stable', downloads: 2109, changelog: 'Swift 5.10 support, URLSession improvements.' },
  { platform: 'nodejs',  version: '1.0.2', released: '2026-06-15', status: 'beta',   downloads: 987,  changelog: 'Beta: Express middleware, Winston log bridge.' },
]

export default function SdkManagementPage() {
  const [installations, setInstallations] = useState<SdkInstallation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .from('sdk_installations')
      .select('*')
      .order('last_seen', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setInstallations((data ?? []) as SdkInstallation[])
        setLoading(false)
      })
  }, [])

  const byPlatform = SDK_RELEASES.reduce<Record<string, number>>((acc, r) => {
    const count = installations.filter((i) => i.platform === r.platform).length
    acc[r.platform] = count
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>SDK Management</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          SDK releases, compatibility, and live installation tracking
        </p>
      </div>

      {/* Release cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {SDK_RELEASES.map((sdk) => (
          <div key={sdk.platform} className="admin-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{platformIcon(sdk.platform)}</span>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>{sdk.platform}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--accent)' }}>v{sdk.version}</p>
                </div>
              </div>
              <span className={`badge ${sdk.status === 'stable' ? 'badge-healthy' : sdk.status === 'beta' ? 'badge-warning' : 'badge-critical'}`}>
                {sdk.status}
              </span>
            </div>

            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{sdk.changelog}</p>

            <div className="mt-3 flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Released {new Date(sdk.released).toLocaleDateString()}</span>
              <span>·</span>
              <span>{fmt(sdk.downloads)} downloads</span>
              <span>·</span>
              <span>{byPlatform[sdk.platform] ?? 0} live installs</span>
            </div>
          </div>
        ))}
      </div>

      {/* Live installations */}
      <div className="admin-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Live SDK Installations ({installations.length})
          </h2>
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : installations.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Cpu className="h-8 w-8 mx-auto" style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No SDK installations tracked yet. Installations appear once SDKs call home.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Platform', 'Version', 'App Version', 'First Seen', 'Last Seen', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {installations.map((inst) => (
                <tr key={inst.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-5 py-3">{platformIcon(inst.platform)} {inst.platform}</td>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--accent)' }}>v{inst.sdk_version}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>—</td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(inst.first_seen)}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(inst.last_seen)}</td>
                  <td className="px-5 py-3"><span className={`badge ${inst.status === 'active' ? 'badge-healthy' : 'badge-muted'}`}>{inst.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
