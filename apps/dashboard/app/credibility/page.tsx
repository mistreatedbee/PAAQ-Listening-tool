'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHead, ToneBadge, StatusDot } from '@/components/kit'
import { BadgeCheck, Linkedin, FileText, Award, User, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

type Signal = {
  id: string
  label: string
  desc: string
  Icon: typeof BadgeCheck
  count: number | null
  verified: number | null
  tone: Tone
  rate: number | null
}

type Profile = {
  id: string
  display_name: string | null
  email: string | null
  is_verified: boolean | null
  linkedin_url: string | null
  created_at: string
}

function pct(v: number, t: number) {
  if (t === 0) return 0
  return Math.round((v / t) * 100)
}

export default function CredibilityPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
      sb.from('profiles').select('*', { count: 'exact', head: true }).not('linkedin_url', 'is', null),
      sb.from('user_achievements').select('*', { count: 'exact', head: true }),
      sb.from('user_achievements').select('*', { count: 'exact', head: true }).eq('type', 'speaker_badge'),
      sb.from('profiles')
        .select('id, display_name, email, is_verified, linkedin_url, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]).then(([
      { count: totalProfiles },
      { count: verified },
      { count: linkedinLinked },
      { count: totalAchievements },
      { count: speakerBadges },
      { data: recentProfiles },
    ]) => {
      const total = totalProfiles ?? 0
      setSignals([
        {
          id: 'identity',
          label: 'Identity Verified',
          desc: 'Profiles that have completed identity verification (email, phone, or ID check)',
          Icon: User,
          count: total,
          verified: verified ?? 0,
          tone: pct(verified ?? 0, total) >= 75 ? 'healthy' : pct(verified ?? 0, total) >= 50 ? 'warning' : 'critical',
          rate: pct(verified ?? 0, total),
        },
        {
          id: 'linkedin',
          label: 'LinkedIn Linked',
          desc: 'Expert profiles with a verified LinkedIn URL attached',
          Icon: Linkedin,
          count: total,
          verified: linkedinLinked ?? 0,
          tone: pct(linkedinLinked ?? 0, total) >= 60 ? 'healthy' : pct(linkedinLinked ?? 0, total) >= 35 ? 'warning' : 'critical',
          rate: pct(linkedinLinked ?? 0, total),
        },
        {
          id: 'proof',
          label: 'Proof of Work',
          desc: 'Experts with at least one verified service, case study, or portfolio link',
          Icon: FileText,
          count: totalAchievements ?? 0,
          verified: totalAchievements ?? 0,
          tone: (totalAchievements ?? 0) > 0 ? 'healthy' : 'warning',
          rate: null,
        },
        {
          id: 'speaker',
          label: 'Speaker Badges',
          desc: 'Experts who have earned a speaker badge from attending verified events',
          Icon: Award,
          count: totalAchievements ?? 0,
          verified: speakerBadges ?? 0,
          tone: (speakerBadges ?? 0) > 0 ? 'healthy' : 'intel',
          rate: pct(speakerBadges ?? 0, totalAchievements ?? 0),
        },
      ])
      setProfiles((recentProfiles ?? []) as Profile[])
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ask/10">
          <BadgeCheck className="h-5 w-5 text-ask" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Credibility Signal Health</h1>
          <p className="text-xs text-muted-foreground">
            Expert identity verification, social proof, and achievement health across the PAAQ Ask module
          </p>
        </div>
      </div>

      {/* Signal cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl border border-border/40 bg-card/60" />
            ))
          : signals.map((s) => {
              const Icon = s.Icon
              return (
                <Card key={s.id} className="relative overflow-hidden">
                  <div className="absolute right-3 top-3 opacity-5">
                    <Icon className="h-16 w-16 text-ask" />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ask/10">
                        <Icon className="h-3.5 w-3.5 text-ask" />
                      </div>
                      <ToneBadge tone={s.tone} dot>
                        {s.tone === 'healthy' ? 'Healthy' : s.tone === 'warning' ? 'Attention' : s.tone === 'critical' ? 'Low' : 'Tracking'}
                      </ToneBadge>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      {s.rate !== null ? `${s.rate}%` : s.verified?.toLocaleString() ?? '—'}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-foreground">{s.label}</p>
                    <p className="mt-1 text-[10px] leading-tight text-muted-foreground line-clamp-2">{s.desc}</p>
                    {s.count !== null && s.rate !== null && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {s.verified?.toLocaleString()} / {s.count.toLocaleString()} profiles
                      </p>
                    )}
                  </div>
                </Card>
              )
            })}
      </div>

      {/* Recent expert profiles */}
      <Card>
        <CardHead
          title="Recent Expert Profiles"
          desc="Newest experts — check verification status and credibility signal completeness"
        />
        <div className="divide-y divide-border/40 px-5 pb-5">
          {loading
            ? Array(6).fill(0).map((_, i) => (
                <div key={i} className="py-3 flex gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-card" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 animate-pulse rounded bg-card" />
                    <div className="h-2.5 w-48 animate-pulse rounded bg-card" />
                  </div>
                </div>
              ))
            : profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ask/10 text-ask font-semibold text-sm">
                    {(p.display_name ?? p.email ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {p.display_name ?? p.email ?? p.id.slice(0, 12)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.email ?? 'No email'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.is_verified && <ToneBadge tone="healthy">Verified</ToneBadge>}
                    {p.linkedin_url && <ToneBadge tone="intel">LinkedIn</ToneBadge>}
                    {!p.is_verified && !p.linkedin_url && <ToneBadge tone="warning">Incomplete</ToneBadge>}
                  </div>
                </div>
              ))}
        </div>
      </Card>
    </div>
  )
}
