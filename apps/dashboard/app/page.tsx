'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Sparkles, ArrowRight, Check, ChevronDown, BrainCircuit,
  Bug, Route, Activity, Eye, Shield, Zap, BarChart3,
  Code2, Smartphone, Globe, Users, Lock, Layers, GitBranch,
  CheckCircle, TrendingUp, Star, Cpu, Bell,
} from 'lucide-react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: BrainCircuit, title: 'Application Knowledge Graph', color: '#51C9D3',
    desc: 'AI builds a deep model of your architecture — features, APIs, journeys, and services — before analysing a single event.' },
  { icon: Bug, title: 'Intelligent Error Analysis', color: '#5FDED4',
    desc: 'Every crash gets root cause identification, ranked fix steps, and a confidence score. In seconds, not hours.' },
  { icon: Route, title: 'User Journey Intelligence', color: '#27A6CE',
    desc: 'Track every path users take. Detect drop-offs, correlate with errors, and surface friction automatically.' },
  { icon: Activity, title: 'Real-time Event Monitoring', color: '#51C9D3',
    desc: 'Capture every interaction across Flutter, iOS, Android, React, and Node.js. Sub-second ingestion. Instant alerting.' },
  { icon: Eye, title: 'AI Incident Investigation', color: '#5FDED4',
    desc: 'Six specialist agents correlate telemetry, deployments, and architecture to explain what happened and what to fix.' },
  { icon: Shield, title: 'Security Intelligence', color: '#27A6CE',
    desc: 'Detect anomalous patterns, unusual access, and potential threats — correlated with your feature and API context.' },
]

const PLATFORMS = [
  { label: 'Flutter', icon: '🦋' },
  { label: 'React', icon: '⚛️' },
  { label: 'Next.js', icon: '▲' },
  { label: 'iOS Swift', icon: '🍎' },
  { label: 'Android', icon: '🤖' },
  { label: 'Node.js', icon: '🟢' },
]

const PRICING = [
  {
    name: 'Starter', price: 'Free', period: '',
    desc: 'For indie developers and small teams.',
    highlight: false, cta: 'Start free', href: '/login?tab=signup',
    features: ['25,000 events / month', '1 project', '7-day data retention',
      'Basic AI insights', 'SDK for all platforms', 'Community support'],
  },
  {
    name: 'Growth', price: '$79', period: '/ month',
    desc: 'For growing teams that need advanced AI and scale.',
    highlight: true, cta: 'Start free trial', href: '/login?tab=signup',
    features: ['1M events / month', 'Unlimited projects', '90-day data retention',
      'Advanced AI insights', 'AI Agents (6 specialists)', 'Custom alerts & webhooks',
      'API access', 'Priority email support'],
  },
  {
    name: 'Enterprise', price: 'Custom', period: '',
    desc: 'For large teams with enterprise requirements.',
    highlight: false, cta: 'Talk to sales', href: 'mailto:sales@paaq.ai',
    features: ['Unlimited events', 'Unlimited projects', 'Custom data retention',
      'Custom AI model training', 'Dedicated support & SLA', 'SSO / SAML',
      'On-premise option', 'Custom integrations'],
  },
]

const TESTIMONIALS = [
  { quote: 'PAAQ found a root cause in 3 minutes that our team had been debugging for 2 days. The AI context is remarkable.', name: 'Sarah Chen', role: 'CTO, FinFlow', stars: 5 },
  { quote: 'The Knowledge Graph is unlike anything else. It actually understands our product — not just raw events.', name: 'Marcus Reid', role: 'VP Engineering, Taskify', stars: 5 },
  { quote: 'Onboarding took 4 minutes. By end of day we had AI insights on our mobile app we\'d never seen before.', name: 'Aisha Nkosi', role: 'Head of Product, Edara', stars: 5 },
]

