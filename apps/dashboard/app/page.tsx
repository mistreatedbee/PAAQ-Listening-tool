'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  BrainCircuit, Bug, Route, Activity, Eye, Shield,
  TrendingUp, Bell, Cpu, Code2, Sparkles, Lock,
  Users, GitBranch, Sun, Moon, Menu, X as XIcon,
  ChevronDown, ArrowRight,
} from 'lucide-react'
import { SiFlutter, SiReact, SiNextdotjs, SiSwift, SiAndroid, SiNodedotjs } from 'react-icons/si'
import './landing.css'

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { label: 'Flutter',   Icon: SiFlutter,   color: '#54C5F8' },
  { label: 'React',     Icon: SiReact,     color: '#61DAFB' },
  { label: 'Next.js',   Icon: SiNextdotjs, color: null },
  { label: 'iOS Swift', Icon: SiSwift,     color: '#F05138' },
  { label: 'Android',   Icon: SiAndroid,   color: '#3DDC84' },
  { label: 'Node.js',   Icon: SiNodedotjs, color: '#68A063' },
]

const FEATURES = [
  { Icon: BrainCircuit, title: 'Application Knowledge Graph', desc: 'Builds a deep model of your architecture — features, APIs, journeys, and services — before analysing a single event.', bg: 'rgba(81,201,211,0.12)', color: '#51C9D3' },
  { Icon: Bug,          title: 'Intelligent Error Analysis',  desc: 'Every crash gets root cause identification, ranked fix steps, and a confidence score. In seconds, not hours.',         bg: 'rgba(95,222,212,0.12)', color: '#5FDED4' },
  { Icon: Route,        title: 'User Journey Intelligence',   desc: 'Track every path users take. Detect drop-offs, correlate with errors, and surface friction automatically.',              bg: 'rgba(39,166,206,0.12)', color: '#27A6CE' },
  { Icon: Activity,     title: 'Real-time Event Monitoring',  desc: 'Capture every interaction across Flutter, iOS, Android, React, and Node.js. Sub-second ingestion. Instant alerting.',    bg: 'rgba(81,201,211,0.12)', color: '#51C9D3' },
  { Icon: Eye,          title: 'Incident Investigation',      desc: 'Six specialist agents correlate telemetry, deployments, and architecture to explain what happened and what to fix.',       bg: 'rgba(95,222,212,0.12)', color: '#5FDED4' },
  { Icon: Shield,       title: 'Security Intelligence',       desc: 'Detect anomalous patterns, unusual access, and potential threats — correlated with your feature and API context.',        bg: 'rgba(39,166,206,0.12)', color: '#27A6CE' },
]

const AGENTS = [
  { Icon: Bug,         name: 'Error Analyst',      desc: 'Root cause analysis for every exception, crash, and warning.' },
  { Icon: Route,       name: 'Journey Detective',  desc: 'Tracks user flows and detects where experiences break down.' },
  { Icon: TrendingUp,  name: 'Performance Guard',  desc: 'Monitors latency, load times, and throughput regressions.' },
  { Icon: Shield,      name: 'Security Sentinel',  desc: 'Detects anomalous access patterns and auth events.' },
  { Icon: Bell,        name: 'Incident Commander', desc: 'Correlates events across systems to explain incidents.' },
  { Icon: Cpu,         name: 'Knowledge Builder',  desc: 'Continuously enriches the Knowledge Graph from new data.' },
]

const STEPS = [
  { Icon: Code2,        n: '01', title: 'Install the SDK',          desc: 'One SDK for all platforms. Add two lines of code and you\'re monitoring.' },
  { Icon: BrainCircuit, n: '02', title: 'Learns your product',      desc: 'Connect GitHub, import API specs, or let PAAQ infer your architecture from live events.' },
  { Icon: Sparkles,     n: '03', title: 'Get intelligent insights', desc: 'Agents surface insights within minutes. Incidents investigated, root causes identified, fixes ranked.' },
]

