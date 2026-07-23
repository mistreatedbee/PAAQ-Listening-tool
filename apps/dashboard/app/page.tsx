'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  BrainCircuit, Sparkles, Shield, Zap, Route, Bug, BarChart3,
  ArrowRight, GitBranch, CheckCircle, Activity, Eye, Bell,
} from 'lucide-react'

const STATS = [
  { label: 'Events Processed Daily', value: '2.4M+' },
  { label: 'AI Analyses Run', value: '180K+' },
  { label: 'Mean Time to Resolution', value: '< 4 min' },
  { label: 'Platform Uptime', value: '99.98%' },
]

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'Application Knowledge Graph',
    desc: 'AI builds a deep understanding of your architecture — features, APIs, journeys, and services — before analysing a single incident.',
  },
  {
    icon: Bug,
    title: 'Intelligent Error Analysis',
    desc: 'Every error gets root cause identification, ranked fix steps, and a confidence score. Generated in seconds, not hours.',
  },
  {
    icon: Route,
    title: 'User Journey Intelligence',
    desc: 'Track and understand every path users take. Detect drop-offs, correlate with errors, and surface friction automatically.',
  },
  {
    icon: Activity,
    title: 'Real-time Event Monitoring',
    desc: 'Capture every interaction across web, iOS, Android, and Flutter. Sub-second ingestion. Instant alerting.',
  },
  {
    icon: Eye,
    title: 'AI Incident Investigation',
    desc: 'Agents that correlate telemetry, deployments, and architecture to explain what happened and what to do next.',
  },
  {
    icon: Shield,
    title: 'Security Intelligence',
    desc: 'Detect anomalous patterns, unusual access, and potential threats. Correlate with your feature and API context.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Install the SDK',
    desc: 'One integration across all platforms. Flutter, React, iOS, Android, Node.js. Up in minutes.',
  },
  {
    step: '02',
    title: 'Import Your Knowledge',
    desc: 'Connect GitHub, import OpenAPI specs, upload docs. The AI builds a Knowledge Graph of your application.',
  },
  {
    step: '03',
    title: 'Monitor & Understand',
    desc: 'Every event, error, and journey is enriched with architectural context. AI explains incidents in terms your team understands.',
  },
]

