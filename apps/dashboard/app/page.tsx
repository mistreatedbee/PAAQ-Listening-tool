'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  BrainCircuit, Code2, Sparkles, Star,
  Sun, Moon, Menu, X as XIcon,
  ArrowRight, Users, Activity, Zap,
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

const STEPS = [
  { Icon: Code2,        n: '01', title: 'Install the SDK',          desc: 'One SDK for all platforms. Add two lines of code and you\'re monitoring.' },
  { Icon: BrainCircuit, n: '02', title: 'Learns your product',      desc: 'Connect GitHub, import API specs, or let PAAQ infer your architecture from live events.' },
  { Icon: Sparkles,     n: '03', title: 'Get intelligent insights', desc: 'Agents surface insights within minutes. Incidents investigated, root causes identified, fixes ranked.' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [isDark, setIsDark]       = useState(true)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [scrolled, setScrolled]   = useState(false)

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
            <li><a href="#how">How it works</a></li>
            <li><a href="#testimonials">Loved by teams</a></li>
          </ul>
        </nav>

        <div className="nav-actions">
          <button className="btn-icon" onClick={() => setIsDark(!isDark)} aria-label="Toggle theme">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/referral" className="btn btn-ghost nav-login">Invite friends</Link>
          <Link href="/login" className="btn btn-ghost nav-login">Log in</Link>
          <Link href="/login?tab=signup" className="btn btn-primary">Start free</Link>
          <button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <XIcon size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      <div className={`mobile-overlay${menuOpen ? ' open' : ''}`}>
        {['#how', '#testimonials'].map((href) => (
          <a key={href} href={href} onClick={() => setMenuOpen(false)}>
            {href.replace('#', '').replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </a>
        ))}
        <div className="mobile-cta-group">
          <Link href="/referral" className="btn btn-ghost" style={{ textAlign: 'center' }} onClick={() => setMenuOpen(false)}>Invite friends</Link>
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

          {/* Product mockup (right column) */}
          <div className="hero-visual">
            <div className="hero-mockup">
              <div className="hero-mockup-chrome">
                <span className="chrome-dot red" />
                <span className="chrome-dot yellow" />
                <span className="chrome-dot green" />
                <span className="chrome-url">app.paaq.dev — live monitoring</span>
              </div>
              <div className="hero-mockup-body">
                <div className="mockup-sidebar">
                  <div className="mockup-sidebar-item">Overview</div>
                  <div className="mockup-sidebar-item active">Incidents</div>
                  <div className="mockup-sidebar-item">Events</div>
                  <div className="mockup-sidebar-item">Knowledge</div>
                </div>
                <div className="mockup-main">
                  <div className="mockup-kpi-row">
                    <div className="mockup-kpi">
                      <div className="mockup-kpi-label">Uptime</div>
                      <div className="mockup-kpi-value" style={{ color: '#22c55e' }}>99.99%</div>
                    </div>
                    <div className="mockup-kpi">
                      <div className="mockup-kpi-label">Open</div>
                      <div className="mockup-kpi-value" style={{ color: '#ef4444' }}>2</div>
                    </div>
                    <div className="mockup-kpi">
                      <div className="mockup-kpi-label">MTTR</div>
                      <div className="mockup-kpi-value" style={{ color: textColor }}>6m</div>
                    </div>
                    <div className="mockup-kpi">
                      <div className="mockup-kpi-label">Events/s</div>
                      <div className="mockup-kpi-value" style={{ color: '#51C9D3' }}>4.2k</div>
                    </div>
                  </div>
                  <div className="mockup-chart-row">
                    <div className="mockup-panel">
                      <div className="mockup-panel-label">Events</div>
                      <div className="mockup-event"><span className="mockup-event-dot green" /> checkout.session.completed — 2,431</div>
                      <div className="mockup-event"><span className="mockup-event-dot green" /> auth.login.success — 1,947</div>
                      <div className="mockup-event"><span className="mockup-event-dot green" /> db.query.done — 8,112</div>
                      <div className="mockup-event"><span className="mockup-event-dot red" /> payment.failed — 143</div>
                    </div>
                    <div className="mockup-insight-panel">
                      <div className="mockup-insight-label">AI Insight</div>
                      <div className="mockup-insight-text">
                        Spiking 4xx on /checkout after deploy v2.4.1. Root cause: API timeout. Suggested fix ranked #1.
                      </div>
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

      {/* ── Trust stats ─────────────────────────────────────────────────────── */}
      <section className="section-sm">
        <div className="container">
          <div className="stats-grid">
            {[
              { icon: Users,   value: '1000+', label: 'Engineers monitoring with PAAQ' },
              { icon: Zap,     value: '< 5 min', label: 'Average time to first insight' },
              { icon: Activity, value: '250K+', label: 'Events analyzed daily' },
              { icon: Sparkles, value: '94%',   label: 'Incidents caught before users report' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="reveal">
                <div className="mb-3 flex items-center justify-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(81,201,211,0.12)', color: '#51C9D3' }}>
                    <Icon size={16} />
                  </div>
                </div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
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

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="section" id="testimonials">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 60 }}>
            <div className="section-label mx-auto"><span className="dot" /> Loved by teams</div>
            <h2 className="section-title mx-auto">Monitoring without the midnight pages</h2>
            <p className="section-subtitle mx-auto" style={{ maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
              Engineering teams use PAAQ to spot issues early, understand root causes instantly,
              and resolve incidents in minutes.
            </p>
          </div>
          <div className="cards-grid cols-3">
            {[
              {
                initials: 'JT', name: 'Jordan T.', role: 'Head of Engineering · Fintech',
                quote: 'PAAQ flagged a failed payment path 20 minutes before our alerting woke anyone up. The AI root-cause summary told us exactly where to look.',
              },
              {
                initials: 'AR', name: 'Ana R.', role: 'Platform Lead · E-commerce',
                quote: 'Setup took under five minutes, and the knowledge graph just works. We answer "why did this break?" in seconds instead of digging through logs.',
              },
              {
                initials: 'DM', name: 'Diego M.', role: 'Staff Engineer · SaaS',
                quote: 'The incident investigations are uncannily good. It ranks fixes by risk, so my team actually ships the right one first time.',
              },
            ].map(({ initials, name, role, quote }, i) => (
              <div key={name} className={`testimonial-card reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
                <div className="testimonial-stars">
                  {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={14} fill="currentColor" strokeWidth={0} />)}
                </div>
                <p className="testimonial-quote">"{quote}"</p>
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

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="cta-card reveal">
            <div className="cta-icon"><Zap size={34} /></div>
            <h2 className="cta-title">Start listening to your product today</h2>
            <p className="cta-desc">
              Free tier includes 25,000 events/month — no credit card required.
              Connect your first app in under 5 minutes.
            </p>
            <div className="cta-actions">
              <Link href="/login?tab=signup" className="btn btn-primary btn-lg">
                Start free <ArrowRight size={16} />
              </Link>
              <a href="#how" className="btn-outline-lg">See how it works</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Referral / waiting-list CTA ─────────────────────────────────────── */}
      <section className="refer-cta">
        <div className="container-sm text-center">
          <div className="section-label mx-auto"><span className="dot" /> Invite &amp; grow</div>
          <h2 className="section-title mx-auto">Join the wave to 1,000 active teams</h2>
          <p className="refer-desc mx-auto">
            Invite a friend and you both get early access to new AI features. Share your
            link, track signups, and watch the community grow.
          </p>
          <div className="refer-cta-buttons">
            <Link href="/referral" className="btn btn-primary btn-lg">Get your invite link <ArrowRight size={16} /></Link>
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