const SECURITY_ITEMS = [
  'Row-level security — complete tenant data isolation',
  'AES-256 encryption at rest and TLS in transit',
  'Audit logs for all account actions',
  'SDK credential rotation without downtime',
  'CSRF protection and secure session handling',
  'Configurable data retention and deletion',
]

const SECURITY_CARDS = [
  { Icon: Lock,      label: 'Encrypted storage' },
  { Icon: Shield,    label: 'Tenant isolation' },
  { Icon: Users,     label: 'Role-based access' },
  { Icon: GitBranch, label: 'Audit trail' },
]

const PRICING = [
  {
    name: 'Starter', price: 'Free', period: '', featured: false, cta: 'Start free', href: '/login?tab=signup',
    features: ['25,000 events / month', '1 project', '7-day data retention', 'Basic insights', 'SDK for all platforms', 'Community support'],
  },
  {
    name: 'Growth', price: '$79', period: '/ month', featured: true, cta: 'Start free trial →', href: '/login?tab=signup',
    features: ['1M events / month', 'Unlimited projects', '90-day data retention', 'Advanced insights', '6 specialist agents', 'Custom alerts & webhooks', 'API access', 'Priority email support'],
  },
  {
    name: 'Enterprise', price: 'Custom', period: '', featured: false, cta: 'Talk to sales', href: 'mailto:sales@paaq.ai',
    features: ['Unlimited events', 'Unlimited projects', 'Custom data retention', 'Custom model training', 'Dedicated support & SLA', 'SSO / SAML', 'On-premise option', 'Custom integrations'],
  },
]

const TESTIMONIALS = [
  { initials: 'SC', name: 'Sarah Chen',   role: 'CTO, FinFlow',             quote: '"PAAQ found a root cause in 3 minutes that our team had been debugging for 2 days. The context is remarkable."' },
  { initials: 'MR', name: 'Marcus Reid',  role: 'VP Engineering, Taskify',  quote: '"The Knowledge Graph is unlike anything else. It actually understands our product — not just raw events."' },
  { initials: 'AN', name: 'Aisha Nkosi',  role: 'Head of Product, Edara',   quote: '"Onboarding took 4 minutes. By end of day we had insights on our mobile app we\'d never seen before."' },
]

