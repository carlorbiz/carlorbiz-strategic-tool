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

const NAV_LINKS = [
  { href: `${MTMOT}/#reclaim`, label: 'RECLAIM' },
  { href: `${MTMOT}/#empower`, label: 'EMPOWER' },
  { href: `${MTMOT}/#elevate`, label: 'ELEVATE' },
  { href: `${MTMOT}/about`, label: 'About' },
  { href: `${MTMOT}/community`, label: 'Community' },
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

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm transition-colors"
              style={{ color: C.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
            >
              {link.label}
            </a>
          ))}
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
