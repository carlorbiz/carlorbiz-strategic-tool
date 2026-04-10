/**
 * Seed script for accordion page tabs.
 * Run manually against a Supabase instance to establish the content structure
 * for /about-me and /services accordion pages.
 *
 * Usage: npx tsx scripts/seed-accordion-tabs.ts
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars
 * (or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for direct DB access).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TOOLS_CARDS_JSON = JSON.stringify([
  {
    title: 'Exec Reclaim',
    tagline: 'Privacy-first executive return-to-work tracking',
    href: 'https://exec-reclaim.mtmot.com',
    category: 'PWA Tools',
  },
  {
    title: 'MindGames',
    tagline: 'Cognitive sharpening for executives rebuilding confidence',
    href: 'https://mindgames-app.mtmot.com',
    category: 'PWA Tools',
  },
  {
    title: 'Executive AI Advisor (CJ)',
    tagline: 'AI advisory SaaS for C-suite executives on AI adoption',
    href: 'https://executive-ai-advisor.mtmot.com',
    category: 'PWA Tools',
  },
  {
    title: 'AI Confidence Accelerator',
    tagline: '30-day executive AI literacy course',
    href: 'https://makethemostoftoday.com',
    category: 'Courses',
  },
  {
    title: 'MTMOT Community',
    tagline: 'Coaching, resources, and peer support for leaders',
    href: 'https://makethemostoftoday.com',
    category: 'Community',
  },
]);

const tabs = [
  // /about-me tabs
  {
    slug: 'about-changing-narrative',
    label: 'Changing the Narrative',
    icon: '',
    content: '',
    order_index: 1,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_VIDEO_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'video',
    summary:
      "A career built on unexpected pivots has taught me one thing: disruption isn't something you survive. It's something you mine.",
    page_slug: 'about-me',
  },
  {
    slug: 'about-building-now',
    label: 'What I\'m Building Now',
    icon: '',
    content: '',
    order_index: 2,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_PDF_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'pdf',
    summary:
      'AI-powered knowledge platforms for ACRRM and RWAV — proof that deep expertise can be structured, accessible, and lasting.',
    page_slug: 'about-me',
  },
  {
    slug: 'about-three-decades',
    label: 'Three Decades of Transformation',
    icon: '',
    content: '',
    order_index: 3,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_PDF_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'pdf',
    summary:
      'From 135-outlet hospitality scale to 10,000-member peak body turnaround to 30+ country digital reach.',
    page_slug: 'about-me',
  },
  {
    slug: 'about-adversity-advantage',
    label: 'The Adversity Advantage',
    icon: '',
    content: '',
    order_index: 4,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_VIDEO_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'video',
    summary:
      "In 2015, I was diagnosed with stage 4 cancer mid-career. Here's what that taught me about strategy.",
    page_slug: 'about-me',
  },
  {
    slug: 'about-how-i-work',
    label: 'How I Actually Work',
    icon: '',
    content:
      '## My Approach\n\nStrategic clarity first. Systems that outlast the engagement. Honest challenge. AI integrated, not AI-led.\n\n### What You Get\n\n- **Discovery & diagnosis** — I listen before I advise. The real problem is rarely the presenting problem.\n- **Strategic frameworks** — Bespoke, not borrowed. Your strategy should be as unique as your organisation.\n- **Implementation infrastructure** — Plans that actually get executed, with accountability built in.\n- **Knowledge transfer** — I work myself out of a job. Your team should be stronger after I leave.',
    order_index: 5,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: null,
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'text',
    summary:
      'Strategic clarity first. Systems that outlast the engagement. Honest challenge. AI integrated, not AI-led.',
    page_slug: 'about-me',
  },
  {
    slug: 'about-tools-products',
    label: 'Tools & Products',
    icon: '',
    content: '',
    order_index: 6,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: TOOLS_CARDS_JSON,
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'cards',
    summary:
      'Digital tools, workbooks, and courses for leaders navigating AI and complexity — under the MTMOT brand.',
    page_slug: 'about-me',
  },

  // /services tabs
  {
    slug: 'services-central-question',
    label: 'The Central Question',
    icon: '',
    content: '',
    order_index: 1,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_VIDEO_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'video',
    summary:
      'What can you do that no one else can? Everything else flows from that answer.',
    page_slug: 'services',
  },
  {
    slug: 'services-strategic-consulting',
    label: 'Strategic Consulting',
    icon: '',
    content: '',
    order_index: 2,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_PDF_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'pdf',
    summary:
      'POD discovery, strategic planning, business model innovation, change management.',
    page_slug: 'services',
  },
  {
    slug: 'services-ai-knowledge-systems',
    label: 'AI-Powered Knowledge Systems',
    icon: '',
    content: '',
    order_index: 3,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_PDF_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'pdf',
    summary:
      "Turning your organisation's deep expertise into a living, accessible, AI-queryable resource.",
    page_slug: 'services',
  },
  {
    slug: 'services-nera-pwa-template',
    label: 'Nera PWA Template',
    icon: '',
    content: '',
    order_index: 4,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_PDF_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'pdf',
    summary:
      'A production-ready knowledge platform — open for licensing and custom deployment.',
    page_slug: 'services',
  },
  {
    slug: 'services-why-this-works',
    label: 'Why This Approach Works',
    icon: '',
    content:
      '## Built on Your Unique Context\n\nEvery engagement starts with understanding what makes your organisation irreplaceable. Not what the market says you should be — what you actually are at your best.\n\n### The Three Pillars\n\n1. **Strategic Clarity** — Cut through complexity to find the one thing that changes everything\n2. **Implementation Infrastructure** — Build systems that outlast the consulting engagement\n3. **Knowledge Transfer** — Your team owns the strategy, not the consultant\n\n### Why AI Changes Everything\n\nAI doesn\'t replace strategic thinking — it amplifies it. The organisations that will thrive are those that structure their deep expertise into systems that AI can enhance, not those that outsource their thinking to AI.',
    order_index: 5,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: null,
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'text',
    summary:
      'Strategy built on your unique context. Implementation infrastructure. Clarity over complexity.',
    page_slug: 'services',
  },
  {
    slug: 'services-case-studies',
    label: 'Case Studies',
    icon: '',
    content: '',
    order_index: 6,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: 'PLACEHOLDER_PDF_URL',
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'pdf',
    summary:
      'ACRRM and RWAV — proof points for the AI Knowledge Systems service.',
    page_slug: 'services',
  },
];

async function seed() {
  console.log(`Seeding ${tabs.length} accordion tabs...`);

  // Upsert by slug to avoid duplicates on re-run
  for (const tab of tabs) {
    const { error } = await supabase
      .from('tabs')
      .upsert(tab, { onConflict: 'slug' });

    if (error) {
      console.error(`Failed to seed tab "${tab.label}":`, error.message);
    } else {
      console.log(`  ✓ ${tab.page_slug}/${tab.label}`);
    }
  }

  console.log('Done.');
}

seed();