const FAQ_ITEMS = [
  { q: 'What is PAAQ Intelligence?',              a: 'PAAQ Intelligence is an intelligent product monitoring platform. It monitors your application, detects issues, analyses root causes, and helps your team resolve them faster. Unlike traditional monitoring, PAAQ builds a Knowledge Graph so insights are contextual — not generic.' },
  { q: 'Which platforms does the SDK support?',   a: 'We support Flutter, React, Next.js, iOS (Swift), Android (Kotlin), and Node.js. All SDKs share a consistent API and take under 5 minutes to integrate.' },
  { q: 'How long does setup take?',               a: 'Under 5 minutes. The guided wizard walks you through creating your organisation, workspace, and project — then gives you real code snippets with your credentials embedded.' },
  { q: 'How does the intelligence work?',         a: 'After connecting your app, PAAQ builds a Knowledge Graph from your events, errors, sessions, and any imported docs or API specs. Six specialist agents continuously analyse this knowledge to surface insights, investigate incidents, and recommend fixes.' },
  { q: 'Is my data secure?',                      a: 'Yes. All data is encrypted in transit and at rest. We use row-level security to ensure complete tenant isolation — no customer can access another\'s data. You can export or delete your data at any time.' },
  { q: 'Can I monitor multiple apps?',            a: 'Yes. You can create unlimited projects under your organisation (on Growth and Enterprise plans). Each project has its own credentials, events, insights, and settings.' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [isDark, setIsDark]       = useState(true)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [scrolled, setScrolled]   = useState(false)
  const [openFaq, setOpenFaq]     = useState<number | null>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) }
      }),
      { rootMargin: '0px 0px -60px 0px', threshold: 0.1 },
    )
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const textColor = isDark ? '#e8f0f8' : '#0f1923'

  return (
    <div className={`landing-root${isDark ? '' : ' light-theme'}`}>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <header className={`nav-header${scrolled ? ' scrolled' : ''}`}>
        <Link href="/" className="nav-logo">
          <Image src="/logo.png" alt="PAAQ Intelligence" width={36} height={36} className="rounded-xl" style={{ boxShadow: '0 4px 16px rgba(81,201,211,0.3)' }} />
          <div className="nav-logo-text">
            <div className="nav-logo-title">PAAQ</div>
            <div className="nav-logo-sub">Intelligence</div>
          </div>
        </Link>

        <nav>
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how">How it works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </nav>

        <div className="nav-actions">
          <button className="btn-icon" onClick={() => setIsDark(!isDark)} aria-label="Toggle theme">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/login" className="btn btn-ghost nav-login">Log in</Link>
          <Link href="/login?tab=signup" className="btn btn-primary">Start free</Link>
          <button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <XIcon size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      <div className={`mobile-overlay${menuOpen ? ' open' : ''}`}>
        {['#features', '#how', '#pricing', '#faq'].map((href) => (
          <a key={href} href={href} onClick={() => setMenuOpen(false)}>
            {href.replace('#', '').replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </a>
        ))}
        <div className="mobile-cta-group">
          <Link href="/login" className="btn btn-ghost" style={{ textAlign: 'center' }} onClick={() => setMenuOpen(false)}>Log in</Link>
          <Link href="/login?tab=signup" className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => setMenuOpen(false)}>Start free</Link>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />
        <div className="hero-glow hero-glow-3" />
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="live-dot" /> Now in early access
            </div>
            <h1 className="hero-title">
              Your app is talking.<br />
              <span className="gradient-text">PAAQ is listening.</span>
            </h1>
            <p className="hero-desc">
              Intelligent product monitoring that detects issues before users notice them,
              explains root causes in plain language, and helps your team resolve incidents in minutes — not days.
            </p>
            <div className="hero-actions">
              <Link href="/login?tab=signup" className="btn btn-primary btn-lg">
                Start free — no credit card <ArrowRight size={16} />
              </Link>
              <a href="#how" className="btn-outline-lg">See how it works</a>
            </div>
            <p className="hero-trust">
              <span className="check-icon">✓</span> Free tier includes 25,000 events/month · Setup in under 5 minutes
            </p>
          </div>

          <div className="hero-visual">
            <div className="hero-mockup">
              <div className="hero-mockup-chrome">
                <span className="chrome-dot red" />
                <span className="chrome-dot yellow" />
                <span className="chrome-dot green" />
                <span className="chrome-url">dashboard.paaq.ai</span>
              </div>
              <div className="hero-mockup-body">
                <div className="mockup-sidebar">
                  {['Dashboard', 'Live Events', 'Errors', 'Insights', 'Journeys', 'Incidents'].map((item, i) => (
                    <div key={item} className={`mockup-sidebar-item${i === 0 ? ' active' : ''}`}>{item}</div>
                  ))}
                </div>
                <div className="mockup-main">
                  <div className="mockup-kpi-row">
                    {[
                      { label: 'Events today', value: '12,847', color: '#51C9D3' },
                      { label: 'Active users', value: '1,293',  color: '#5FDED4' },
                      { label: 'Error rate',   value: '0.12%',  color: '#27A6CE' },
                      { label: 'Insights',     value: '7 new',  color: '#51C9D3' },
                    ].map((kpi) => (
                      <div key={kpi.label} className="mockup-kpi">
                        <div className="mockup-kpi-label">{kpi.label}</div>
                        <div className="mockup-kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mockup-chart-row">
                    <div className="mockup-panel">
                      <div className="mockup-panel-label">Event stream</div>
                      {[
                        { text: 'user_signup · 2s ago',       err: false },
                        { text: 'payment_success · 5s ago',   err: false },
                        { text: 'session_start · 8s ago',     err: false },
                        { text: 'error.NullPointer · 12s ago',err: true },
                      ].map((e) => (
                        <div key={e.text} className="mockup-event">
                          <span className={`mockup-event-dot ${e.err ? 'red' : 'green'}`} />
                          <span style={e.err ? { color: '#ef4444' } : undefined}>{e.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mockup-insight-panel">
                      <div className="mockup-insight-label">⚡ Insight</div>
                      <div className="mockup-insight-text">NullPointer in checkout flow. Root cause: unhandled null in PaymentService. Fix confidence: 94%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform bar ─────────────────────────────────────────────────────── */}
      <section className="platform-bar">
        <p className="platform-bar-label">Built for every platform</p>
        <div className="platform-icons">
          {PLATFORMS.map(({ label, Icon, color }) => (
            <div key={label} className="platform-icon-item">
              <Icon size={20} style={{ color: color ?? textColor, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-sm">
          <div className="stats-grid">
            {[
              { value: '2.4M+',   label: 'Events processed daily' },
              { value: '180K+',   label: 'Analyses run' },
              { value: '< 4 min', label: 'Mean time to resolution' },
              { value: '99.98%',  label: 'Platform uptime' },
            ].map((s) => (
              <div key={s.label}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="section" id="features">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 60 }}>
            <div className="section-label mx-auto"><span className="dot" /> Platform capabilities</div>
            <h2 className="section-title mx-auto">Everything your team needs</h2>
            <p className="section-subtitle mx-auto">From real-time event capture to intelligent incident reports — all in one platform.</p>
          </div>
          <div className="cards-grid cols-3">
            {FEATURES.map(({ Icon, title, desc, bg, color }, i) => (
              <div key={title} className={`feature-card reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
                <div className="feature-card-icon" style={{ background: bg }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div className="feature-card-title">{title}</div>
                <div className="feature-card-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Agents ────────────────────────────────────────────────────────── */}
      <section className="section" style={{ borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-alt)' }}>
        <div className="container">
          <div className="text-center" style={{ marginBottom: 60 }}>
            <div className="section-label mx-auto"><span className="dot" /> Intelligence Engine</div>
            <h2 className="section-title mx-auto">Six specialist agents working for you</h2>
            <p className="section-subtitle mx-auto">Not a chatbot. Dedicated agents that continuously analyse your product and act proactively.</p>
          </div>
          <div className="cards-grid cols-3">
            {AGENTS.map(({ Icon, name, desc }, i) => (
              <div key={name} className={`agent-card reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
                <div className="agent-card-icon"><Icon size={16} /></div>
                <div>
                  <div className="agent-card-name">{name}</div>
                  <div className="agent-card-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="section" id="how">
        <div className="container-sm">
          <div className="text-center" style={{ marginBottom: 60 }}>
            <div className="section-label mx-auto"><span className="dot" /> How it works</div>
            <h2 className="section-title mx-auto">Up and running in minutes</h2>
          </div>
          <div className="steps-container">
            <div className="steps-line" />
            {STEPS.map(({ Icon, n, title, desc }, i) => (
              <div key={n} className={`step-item reveal${i > 0 ? ` reveal-delay-${i * 2}` : ''}`}>
                <div className="step-icon-circle"><Icon size={24} /></div>
                <div className="step-number">{n}</div>
                <div className="step-title">{title}</div>
                <div className="step-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      <section className="section" style={{ borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container">
          <div className="security-grid">
            <div className="reveal">
              <div className="section-label"><span className="dot" /> Security & privacy</div>
              <h2 className="section-title">Enterprise-grade security built in</h2>
              <p className="section-subtitle" style={{ marginBottom: 24 }}>
                Security is not a feature — it&apos;s the foundation. Every piece of customer data is isolated, encrypted, and protected.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SECURITY_ITEMS.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                    <span style={{ color: '#51C9D3', fontWeight: 700 }}>✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="cards-grid cols-2 reveal reveal-delay-2">
              {SECURITY_CARDS.map(({ Icon, label }) => (
                <div key={label} className="feature-card" style={{ textAlign: 'center' }}>
                  <div className="feature-card-icon mx-auto" style={{ background: 'rgba(81,201,211,0.1)' }}>
                    <Icon size={20} style={{ color: '#51C9D3' }} />
                  </div>
                  <div className="feature-card-title">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 60 }}>
            <div className="section-label mx-auto"><span className="dot" /> Pricing</div>
            <h2 className="section-title mx-auto">Simple, transparent pricing</h2>
            <p className="section-subtitle mx-auto">Start free. Scale when you need to.</p>
          </div>
          <div className="pricing-grid">
            {PRICING.map(({ name, price, period, featured, cta, href, features }, i) => (
              <div key={name} className={`pricing-card reveal${i > 0 ? ` reveal-delay-${i * 2}` : ''}${featured ? ' featured' : ''}`}>
                {featured && <div className="pricing-badge">Most popular</div>}
                <div className="pricing-name" style={{ color: featured ? '#51C9D3' : 'var(--text-muted)' }}>{name}</div>
                <div className="pricing-price">{price}</div>
                {period && <div className="pricing-period">{period}</div>}
                <ul className="pricing-features">
                  {features.map((f) => (
                    <li key={f}><span className="check">✓</span> {f}</li>
                  ))}
                </ul>
                <Link href={href} className={`pricing-btn ${featured ? 'primary-btn' : 'outline-btn'}`}>{cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="section" style={{ borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container">
          <div className="text-center" style={{ marginBottom: 60 }}>
            <div className="section-label mx-auto"><span className="dot" /> Customer stories</div>
            <h2 className="section-title mx-auto">Loved by engineering teams</h2>
          </div>
          <div className="cards-grid cols-3">
            {TESTIMONIALS.map(({ initials, name, role, quote }, i) => (
              <div key={name} className={`testimonial-card reveal${i > 0 ? ` reveal-delay-${i * 2}` : ''}`}>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">{quote}</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{initials}</div>
                  <div>
                    <div className="testimonial-name">{name}</div>
                    <div className="testimonial-role">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="section" id="faq">
        <div className="container-xs">
          <div className="text-center" style={{ marginBottom: 48 }}>
            <div className="section-label mx-auto"><span className="dot" /> FAQ</div>
            <h2 className="section-title mx-auto">Common questions</h2>
          </div>
          {FAQ_ITEMS.map(({ q, a }, i) => (
            <div key={q} className="faq-item" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div className="faq-question">
                {q}
                <ChevronDown size={16} className={`faq-chevron${openFaq === i ? ' open' : ''}`} />
              </div>
              <div className={`faq-answer${openFaq === i ? ' open' : ''}`}>{a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="section-lg">
        <div className="container-xs">
          <div className="cta-card reveal">
            <div className="cta-icon"><Sparkles size={36} /></div>
            <h2 className="cta-title">Start monitoring in 5 minutes</h2>
            <p className="cta-desc">Free tier, no credit card required. See your first insight before you finish your coffee.</p>
            <div className="cta-actions">
              <Link href="/login?tab=signup" className="btn btn-primary btn-lg">
                Create free account <ArrowRight size={16} />
              </Link>
              <a href="mailto:hello@paaq.ai" className="btn-outline-lg">Talk to us</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link href="/" className="nav-logo" style={{ marginBottom: 0 }}>
                <Image src="/logo.png" alt="PAAQ Intelligence" width={36} height={36} className="rounded-xl" />
                <div className="nav-logo-text">
                  <div className="nav-logo-title">PAAQ</div>
                  <div className="nav-logo-sub">Intelligence</div>
                </div>
              </Link>
              <p className="footer-brand-desc">Intelligent product monitoring for modern engineering teams.</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'Changelog'] },
              { title: 'Docs',    links: ['Getting Started', 'SDK Reference', 'API Reference', 'Status'] },
              { title: 'Legal',   links: ['Privacy', 'Terms', 'Security', 'Cookies'] },
            ].map((col) => (
              <div key={col.title}>
                <div className="footer-col-title">{col.title}</div>
                <ul className="footer-col-links">
                  {col.links.map((link) => (
                    <li key={link}><a href="#">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <span>© 2025 PAAQ Intelligence. All rights reserved.</span>
            <span>Built for teams that care about their products.</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
