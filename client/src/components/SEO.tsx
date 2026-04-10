import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const DEFAULTS = {
  title: 'Carlorbiz — Strategic Consulting & AI Knowledge Systems | Carla Taylor',
  description: 'Carlorbiz helps organisations turn complex expertise into AI-powered knowledge systems. Strategic consulting, PWA development, and Nera AI — built for peak bodies, healthcare, and education sectors.',
  canonicalUrl: 'https://carlorbiz.com.au',
  ogImage: 'https://carlorbiz.com.au/og-image.png',
};

export function SEO({ title, description, canonicalUrl, ogImage, type = 'website', jsonLd }: SEOProps) {
  const t = title || DEFAULTS.title;
  const d = description || DEFAULTS.description;
  const url = canonicalUrl || DEFAULTS.canonicalUrl;
  const img = ogImage || DEFAULTS.ogImage;

  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{t}</title>
      <meta name="description" content={d} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={t} />
      <meta property="og:description" content={d} />
      <meta property="og:image" content={img} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={t} />
      <meta name="twitter:description" content={d} />
      <meta name="twitter:image" content={img} />

      {/* JSON-LD Structured Data */}
      {jsonLdArray.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
