import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { PDFViewer } from '@/components/PDFViewer';
import { VideoViewer } from '@/components/viewers/VideoViewer';
import { CardGrid } from '@/components/viewers/CardGrid';
import { NeraInlineViewer } from '@/components/viewers/NeraInlineViewer';
import { NeraLayer2Gate } from '@/components/viewers/NeraLayer2Gate';
import { DecisionTreeInlineViewer } from '@/components/viewers/DecisionTreeInlineViewer';
import { Navbar } from '@/components/layout/Navbar';
import { SearchBar } from '@/components/SearchBar';
import { useCMS } from '@/contexts/CMSContext';
import { SEO } from '@/components/SEO';
import { BrainCircuit, GitFork, Play, FileText } from 'lucide-react';
import type { TabContent } from '@/types/cms';

const CONTENT_TYPE_BADGES: Record<string, { label: string; icon: typeof BrainCircuit }> = {
  'nera': { label: 'Ask Nera', icon: BrainCircuit },
  'decision-tree': { label: 'Interactive tool', icon: GitFork },
  'video': { label: 'Video', icon: Play },
  'pdf': { label: 'Document', icon: FileText },
};

interface SectionBreak {
  /** Break after this many visible accordions (e.g. 4 = break after the 4th accordion) */
  afterIndex: number;
  /** Markdown content to render between the two accordion groups */
  content?: string;
  /** Optional heading above the second group */
  heading?: string;
  /** If true, hide the gold gradient dividers around this section break */
  hideDividers?: boolean;
}

interface AccordionPageProps {
  folderSlug: string;
  title?: string;
  /** Hero intro text — supports markdown (headings, bold, lists, etc.) */
  intro?: string;
  /** Hero image URL — shown on the right side of the hero (Landing-page style) */
  heroImage?: string;
  /** Alt text for hero image */
  heroImageAlt?: string;
  /** Split accordions into groups with optional content blocks between */
  sectionBreak?: SectionBreak;
  /** Multiple section breaks — takes precedence over sectionBreak if provided */
  sectionBreaks?: SectionBreak[];
  /** Heading for the first group of accordions (before any section break) */
  firstGroupHeading?: string;
  /** Markdown content below the first group heading */
  firstGroupContent?: string;
}

// ── Accordion rendering helper (supports section breaks) ────────────────────