function Grain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
      }}
    />
  )
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#060b10', color: '#e8f0f8' }}>
      <Grain />

      {/* Nav */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(6,11,16,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #27A6CE, #5FDED4)' }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-black tracking-tight" style={{ color: '#e8f0f8' }}>
            PAAQ Intelligence
          </span>
        </div>

        <nav className="hidden items-center gap-6 sm:flex">
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Platform', href: '#platform' },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm transition-colors"
              style={{ color: '#8ba0b4' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e8f0f8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8ba0b4')}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ color: '#e8f0f8', borderColor: 'rgba(255,255,255,0.18)' }}
          >
            Log in
          </Link>
          <Link
            href="/login?tab=signup"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)' }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
        {/* Glow orbs */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #27A6CE 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="pointer-events-none absolute left-1/4 top-2/3 h-[300px] w-[300px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #5FDED4 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="relative z-10 max-w-4xl">
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(81,201,211,0.08)', border: '1px solid rgba(81,201,211,0.2)', color: '#51C9D3' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#51C9D3] animate-pulse" />
            Phase 2.5 · Application Knowledge Layer
          </div>

          <h1
            className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            style={{ color: '#e8f0f8' }}
          >
            The AI that{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #27A6CE 0%, #51C9D3 50%, #5FDED4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              understands
            </span>
            <br />
            your application
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: '#8ba0b4' }}>
            PAAQ Intelligence goes beyond monitoring. It builds a Knowledge Graph of your architecture,
            features, APIs, and user journeys — then uses that context to explain every incident like
            a senior engineer who has been with your team for months.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login?tab=signup"
              className="group flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)', boxShadow: '0 0 40px rgba(81,201,211,0.25)' }}
            >
              Start monitoring free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e8f0f8',
              }}
            >
              View dashboard demo
            </Link>
          </div>

          {/* Stat row */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <p
                  className="text-2xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, #51C9D3, #5FDED4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {s.value}
                </p>
                <p className="mt-1 text-xs" style={{ color: '#5a7080' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" style={{ color: '#5a7080' }}>
          <div className="h-6 w-px mx-auto" style={{ background: 'linear-gradient(to bottom, transparent, #5a7080)' }} />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#51C9D3' }}>
              Capabilities
            </p>
            <h2 className="text-4xl font-black tracking-tight" style={{ color: '#e8f0f8' }}>
              Not just monitoring. Understanding.
            </h2>
            <p className="mt-4 text-base" style={{ color: '#8ba0b4' }}>
              Every feature is designed to give your AI the context it needs to reason — not just observe.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl p-6 transition-all duration-300 hover:scale-[1.01]"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(81,201,211,0.04)'
                    e.currentTarget.style.borderColor = 'rgba(81,201,211,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                  }}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(81,201,211,0.10)' }}
                  >
                    <Icon className="h-5 w-5" style={{ color: '#51C9D3' }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: '#e8f0f8' }}>{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: '#8ba0b4' }}>{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative px-6 py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(39,166,206,0.08) 0%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: '#51C9D3' }}>
              Getting started
            </p>
            <h2 className="text-4xl font-black tracking-tight" style={{ color: '#e8f0f8' }}>
              Up and running in minutes
            </h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative flex flex-col">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div
                    className="absolute top-5 left-full hidden w-full lg:block"
                    style={{ height: '1px', background: 'linear-gradient(to right, rgba(81,201,211,0.3), transparent)', width: '100%', transform: 'translateX(1.5rem)' }}
                  />
                )}
                <div
                  className="mb-4 text-4xl font-black tabular-nums"
                  style={{
                    background: 'linear-gradient(135deg, #27A6CE, #5FDED4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {step.step}
                </div>
                <h3 className="mb-2 text-base font-bold" style={{ color: '#e8f0f8' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#8ba0b4' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform callout */}
      <section id="platform" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div
            className="relative overflow-hidden rounded-3xl p-10 text-center lg:p-16"
            style={{ background: 'linear-gradient(135deg, rgba(39,166,206,0.12) 0%, rgba(95,222,212,0.08) 100%)', border: '1px solid rgba(81,201,211,0.15)' }}
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #27A6CE 0%, transparent 70%)', filter: 'blur(60px)' }}
            />

            <div className="relative z-10">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#51C9D3' }}>
                Multi-platform
              </p>
              <h2 className="text-3xl font-black tracking-tight lg:text-4xl" style={{ color: '#e8f0f8' }}>
                One SDK. Every platform.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: '#8ba0b4' }}>
                Flutter, React Native, iOS, Android, React, Next.js, Node.js.
                Drop in one package and every platform reports to a unified intelligence hub.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {['Flutter', 'React', 'iOS Swift', 'Android', 'Node.js', 'Next.js'].map((p) => (
                  <span
                    key={p}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#e8f0f8' }}
                  >
                    {p}
                  </span>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/login?tab=signup"
                  className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #27A6CE, #51C9D3)' }}
                >
                  <Sparkles className="h-4 w-4" />
                  Start for free
                </Link>
                <Link
                  href="https://github.com"
                  className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8f0f8' }}
                >
                  <GitBranch className="h-4 w-4" />
                  View on GitHub
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg"
              style={{ background: 'linear-gradient(135deg, #27A6CE, #5FDED4)' }}
            >
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-black" style={{ color: '#e8f0f8' }}>PAAQ Intelligence</span>
          </div>
          <p className="text-xs" style={{ color: '#3a5060' }}>© 2025 PAAQ. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs transition-colors" style={{ color: '#5a7080' }}>Sign in</Link>
            <Link href="/login?tab=signup" className="text-xs transition-colors" style={{ color: '#5a7080' }}>Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
