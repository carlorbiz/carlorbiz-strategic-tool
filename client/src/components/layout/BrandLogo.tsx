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
  const img = <img src={brand.logo} alt={`${brand.logoAlt} logo`} className={imgClassName} />;
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
