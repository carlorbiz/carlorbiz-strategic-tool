// Host-based branding (CC-84). One engine, one Supabase, two custom domains:
//   strategy.mtmot.com        → MTMOT Strategy Engine (the ELEVATE product surface)
//   strategy.carlorbiz.com.au → Carlorbiz Strategic Tool (Carla's consulting instance)
// Same deployment; the hostname decides the skin. Carlorbiz is NOT scrubbed —
// on either surface the demo engagements are run BY Carlorbiz Consulting, which
// is the proof (a real consultancy running the Engine for its clients).
//
// Local/preview override: ?brand=mtmot or ?brand=carlorbiz (persisted for the
// session) so either skin can be previewed on any host.

export type BrandKey = 'mtmot' | 'carlorbiz';

export interface Brand {
  key: BrandKey;
  isMtmot: boolean;
  productName: string;
  shortName: string;
  title: string;
  description: string;
}

const MTMOT: Brand = {
  key: 'mtmot',
  isMtmot: true,
  productName: 'MTMOT Strategy Engine',
  shortName: 'Strategy Engine',
  title: 'MTMOT Strategy Engine — board-grade strategy, self-serve',
  description:
    'A conversational evidence platform for board-level strategic engagements. See how a real consultancy runs its client engagements on the Engine — walk three live worked plans, no sign-up.',
};

const CARLORBIZ: Brand = {
  key: 'carlorbiz',
  isMtmot: false,
  productName: 'Carlorbiz Strategic Tool',
  shortName: 'Strategic Tool',
  title: 'Carlorbiz — Strategic Consulting & AI Knowledge Systems',
  description:
    'Carlorbiz helps organisations turn complex expertise into AI-powered knowledge systems. Strategic consulting, PWA development, and Nera AI.',
};

function readOverride(): BrandKey | null {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('brand');
    if (q === 'mtmot' || q === 'carlorbiz') {
      sessionStorage.setItem('brandOverride', q);
      return q;
    }
    const stored = sessionStorage.getItem('brandOverride');
    if (stored === 'mtmot' || stored === 'carlorbiz') return stored;
  } catch {
    /* SSR / no window — fall through */
  }
  return null;
}

export function getBrand(): Brand {
  const override = readOverride();
  if (override) return override === 'mtmot' ? MTMOT : CARLORBIZ;
  let host = '';
  try {
    host = window.location.hostname.toLowerCase();
  } catch {
    /* no window */
  }
  return host.includes('mtmot.com') ? MTMOT : CARLORBIZ;
}

// Set <title> + meta description at runtime (index.html ships the Carlorbiz
// defaults; one build serves both hosts, so the mtmot skin is applied here).
export function applyBrandDocument(brand: Brand): void {
  try {
    document.title = brand.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', brand.description);
  } catch {
    /* no document */
  }
}
