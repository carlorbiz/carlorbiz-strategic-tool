// The mtmot.com menu header, replicated verbatim on the MTMOT host (CC-89,
// Carla 11 Jul: "replicate this exact menu header — same pages/URLs — just the
// header, retain the EP1 light on dark bg"). Host-scoped: rendered only when
// brand.isMtmot, so the Carlorbiz surface is untouched.
//
// Colours are hardcoded to the canonical mtmot.com tokens on purpose — the
// header must NOT adapt to the local light theme; its sameness is the
// one-website signal. Mirrored from mtmot-nextjs/src/components/layout/
// MtmotHeader.tsx — if the mtmot.com nav changes, update all copies together.

import { useState } from 'react'

const MTMOT = 'https://mtmot.com'

// Nav updated 31 Aug 2026 (Carla): mtmot.com retired the RECLAIM/EMPOWER/ELEVATE
// pillar nav (CC-281); the header now carries Home / About / Book a session /
// Contact — mirrored here per the CC-89 same-pass rule.
const NAV_LINKS = [
  { href: `${MTMOT}/`, label: 'Home' },
  { href: `${MTMOT}/about`, label: 'About' },
  { href: `${MTMOT}/diagnostic`, label: 'Book a session' },
  { href: `${MTMOT}/contact`, label: 'Contact' },
]

const C = {
  bg: '#0D0D1A',
  gold: '#C9A96E',
  borderGold: 'rgba(201, 169, 110, 0.20)',
  goldWash: 'rgba(201, 169, 110, 0.08)',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textPrimary: '#FFFFFF',
}

export function MtmotHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header
      className="w-full border-b"
      style={{ backgroundColor: C.bg, borderColor: C.borderGold }}
    >
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-3">
        <a href={MTMOT} aria-label="MTMOT home" className="flex shrink-0 items-center">
          <img
            src="/images/mtmot-ep1-hero-reverse.png"
            alt="MTMOT"
            className="h-7 w-auto md:h-8"
          />
        </a>

        {/* Desktop nav — mirrors mtmot.com exactly (Carla, 31 Aug 2026): About as
            text, then home / calendar (book) / envelope (contact) ICONS in gold. */}
        <nav className="hidden items-center gap-5 md:flex">
          <a href={`${MTMOT}/about`} className="text-sm transition-colors"
            style={{ color: C.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}>
            About
          </a>
          <a href={`${MTMOT}/`} aria-label="Back to the home page" title="Home"
            className="p-1 transition-colors" style={{ color: C.gold }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.gold)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" width="21" height="21" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
            </svg>
          </a>
          <a href={`${MTMOT}/diagnostic`} aria-label="Book a session" title="Book a session"
            className="p-1 transition-colors" style={{ color: C.gold }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.gold)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" width="21" height="21" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
          </a>
          <a href={`${MTMOT}/contact`} aria-label="Contact Carla" title="Get in touch"
            className="p-1 transition-colors" style={{ color: C.gold }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.gold)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" width="21" height="21" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
            </svg>
          </a>
          <a
            href={`${MTMOT}/auth`}
            className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ border: '1px solid rgba(201, 169, 110, 0.4)', color: C.gold }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.goldWash)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Sign in
          </a>
        </nav>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex flex-col gap-1.5 md:hidden"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-6 transition-transform ${menuOpen ? 'translate-y-2 rotate-45' : ''}`}
            style={{ backgroundColor: C.textSecondary }}
          />
          <span
            className={`block h-0.5 w-6 transition-opacity ${menuOpen ? 'opacity-0' : ''}`}
            style={{ backgroundColor: C.textSecondary }}
          />
          <span
            className={`block h-0.5 w-6 transition-transform ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`}
            style={{ backgroundColor: C.textSecondary }}
          />
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t px-6 py-4 md:hidden" style={{ borderColor: C.borderGold }}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm"
              style={{ color: C.textSecondary }}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3">
            <a
              href={`${MTMOT}/auth`}
              className="inline-block rounded-lg px-4 py-1.5 text-sm font-medium"
              style={{ border: '1px solid rgba(201, 169, 110, 0.4)', color: C.gold }}
            >
              Sign in
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}

export default MtmotHeader