const FAQ_ITEMS = [
  { q: 'What is PAAQ Intelligence?',
    a: 'PAAQ Intelligence is an AI-powered product monitoring platform. It monitors your application, detects issues, analyses root causes, and helps your team resolve them faster. Unlike traditional monitoring, PAAQ builds a Knowledge Graph of your product so insights are contextual — not generic.' },
  { q: 'Which platforms does the SDK support?',
    a: 'We support Flutter, React, Next.js, iOS (Swift), Android (Kotlin), and Node.js. All SDKs share a consistent API and take under 5 minutes to integrate.' },
  { q: 'How long does setup take?',
    a: 'Under 5 minutes. The guided wizard walks you through creating your organisation, workspace, and project — then gives you real code snippets with your credentials embedded.' },
  { q: 'How does the AI intelligence work?',
    a: 'After connecting your app, PAAQ builds a Knowledge Graph from your events, errors, sessions, and any imported docs or API specs. Six specialist AI agents continuously analyse this knowledge to surface insights, investigate incidents, and recommend fixes.' },
  { q: 'Is my data secure?',
    a: 'Yes. All data is encrypted in transit and at rest. We use row-level security to ensure complete tenant isolation — no customer can access another\'s data. You can export or delete your data at any time.' },
  { q: 'Can I monitor multiple apps?',
    a: 'Yes. You can create unlimited projects under your organisation (on Growth and Enterprise plans). Each project has its own credentials, events, insights, and settings.' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Grain() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.022]"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat' }} />
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b cursor-pointer" style={{ borderColor: 'rgba(255,255,255,0.08)' }} onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between py-5">
        <span className="text-sm font-semibold pr-8" style={{ color: '#e8f0f8' }}>{q}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" style={{ color: '#51C9D3', transform: open ? 'rotate(180deg)' : 'none' }} />
      </div>
      {open && <p className="pb-5 text-sm leading-relaxed" style={{ color: '#8ba0b4' }}>{a}</p>}
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest mb-4"
      style={{ borderColor: 'rgba(81,201,211,0.3)', color: '#51C9D3', background: 'rgba(81,201,211,0.06)' }}>
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#060b10', color: '#e8f0f8' }}>
      <Grain />

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300"
        style={{ background: scrolled ? 'rgba(6,11,16,0.94)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg,#27A6CE,#5FDED4)' }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-black tracking-tight" style={{ color: '#e8f0f8' }}>PAAQ</p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#51C9D3' }}>Intelligence</p>
          </div>
        </div>

        <nav className="hidden items-center gap-7 sm:flex">
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'FAQ', href: '#faq' },
          ].map((l) => (
            <a key={l.href} href={l.href} className="text-sm transition-colors" style={{ color: '#8ba0b4' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e8f0f8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8ba0b4')}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg border px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ color: '#e8f0f8', borderColor: 'rgba(255,255,255,0.18)' }}>
            Log in
          </Link>
          <Link href="/login?tab=signup" className="rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' }}>
            Start free
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center pt-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle,#27A6CE 0%,transparent 70%)', filter: 'blur(90px)' }} />
        <div className="pointer-events-none absolute left-1/4 top-2/3 h-[300px] w-[300px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#5FDED4 0%,transparent 70%)', filter: 'blur(60px)' }} />
        <div className="pointer-events-none absolute right-1/4 top-1/4 h-[200px] w-[200px] rounded-full opacity-08"
          style={{ background: 'radial-gradient(circle,#51C9D3 0%,transparent 70%)', filter: 'blur(40px)' }} />

        <div className="relative z-10 max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold"
            style={{ borderColor: 'rgba(81,201,211,0.4)', background: 'rgba(81,201,211,0.08)', color: '#51C9D3' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            Now in early access
          </div>

          <h1 className="mb-6 text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl" style={{ color: '#e8f0f8' }}>
            Build products your{' '}
            <span style={{ backgroundImage: 'linear-gradient(90deg,#51C9D3,#27A6CE,#5FDED4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI understands
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed" style={{ color: '#8ba0b4' }}>
            PAAQ Intelligence continuously monitors your application, detects issues before users notice them,
            explains root causes in plain language, and helps your team resolve incidents in minutes — not days.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/login?tab=signup" className="flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)', boxShadow: '0 0 40px rgba(81,201,211,0.25)' }}>
              Start free — no credit card <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how" className="flex items-center gap-2 rounded-xl border px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.14)', color: '#8ba0b4' }}>
              See how it works
            </a>
          </div>

          <p className="mt-5 text-xs" style={{ color: 'rgba(139,160,180,0.6)' }}>
            Free tier includes 25,000 events/month · Setup in under 5 minutes
          </p>
        </div>

        {/* Product preview mockup */}
        <div className="relative z-10 mt-16 w-full max-w-5xl">
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(10,16,24,0.8)', boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(81,201,211,0.1)' }}>
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="mx-auto text-xs" style={{ color: '#4a5568' }}>PAAQ Intelligence — dashboard.paaq.ai</span>
            </div>
            {/* Fake dashboard */}
            <div className="grid grid-cols-12 gap-0">
              {/* Sidebar */}
              <div className="col-span-2 border-r p-3 space-y-1" style={{ borderColor: 'rgba(255,255,255,0.04)', minHeight: '280px' }}>
                {['Dashboard', 'Live Events', 'Errors', 'AI Insights', 'Journeys', 'Incidents'].map((item, i) => (
                  <div key={item} className={`rounded-lg px-2 py-1.5 text-[10px] font-medium ${i === 0 ? 'text-white' : ''}`}
                    style={{ background: i === 0 ? 'rgba(81,201,211,0.12)' : 'transparent', color: i === 0 ? '#51C9D3' : '#4a5568' }}>
                    {item}
                  </div>
                ))}
              </div>
              {/* Main */}
              <div className="col-span-10 p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Events today', value: '12,847', color: '#51C9D3' },
                    { label: 'Active users', value: '1,293', color: '#5FDED4' },
                    { label: 'Error rate', value: '0.12%', color: '#27A6CE' },
                    { label: 'AI insights', value: '7 new', color: '#51C9D3' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-[9px] mb-1" style={{ color: '#4a5568' }}>{kpi.label}</p>
                      <p className="text-sm font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-[9px] mb-2" style={{ color: '#4a5568' }}>Event stream</p>
                    <div className="space-y-1">
                      {['user_signup · 2s ago', 'payment_success · 5s ago', 'session_start · 8s ago', 'error.NullPointer · 12s ago'].map((e, i) => (
                        <div key={e} className="flex items-center gap-2 text-[9px]">
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: i === 3 ? '#ef4444' : '#51C9D3' }} />
                          <span style={{ color: i === 3 ? '#ef4444' : '#5a7085' }}>{e}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(81,201,211,0.2)', background: 'rgba(81,201,211,0.04)' }}>
                    <p className="text-[9px] mb-2" style={{ color: '#51C9D3' }}>AI insight</p>
                    <p className="text-[9px] leading-relaxed" style={{ color: '#8ba0b4' }}>NullPointer exception in checkout flow detected. Root cause: unhandled null in PaymentService.processCard(). Fix confidence: 94%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 rounded-b-2xl" style={{ background: 'linear-gradient(to top, #060b10, transparent)' }} />
        </div>
      </section>

      {/* ── Trust bar ────────────────────────────────────────────────────────── */}
      <section className="border-y py-8" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5568' }}>
            Built for every platform
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {PLATFORMS.map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#5a7085' }}>
                <span className="text-lg">{p.icon}</span>
                {p.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { value: '2.4M+', label: 'Events processed daily' },
              { value: '180K+', label: 'AI analyses run' },
              { value: '< 4 min', label: 'Mean time to resolution' },
              { value: '99.98%', label: 'Platform uptime' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black mb-1" style={{ backgroundImage: 'linear-gradient(135deg,#51C9D3,#27A6CE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {s.value}
                </p>
                <p className="text-xs" style={{ color: '#5a7085' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <SectionLabel>Platform capabilities</SectionLabel>
            <h2 className="text-3xl font-black sm:text-4xl" style={{ color: '#e8f0f8' }}>Everything your team needs</h2>
            <p className="mt-3 text-base max-w-xl mx-auto" style={{ color: '#8ba0b4' }}>
              From real-time event capture to AI-generated incident reports — all in one platform.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border p-6 transition-all hover:border-opacity-60"
                style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(81,201,211,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${f.color}18` }}>
                  <f.icon className="h-5 w-5" style={{ color: f.color }} />
                </div>
                <h3 className="mb-2 text-sm font-bold" style={{ color: '#e8f0f8' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#8ba0b4' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Intelligence ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-y" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(81,201,211,0.03)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <SectionLabel>AI Intelligence</SectionLabel>
            <h2 className="text-3xl font-black sm:text-4xl" style={{ color: '#e8f0f8' }}>
              Six specialist AI agents working for you
            </h2>
            <p className="mt-3 text-base max-w-xl mx-auto" style={{ color: '#8ba0b4' }}>
              Not a chatbot. Dedicated agents that continuously analyse your product and act proactively.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Bug, name: 'Error Analyst', desc: 'Root cause analysis for every exception, crash, and warning.' },
              { icon: Route, name: 'Journey Detective', desc: 'Tracks user flows and detects where experiences break down.' },
              { icon: TrendingUp, name: 'Performance Guard', desc: 'Monitors latency, load times, and throughput regressions.' },
              { icon: Shield, name: 'Security Sentinel', desc: 'Detects anomalous access patterns and auth events.' },
              { icon: Bell, name: 'Incident Commander', desc: 'Correlates events across systems to explain incidents.' },
              { icon: Cpu, name: 'Knowledge Builder', desc: 'Continuously enriches the Knowledge Graph from new data.' },
            ].map((a) => (
              <div key={a.name} className="flex gap-4 rounded-2xl border p-5" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(81,201,211,0.12)' }}>
                  <a.icon className="h-4 w-4" style={{ color: '#51C9D3' }} />
                </div>
                <div>
                  <p className="text-sm font-bold mb-1" style={{ color: '#e8f0f8' }}>{a.name}</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#8ba0b4' }}>{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section id="how" className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="text-3xl font-black sm:text-4xl" style={{ color: '#e8f0f8' }}>Up and running in minutes</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { step: '01', icon: Code2, title: 'Install the SDK', desc: 'One SDK for all platforms. Flutter, React, iOS, Android, Node.js. Add two lines of code and you\'re monitoring.' },
              { step: '02', icon: BrainCircuit, title: 'AI learns your product', desc: 'Connect GitHub, import API specs, or let PAAQ infer your architecture from live events. The Knowledge Graph builds automatically.' },
              { step: '03', icon: Sparkles, title: 'Get intelligent insights', desc: 'AI agents start surfacing insights within minutes. Incidents are investigated, root causes identified, fixes ranked.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(81,201,211,0.1)', border: '1px solid rgba(81,201,211,0.2)' }}>
                  <s.icon className="h-6 w-6" style={{ color: '#51C9D3' }} />
                </div>
                <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#51C9D3' }}>{s.step}</div>
                <h3 className="mb-2 text-base font-bold" style={{ color: '#e8f0f8' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#8ba0b4' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionLabel>Security & privacy</SectionLabel>
              <h2 className="text-3xl font-black mb-4" style={{ color: '#e8f0f8' }}>Enterprise-grade security built in</h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: '#8ba0b4' }}>
                Security is not a feature — it's the foundation. Every piece of customer data is isolated, encrypted, and protected.
              </p>
              <div className="space-y-3">
                {['Row-level security — complete tenant data isolation', 'AES-256 encryption at rest and TLS in transit', 'Audit logs for all account actions', 'SDK credential rotation without downtime', 'CSRF protection and secure session handling', 'Configurable data retention and deletion'].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#51C9D3' }} />
                    <span className="text-sm" style={{ color: '#8ba0b4' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Lock, label: 'Encrypted storage' },
                { icon: Shield, label: 'Tenant isolation' },
                { icon: Users, label: 'Role-based access' },
                { icon: GitBranch, label: 'Audit trail' },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center"
                  style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(81,201,211,0.1)' }}>
                    <item.icon className="h-5 w-5" style={{ color: '#51C9D3' }} />
                  </div>
                  <p className="text-xs font-semibold" style={{ color: '#8ba0b4' }}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="text-3xl font-black sm:text-4xl" style={{ color: '#e8f0f8' }}>Simple, transparent pricing</h2>
            <p className="mt-3 text-base" style={{ color: '#8ba0b4' }}>Start free. Scale when you need to.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {PRICING.map((plan) => (
              <div key={plan.name} className="relative flex flex-col rounded-2xl border p-6"
                style={{
                  borderColor: plan.highlight ? '#51C9D3' : 'rgba(255,255,255,0.07)',
                  background: plan.highlight ? 'rgba(81,201,211,0.06)' : 'rgba(255,255,255,0.02)',
                  boxShadow: plan.highlight ? '0 0 40px rgba(81,201,211,0.1)' : 'none',
                }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                    style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)' }}>
                    Most popular
                  </div>
                )}
                <div className="mb-4">
                  <p className="text-sm font-bold mb-1" style={{ color: plan.highlight ? '#51C9D3' : '#8ba0b4' }}>{plan.name}</p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="text-3xl font-black" style={{ color: '#e8f0f8' }}>{plan.price}</span>
                    {plan.period && <span className="text-sm mb-1" style={{ color: '#5a7085' }}>{plan.period}</span>}
                  </div>
                  <p className="text-xs" style={{ color: '#5a7085' }}>{plan.desc}</p>
                </div>
                <div className="flex-1 space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#51C9D3' }} />
                      <span className="text-xs" style={{ color: '#8ba0b4' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href={plan.href} className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90"
                  style={plan.highlight ? { background: 'linear-gradient(135deg,#27A6CE,#51C9D3)', color: '#fff' } : { border: '1px solid rgba(255,255,255,0.15)', color: '#e8f0f8' }}>
                  {plan.cta} {plan.highlight && <ArrowRight className="h-3.5 w-3.5" />}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <SectionLabel>Customer stories</SectionLabel>
            <h2 className="text-3xl font-black sm:text-4xl" style={{ color: '#e8f0f8' }}>Loved by engineering teams</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="flex flex-col rounded-2xl border p-6"
                style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" style={{ color: '#51C9D3' }} />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed mb-4" style={{ color: '#8ba0b4' }}>"{t.quote}"</p>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#e8f0f8' }}>{t.name}</p>
                  <p className="text-xs" style={{ color: '#5a7085' }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="text-3xl font-black" style={{ color: '#e8f0f8' }}>Common questions</h2>
          </div>
          {FAQ_ITEMS.map((item) => <FAQItem key={item.q} {...item} />)}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="relative rounded-3xl border p-12 overflow-hidden"
            style={{ borderColor: 'rgba(81,201,211,0.2)', background: 'rgba(81,201,211,0.04)' }}>
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(81,201,211,0.12) 0%, transparent 70%)' }} />
            <Sparkles className="mx-auto mb-4 h-8 w-8 relative z-10" style={{ color: '#51C9D3' }} />
            <h2 className="text-3xl font-black mb-3 relative z-10" style={{ color: '#e8f0f8' }}>Start monitoring in 5 minutes</h2>
            <p className="mb-8 text-base relative z-10" style={{ color: '#8ba0b4' }}>
              Free tier, no credit card required. See your first AI insight before you finish your coffee.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center relative z-10">
              <Link href="/login?tab=signup" className="flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#27A6CE,#51C9D3)', boxShadow: '0 0 30px rgba(81,201,211,0.3)' }}>
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="mailto:hello@paaq.ai" className="flex items-center justify-center gap-2 rounded-xl border px-8 py-3.5 text-sm font-semibold transition-colors hover:bg-white/5"
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#8ba0b4' }}>
                Talk to us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t py-16 px-6" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg,#27A6CE,#5FDED4)' }}>
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="leading-none">
                  <p className="text-sm font-black" style={{ color: '#e8f0f8' }}>PAAQ Intelligence</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#5a7085' }}>
                AI-powered product monitoring for modern engineering teams.
              </p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'Changelog'] },
              { title: 'Docs', links: ['Getting Started', 'SDK Reference', 'API Reference', 'Status'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Cookies'] },
            ].map((col) => (
              <div key={col.title}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#4a5568' }}>{col.title}</p>
                <div className="space-y-2.5">
                  {col.links.map((link) => (
                    <a key={link} href="#" className="block text-sm transition-colors" style={{ color: '#5a7085' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#e8f0f8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#5a7085')}>
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: '#4a5568' }}>© 2025 PAAQ Intelligence. All rights reserved.</p>
            <p className="text-xs" style={{ color: '#4a5568' }}>Built for teams that care about their products.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