function renderAccordionItem(
  tab: TabContent,
  openItem: string,
  onOpenChange: (val: string) => void
) {
  return (
    <AccordionItem
      key={tab.id}
      value={tab.id}
      id={`accordion-${tab.id}`}
      className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden data-[state=open]:shadow-md transition-shadow border-l-[3px] border-l-transparent data-[state=open]:border-l-[#D5B13A] hover:border-l-[#D5B13A]/50"
    >
      <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-[#2D7E32]/5 transition-colors [&>svg]:text-[#D5B13A] [&>svg]:h-5 [&>svg]:w-5">
        <div className="flex-1 text-left space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-heading text-xl lg:text-2xl font-extrabold leading-tight">
              <span className="text-[#2D7E32]">{tab.label.split(' ')[0]}</span>
              {tab.label.split(' ').length > 1 && (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6B7C73] to-[#AAB2B7]">
                  {' ' + tab.label.split(' ').slice(1).join(' ')}
                </span>
              )}
            </h3>
            {CONTENT_TYPE_BADGES[tab.content_type] && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#2D7E32]/8 text-[#2D7E32] border border-[#2D7E32]/15">
                {(() => { const Badge = CONTENT_TYPE_BADGES[tab.content_type]; const Icon = Badge.icon; return <><Icon className="h-3 w-3" />{Badge.label}</>; })()}
              </span>
            )}
          </div>
          {tab.summary && (
            <p className="text-sm md:text-base text-gray-600 font-body leading-relaxed">
              {tab.summary}
            </p>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-8">
        <div className="pt-4 border-t border-gray-100">
          <div className="mt-6">
            <AccordionContentRenderer tab={tab} />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function SectionBreakBlock({ heading, content, hideDividers }: { heading?: string; content?: string; hideDividers?: boolean }) {
  if (!heading && !content) return null;
  return (
    <div className="pt-8 pb-2">
      {/* Top divider */}
      {!hideDividers && (
        <div className="h-px bg-gradient-to-r from-transparent via-[#D5B13A]/60 to-transparent mb-6" />
      )}
      {heading && (
        <h2 className="font-heading text-3xl lg:text-4xl font-extrabold mb-2">
          <span className="text-[#2D7E32]">{heading.split(' ')[0]} </span>
          {heading.split(' ').length > 1 && (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6B7C73] to-[#AAB2B7]">
              {heading.split(' ').slice(1).join(' ')}
            </span>
          )}
        </h2>
      )}
      {content && (
        <div className={`max-w-3xl ${CARLORBIZ_PROSE}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function AccordionGroups({
  tabs,
  sectionBreak,
  sectionBreaks,
  firstGroupHeading,
  firstGroupContent,
  openItem,
  onOpenChange,
}: {
  tabs: TabContent[];
  sectionBreak?: SectionBreak;
  sectionBreaks?: SectionBreak[];
  firstGroupHeading?: string;
  firstGroupContent?: string;
  openItem: string;
  onOpenChange: (val: string) => void;
}) {
  // Resolve to a sorted array of breaks
  const breaks = sectionBreaks
    ? [...sectionBreaks].sort((a, b) => a.afterIndex - b.afterIndex)
    : sectionBreak
      ? [sectionBreak]
      : [];

  if (breaks.length === 0) {
    return (
      <Accordion type="single" collapsible value={openItem} onValueChange={onOpenChange} className="space-y-3">
        {tabs.map((tab) => renderAccordionItem(tab, openItem, onOpenChange))}
      </Accordion>
    );
  }

  // Split tabs into groups based on break positions
  const groups: { tabs: TabContent[]; breakAfter?: SectionBreak }[] = [];
  let cursor = 0;

  for (const brk of breaks) {
    const end = Math.min(brk.afterIndex, tabs.length);
    if (end > cursor) {
      groups.push({ tabs: tabs.slice(cursor, end), breakAfter: brk });
      cursor = end;
    }
  }
  // Remaining tabs after last break
  if (cursor < tabs.length) {
    groups.push({ tabs: tabs.slice(cursor) });
  }

  return (
    <div className="space-y-4">
      {groups.map((group, i) => (
        <div key={i}>
          {/* First group heading + content (if provided) */}
          {i === 0 && firstGroupHeading && (
            <div className="mb-6">
              <h2 className="font-heading text-3xl lg:text-4xl font-extrabold mb-4">
                <span className="text-[#2D7E32]">{firstGroupHeading.split(' ')[0]} </span>
                {firstGroupHeading.split(' ').length > 1 && (
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6B7C73] to-[#AAB2B7]">
                    {firstGroupHeading.split(' ').slice(1).join(' ')}
                  </span>
                )}
              </h2>
              {firstGroupContent && (
                <div className={`max-w-3xl ${CARLORBIZ_PROSE}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{firstGroupContent}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
          <Accordion type="single" collapsible value={openItem} onValueChange={onOpenChange} className="space-y-3">
            {group.tabs.map((tab) => renderAccordionItem(tab, openItem, onOpenChange))}
          </Accordion>
          {group.breakAfter && (
            <SectionBreakBlock heading={group.breakAfter.heading} content={group.breakAfter.content} hideDividers={group.breakAfter.hideDividers} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AccordionPage({ folderSlug, title, intro, heroImage, heroImageAlt, sectionBreak, sectionBreaks, firstGroupHeading, firstGroupContent }: AccordionPageProps) {
  const { tabs, folders, isLoading } = useCMS();
  const [openItem, setOpenItem] = useState('');

  // Deep-link support: #tab-slug in URL auto-opens and scrolls to that accordion
  useEffect(() => {
    if (isLoading) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;

    // Find a tab whose slug matches the hash
    const matchedTab = tabs.find(t => t.slug === hash && t.is_visible);
    if (matchedTab) {
      setOpenItem(matchedTab.id);
      setTimeout(() => {
        document.getElementById(`accordion-${matchedTab.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 300);
    }
  }, [isLoading, tabs]);

  const folder = useMemo(() => folders.find(f => f.slug === folderSlug), [folders, folderSlug]);
  const folderTabs = useMemo(() => {
    // Try folder-based first (tabs assigned to a folder with this slug)
    if (folder) {
      const byFolder = tabs.filter(t => t.folder_id === folder.id && t.is_visible).sort((a, b) => a.order_index - b.order_index);
      if (byFolder.length > 0) return byFolder;
    }
    // Fallback: tabs with matching page_slug (seed data or legacy)
    return tabs.filter(t => t.page_slug === folderSlug && t.is_visible).sort((a, b) => a.order_index - b.order_index);
  }, [tabs, folder, folderSlug]);

  const pageTitle = title || folder?.label || folderSlug;

  const seoTitles: Record<string, string> = {
    'about-me': 'About — Carlorbiz',
    'services': 'Services — Strategic Consulting & AI Knowledge Systems',
    'insights': 'Insights — Carlorbiz',
  };
  const seoDescriptions: Record<string, string> = {
    'about-me': '30 years transforming organisations. Now building AI knowledge systems that work long after the engagement ends.',
    'services': 'POD methodology, AI-powered knowledge platforms, and the Nera PWA template. Built for organisations whose expertise needs to outlast any single engagement.',
    'insights': 'Strategic thinking on AI, knowledge systems, organisational transformation, and what constraint teaches us about competitive advantage.',
  };

  // Dynamic FAQ schema for services page
  const faqSchema = folderSlug === 'services' && folderTabs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: folderTabs.filter(t => t.summary).map(t => ({
      "@type": "Question",
      name: t.label,
      acceptedAnswer: { "@type": "Answer", text: t.summary },
    })),
  } : undefined;

  // Article schema for insights essays (AEO — AI search engines prioritise structured articles)
  const articleSchemas = folderSlug === 'insights' && folderTabs.length > 0
    ? folderTabs.filter(t => t.content && t.content.length > 200).map(t => ({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: t.label,
        description: t.summary || t.label,
        author: {
          "@type": "Person",
          name: "Carla Taylor",
          url: "https://carlorbiz.com.au/about-me",
          jobTitle: "Strategic Consultant & Founder",
        },
        publisher: {
          "@type": "Organization",
          name: "Carlorbiz",
          url: "https://carlorbiz.com.au",
          logo: { "@type": "ImageObject", url: "https://carlorbiz.com.au/og-image.png" },
        },
        url: `https://carlorbiz.com.au/insights#${t.slug}`,
        datePublished: t.created_at || "2026-04-01",
        dateModified: t.updated_at || t.created_at || "2026-04-01",
        mainEntityOfPage: `https://carlorbiz.com.au/insights#${t.slug}`,
        image: "https://carlorbiz.com.au/og-image.png",
      }))
    : undefined;

  // Person schema for About page (helps Google Knowledge Panel + AI search attribution)
  const personSchema = folderSlug === 'about-me' ? {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Carla Taylor",
    jobTitle: "Founder & Strategic Consultant",
    description: "Strategic consultant helping organisations find what makes them irreplaceable. 30 years leading transformation across healthcare, hospitality, and professional services. Builder of AI-powered knowledge platforms.",
    image: "https://carlorbiz.com.au/images/carla-headshot.jpg",
    url: "https://carlorbiz.com.au/about-me",
    sameAs: [
      "https://www.linkedin.com/in/carlajane/",
      "https://carlorbiz.com.au"
    ],
    worksFor: {
      "@type": "Organization",
      name: "Carlorbiz",
      url: "https://carlorbiz.com.au",
      logo: "https://carlorbiz.com.au/og-image.png",
    },
    knowsAbout: [
      "Strategic consulting",
      "AI-powered knowledge platforms",
      "Digital transformation",
      "DAIS methodology",
      "Knowledge management",
      "Transformation staging"
    ],
  } : undefined;

  // Combine all schemas
  const jsonLdSchemas: Record<string, unknown>[] = [];
  if (faqSchema) jsonLdSchemas.push(faqSchema);
  if (articleSchemas) jsonLdSchemas.push(...articleSchemas);
  if (personSchema) jsonLdSchemas.push(personSchema);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title={seoTitles[folderSlug] || pageTitle}
        description={seoDescriptions[folderSlug]}
        canonicalUrl={`https://carlorbiz.com.au/${folderSlug}`}
        jsonLd={jsonLdSchemas.length > 0 ? jsonLdSchemas : undefined}
      />
      <Navbar />

      <main className="flex-1 w-full bg-[#F9F9F9]">
        {/* Hero Section — mirrors Landing page layout */}
        <section className="bg-white text-[var(--color-brand-dark)] py-16 lg:py-24 relative overflow-hidden border-b border-gray-100">
          {/* Subtle background glow (matches Landing) */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-[var(--color-brand-primary)] to-transparent rounded-full opacity-5 blur-3xl pointer-events-none transform translate-x-1/2 -translate-y-1/2" />

          <div className="container mx-auto px-4 lg:px-8 relative z-10 flex flex-col lg:flex-row items-center gap-12">
            {/* Text column */}
            <div className="flex-1 space-y-6">
              <h1 className="font-heading text-4xl lg:text-5xl font-extrabold leading-tight drop-shadow-sm">
                <span className="text-[#2D7E32]">{pageTitle.split(' ')[0]} </span>
                {pageTitle.split(' ').length > 1 && (
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6B7C73] to-[#AAB2B7]">
                    {pageTitle.split(' ').slice(1).join(' ')}
                  </span>
                )}
              </h1>
              {intro && (
                <div className={`max-w-2xl ${CARLORBIZ_PROSE}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
                </div>
              )}

              {/* Inline contents nav — subtle jump links to accordion sections */}
              {folderTabs.length > 0 && (
                <nav className="pt-4 hidden lg:block">
                  <div className="border border-gray-200/80 rounded-lg bg-[#F9F9F9]/60 px-5 py-4">
                    <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-2.5">
                      Page navigation
                    </p>
                  <ul className="space-y-0">
                    {folderTabs.map((tab, i) => {
                      // Insert a section break label if this is where group 2 starts
                      const showBreakLabel = sectionBreak?.heading && i === sectionBreak.afterIndex;
                      return (
                        <li key={tab.id}>
                          {showBreakLabel && (
                            <div className="flex items-center gap-2 pt-3 pb-1.5">
                              <div className="h-px flex-1 bg-gradient-to-r from-[#D5B13A]/30 to-transparent" />
                              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-[#D5B13A]/70">
                                {sectionBreak.heading}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setOpenItem(tab.id);
                              // Small delay so accordion opens before scroll
                              setTimeout(() => {
                                document.getElementById(`accordion-${tab.id}`)?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center',
                                });
                              }, 100);
                            }}
                            className="group flex items-center gap-2 py-1 w-full text-left transition-colors"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D5B13A]/40 group-hover:bg-[#D5B13A] transition-colors flex-shrink-0" />
                            <span className="font-body text-xs text-gray-500 group-hover:text-[#2D7E32] transition-colors leading-tight">
                              {tab.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  </div>
                </nav>
              )}
            </div>

            {/* Image column (matches Landing hero portrait layout) */}
            {heroImage && (
              <div className="flex-1 flex justify-center w-full">
                <div className="relative w-full max-w-md flex items-center justify-center p-4">
                  <img
                    src={heroImage}
                    alt={heroImageAlt || pageTitle}
                    loading="eager"
                    className="w-full h-auto object-contain mix-blend-multiply hover:scale-[1.02] transition-transform duration-700 ease-out drop-shadow-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Accordion Content */}
        <div className="container mx-auto px-4 lg:px-8 py-12">
          {folderTabs.length === 0 ? (
            <p className="text-muted-foreground text-center py-16">
              Content coming soon.
            </p>
          ) : (
            <AccordionGroups
              tabs={folderTabs}
              sectionBreak={sectionBreak}
              sectionBreaks={sectionBreaks}
              firstGroupHeading={firstGroupHeading}
              firstGroupContent={firstGroupContent}
              openItem={openItem}
              onOpenChange={setOpenItem}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="container mx-auto px-4">
          {/* Search bar in footer */}
          {folderTabs.length > 0 && (
            <div className="flex flex-col items-center mb-8">
              <p className="font-body text-xs text-gray-400 uppercase tracking-[0.15em] mb-3">
                Looking for something specific?
              </p>
              <div className="w-full max-w-md">
                <SearchBar
                  onResultSelect={(tabId) => {
                    setOpenItem(tabId);
                    setTimeout(() => {
                      document.getElementById(`accordion-${tabId}`)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }, 100);
                  }}
                />
              </div>
            </div>
          )}

          <div className="text-center">
            <img
              src="/images/carlorbiz-logo.webp"
              alt="Carlorbiz Logo"
              className="h-16 mb-5 mx-auto w-auto object-contain"
            />
            <p className="text-xs text-gray-400 font-body uppercase tracking-wider">
              &copy; Carla Taylor t/as Carlorbiz, {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Custom prose class that echoes the Landing-page aesthetic:
// Carlorbiz green headings, gold accent for links/strong, comfortable reading rhythm.
const CARLORBIZ_PROSE = [
  'prose prose-lg max-w-none font-body',
  // Headings
  'prose-headings:font-heading prose-headings:font-extrabold prose-headings:tracking-tight',
  'prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:text-[#2D7E32] prose-h2:mt-8 prose-h2:mb-3',
  'prose-h3:text-xl md:prose-h3:text-2xl prose-h3:text-[#2D7E32] prose-h3:mt-6 prose-h3:mb-2',
  'prose-h4:text-lg prose-h4:text-[#2E4A3A] prose-h4:font-bold prose-h4:mt-5 prose-h4:mb-2',
  // Body
  'prose-p:text-[#2E4A3A] prose-p:leading-relaxed prose-p:my-4',
  // Strong / emphasis
  'prose-strong:text-[#2D7E32] prose-strong:font-bold',
  'prose-em:text-[#2E4A3A]',
  // Links — gold, underlined subtly, turns green on hover
  'prose-a:text-[#D5B13A] prose-a:font-semibold prose-a:underline prose-a:underline-offset-4 prose-a:decoration-[#D5B13A]/40 hover:prose-a:text-[#2D7E32] hover:prose-a:decoration-[#2D7E32]',
  // Lists
  'prose-ul:my-4 prose-ul:pl-5 prose-li:my-1.5 prose-li:text-[#2E4A3A]',
  'prose-ol:my-4 prose-ol:pl-5',
  'marker:text-[#D5B13A]',
  // Blockquotes — Landing-style left border accent, white/50 bg
  'prose-blockquote:border-l-4 prose-blockquote:border-[#2D7E32] prose-blockquote:pl-6 prose-blockquote:py-2',
  'prose-blockquote:bg-[#F9F9F9] prose-blockquote:text-xl prose-blockquote:text-[#2E4A3A] prose-blockquote:font-bold prose-blockquote:not-italic',
  // Horizontal rules — subtle gold gradient divider
  'prose-hr:border-0 prose-hr:h-px prose-hr:my-8 prose-hr:bg-gradient-to-r prose-hr:from-transparent prose-hr:via-[#D5B13A]/60 prose-hr:to-transparent',
  // Code
  'prose-code:text-[#2D7E32] prose-code:bg-[#F9F9F9] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-code:font-mono prose-code:text-sm',
].join(' ');

function AccordionContentRenderer({ tab }: { tab: { content_type: string; file_url: string | null; content: string; description?: string | null } }) {
  // Render description as intro text above PDFs and other media
  const descriptionBlock = tab.description ? (
    <div className={`${CARLORBIZ_PROSE} mb-8`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{tab.description}</ReactMarkdown>
    </div>
  ) : null;

  switch (tab.content_type) {
    case 'video':
      return (
        <>
          {descriptionBlock}
          {tab.file_url ? (
            <VideoViewer url={tab.file_url} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Video URL not yet configured.</p>
          )}
        </>
      );
    case 'pdf':
      return (
        <>
          {descriptionBlock}
          {tab.file_url ? (
            // Detect embeddable URLs (Gamma, Google Slides, Canva, etc.) and render as iframe
            /gamma\.app\/embed|docs\.google\.com\/presentation|canva\.com\/design/.test(tab.file_url) ? (
              <div className="w-full rounded-lg overflow-hidden border" style={{ aspectRatio: '16/9' }}>
                <iframe
                  src={tab.file_url}
                  className="w-full h-full"
                  style={{ border: 'none', minHeight: '500px' }}
                  allow="fullscreen"
                  loading="lazy"
                  title={tab.label}
                />
              </div>
            ) : (
              <PDFViewer fileUrl={tab.file_url} title="Document" />
            )
          ) : (
            <p className="text-sm text-muted-foreground italic">PDF not yet uploaded.</p>
          )}
        </>
      );
    case 'cards':
      return (
        <>
          {descriptionBlock}
          {tab.file_url ? (
            <CardGrid data={tab.file_url} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Card data not yet configured.</p>
          )}
        </>
      );
    case 'nera':
      return (
        <div className="space-y-0">
          {/* Intro text */}
          {tab.description && (
            <div className={`${CARLORBIZ_PROSE} mb-6`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{tab.description}</ReactMarkdown>
            </div>
          )}

          {/* Two demo sections */}
          <div className="space-y-8">
            {/* Section 1: Knowledge Q&A */}
            <div>
              <h3 className="font-heading text-xl font-bold text-[#2D7E32] mb-1">Knowledge Q&A</h3>
              <p className="text-sm text-gray-500 mb-4">Ask Nera about Carlorbiz services, methodology, or pricing — she draws on the same knowledge base we build for clients.</p>
              <NeraInlineViewer intro={null} />
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-[#D5B13A]/40 to-transparent" />

            {/* Section 2: Fixed-path survey demo */}
            <div>
              <h3 className="font-heading text-xl font-bold text-[#2D7E32] mb-1">Conversational Survey</h3>
              <p className="text-sm text-gray-500 mb-4">Unlike a survey, Nera doesn't ask everyone the same questions. See what a conversation captures that a 1–5 rating scale never will.</p>
              <NeraInlineViewer
                intro={null}
                interviewMode={{
                  systemPrompt: `You are Nera, demonstrating how conversational surveys replace traditional form-based surveys (SurveyMonkey, Google Forms, Microsoft Forms). This is a live demo on the Carlorbiz website.

## CONVERSATION FLOW

You are running a 3-question conversational survey. You can see the FULL conversation history. Count user messages to know which step you're on.

**QUESTION 1** has already been asked (the opener). The user has just answered it — they've described a workplace challenge.

**QUESTION 2 — your first response:**
Acknowledge what they said (1 sentence, reference their specific words). Then ask:
"What's the real cost of that — not just in money, but in time, trust, or morale? What does your team lose because this isn't working?"

**QUESTION 3 — your second response:**
Acknowledge what they said (1 sentence). Then ask:
"If you could wave a magic wand and have it work properly tomorrow, what would actually change for your team day-to-day?"

**INSIGHT CARD — your third response:**
Do NOT ask another question. Deliver this EXACT markdown structure:

---

**What a traditional survey would have captured:**
⭐⭐⭐ — "Somewhat dissatisfied" (and nothing else)

**What this 90-second conversation captured:**

| | |
|---|---|
| **Challenge** | [what they described in Q1 — their words] |
| **Real cost** | [the impact they described in Q2 — time, trust, morale] |
| **Root cause** | [your inference from their answers — the systemic issue underneath] |
| **What good looks like** | [their Q3 answer — what would change] |
| **Sentiment** | [nuanced read — e.g. "Carrying the load willingly but running out of runway"] |

**At scale:** Nera conducts hundreds of these conversations simultaneously — with your customers, your staff, your stakeholders. Each one is tagged, cross-referenced, and analysed for patterns. No more spreadsheets of star ratings. You get the themes your organisation can't see from inside.

**This is what we build.** → [See the Nera Platform](/services#the-nera-platform)

---

## Rules:
- Warm, direct, Australian English
- 1-2 sentences acknowledgement + 1 question per response. Nothing more.
- NEVER repeat or rephrase a question the user has already answered
- NEVER ask a fourth question. After Q3 response → insight card, full stop.
- Do NOT introduce yourself
- Do NOT sell during questions`,
                  opener: "What's the one thing in your organisation that takes up far more time or energy than it should — the process, the system, or the task that makes you think *there has to be a better way*?",
                  suggestedPrompts: [
                    "Keeping our online resources current and relevant",
                    "Board papers, action items, and governance tracking",
                    "Admin volume — contracts, reporting, and compliance",
                  ],
                }}
              />
            </div>

            {/* Transition to Layer 2 — standalone page */}
            <div className="rounded-xl border-2 border-[#D5B13A]/30 bg-gradient-to-br from-[#D5B13A]/5 to-transparent p-6 space-y-4">
              <p className="text-sm text-foreground leading-relaxed italic">
                &ldquo;Unlike a survey, Nera doesn&rsquo;t ask everyone the same questions. She listens to what you actually say &mdash; and follows that thread. Every conversation is different. Every insight card reflects you.&rdquo;
              </p>
              <p className="text-xs text-muted-foreground">
                That was a fixed-path conversation. The full version follows your thread &mdash; three scenarios, branching questions, personalised insight cards.
              </p>
              <a
                href="/nera-demo"
                className="inline-flex items-center gap-2 bg-[#2D7E32] text-white font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity text-sm"
              >
                Try the full experience →
              </a>
            </div>
          </div>
        </div>
      );
    case 'decision-tree':
      // tab.content holds the decision tree slug (e.g. "what-will-it-cost")
      return (
        <>
          {descriptionBlock}
          <DecisionTreeInlineViewer slug={tab.content} />
        </>
      );
    case 'text':
    default:
      return tab.content ? (
        <div className={CARLORBIZ_PROSE}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{tab.content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">Content coming soon.</p>
      );
  }
}
