'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  BrainCircuit, Code2, Sparkles,
  Sun, Moon, Menu, X as XIcon,
  ArrowRight,
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
        {['#how'].map((href) => (
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
