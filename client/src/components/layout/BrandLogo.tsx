import { Link } from 'wouter';
import { getBrand } from '@/lib/brand';

// The header brand mark, host-aware (CC-89 cross-property cohesion).
//   strategy.mtmot.com        → MTMOT logo → links out to the mtmot.com landing
//   strategy.carlorbiz.com.au → Carlorbiz logo → in-app home
// One deployment; getBrand() resolves the skin from the hostname, so this is
// applied ONLY on the mtmot host — the Carlorbiz surface is untouched.
// External home (mtmot.com) uses <a> to leave the SPA; internal uses <Link>.
export function BrandLogo({
  imgClassName = 'h-10 w-auto object-contain',
}: {
  imgClassName?: string;
}) {
  const brand = getBrand();
  const logoImg = <img src={brand.logo} alt={`${brand.logoAlt} logo`} className={imgClassName} />;
  // MTMOT's own build carries the Strategy Engine glyph before the logo;
  // client builds never do.
  const img = brand.isMtmot ? (
    <span className="inline-flex items-center gap-2">
      <img src="/icons/strategy-engine/glyph.svg" alt="" aria-hidden="true" width={28} height={28} className="h-7 w-7 shrink-0" />
      {logoImg}
    </span>
  ) : (
    logoImg
  );
  const isExternal = /^https?:\/\//.test(brand.homeUrl);

  if (isExternal) {
    return (
      <a
        href={brand.homeUrl}
        aria-label={`${brand.logoAlt} home`}
        className="inline-flex cursor-pointer transition-transform hover:scale-[1.01]"
      >
        {img}
      </a>
    );
  }
  return (
    <Link href={brand.homeUrl}>
      <div className="cursor-pointer transition-transform hover:scale-[1.01]">{img}</div>
    </Link>
  );
}
