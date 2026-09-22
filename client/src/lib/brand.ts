// Brand configuration (CC-347 Slice 0b, item 7). Replaces the previous
// host-string-matching brand module (mtmot.com vs carlorbiz.com.au), which
// hardcoded two specific consultancies' identities into the client build —
// exactly what "each client runs their own deployment" rules out. A client
// build has ONE brand, read from VITE_BRAND_* environment variables at build
// time, with MTMOT Strategy Engine defaults so an unconfigured build still
// renders something coherent rather than a blank shell. No host map: which
// brand renders is decided by what was baked in at build time, never by
// which domain the request arrived on.

export interface Brand {
  productName: string;
  shortName: string;
  title: string;
  description: string;
  /** Header logo asset path (relative to /public, or an absolute URL). */
  logo: string;
  /** Accessible name for the logo. */
  logoAlt: string;
  /** Where the header logo links. */
  homeUrl: string;
  /** Single accent colour (hex), applied as the --color-brand-accent CSS
   *  custom property at runtime. */
  accentColor: string;
  /** Support contact shown in-app (e.g. onboarding copy, error states). */
  supportEmail: string;
  /** True when this build should render the replicated mtmot.com marketing
   *  chrome (MtmotHeader, the public product-page root route, the
   *  footer-position engagement nav). Set at build time via
   *  VITE_BRAND_IS_MTMOT — a client build has one answer, not a host check.
   *  Defaults false: MTMOT Strategy Engine's own two public-facing hosts
   *  (strategy.mtmot.com and its Carlorbiz-consulting counterpart) are the
   *  only builds that should ever set this true; a client build never does. */
  isMtmot: boolean;
}

const DEFAULTS: Brand = {
  productName: 'MTMOT Strategy Engine',
  shortName: 'Strategy Engine',
  title: 'MTMOT Strategy Engine — board-grade strategy, self-serve',
  description:
    'A conversational evidence platform for board-level strategic engagements.',
  logo: '/images/mtmot-ep1-hero-reverse.png',
  logoAlt: 'MTMOT Strategy Engine',
  homeUrl: '/',
  accentColor: '#C9A96E',
  supportEmail: 'support@mtmot.com',
  isMtmot: false,
};

function readEnv(key: string): string | undefined {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

// MTMOT's own deployment serves two hosts from ONE build: the public front
// door (marketing chrome, product page at the root) and the operator console
// named by VITE_BRAND_ADMIN_REDIRECT_URL (engagement list at the root, admin
// routes rendered in place). When the page is being served FROM that console
// origin, the build renders as the console. Without this, one MTMOT build
// would show the marketing chrome on the console host too, and the admin
// guard would redirect the console to itself in a loop. Nothing here names a
// domain: the origin comes from the same env variable the guard already
// reads, and a client build (VITE_BRAND_IS_MTMOT unset) never enters this.
function onConsoleOrigin(): boolean {
  const consoleUrl = readEnv('VITE_BRAND_ADMIN_REDIRECT_URL');
  if (!consoleUrl) return false;
  try {
    return new URL(consoleUrl).origin === window.location.origin;
  } catch {
    return false; // malformed URL or no window (SSR / prerender)
  }
}

let cached: Brand | null = null;

export function getBrand(): Brand {
  if (cached) return cached;
  cached = {
    productName: readEnv('VITE_BRAND_PRODUCT_NAME') ?? DEFAULTS.productName,
    shortName: readEnv('VITE_BRAND_SHORT_NAME') ?? DEFAULTS.shortName,
    title: readEnv('VITE_BRAND_TITLE') ?? DEFAULTS.title,
    description: readEnv('VITE_BRAND_DESCRIPTION') ?? DEFAULTS.description,
    logo: readEnv('VITE_BRAND_LOGO') ?? DEFAULTS.logo,
    logoAlt: readEnv('VITE_BRAND_LOGO_ALT') ?? readEnv('VITE_BRAND_PRODUCT_NAME') ?? DEFAULTS.logoAlt,
    homeUrl: readEnv('VITE_BRAND_HOME_URL') ?? DEFAULTS.homeUrl,
    accentColor: readEnv('VITE_BRAND_ACCENT_COLOR') ?? DEFAULTS.accentColor,
    supportEmail: readEnv('VITE_BRAND_SUPPORT_EMAIL') ?? DEFAULTS.supportEmail,
    isMtmot: readEnv('VITE_BRAND_IS_MTMOT') === 'true' && !onConsoleOrigin(),
  };
  return cached;
}

// Set <title> + meta description at runtime (index.html ships generic
// defaults; the actual brand is applied here once, on mount) and the accent
// colour as a CSS custom property so components that reference
// var(--color-brand-accent) pick it up without each one reading getBrand()
// separately.
export function applyBrandDocument(brand: Brand): void {
  try {
    document.title = brand.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', brand.description);
    document.documentElement.style.setProperty('--color-brand-accent', brand.accentColor);
    // The MTMOT palette (bronze headings, chrome dark blocks, gold gradients,
    // the warm working surface) lives in the .brand-mtmot rules in index.css;
    // the accent variable above is one value inside it, not the whole skin.
    // Toggling the class keeps strategy.mtmot.com rendering exactly as it
    // does today (one-accent ruling, 31 Aug 2026) and leaves the console and
    // client builds on the base palette plus their own accent.
    document.documentElement.classList.toggle('brand-mtmot', brand.isMtmot);
  } catch {
    /* no document (SSR / prerender) */
  }
}
