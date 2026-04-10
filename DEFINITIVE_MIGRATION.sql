-- ============================================================================
-- CARLORBIZ.COM.AU — DEFINITIVE DATABASE SETUP
-- ============================================================================
-- Run this ONCE in Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- It uses IF NOT EXISTS / IF EXISTS everywhere so it's safe to re-run.
--
-- After running this, you MUST also:
--   1. Create your auth account (sign up via the app's /login page)
--   2. Run the ADMIN SETUP query at the bottom to give yourself admin access
-- ============================================================================


-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 1. CORE TABLES (app_settings, folders, tabs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  app_title TEXT NOT NULL DEFAULT 'Carlorbiz',
  header_subtitle TEXT NOT NULL DEFAULT 'Strategic Consulting',
  footer_text TEXT NOT NULL DEFAULT '© Carla Taylor t/as Carlorbiz',
  footer_links JSONB DEFAULT '[]'::jsonb,
  footer_sections JSONB DEFAULT '[]'::jsonb,
  welcome_banner JSONB,
  theme JSONB DEFAULT '{
    "primary_color": "#2F5233",
    "secondary_color": "#D9EAD3",
    "font_heading": "Merriweather",
    "font_body": "Inter",
    "radius": "0.75rem"
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📁',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tabs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_supplementary BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  file_url TEXT,
  toc_max_depth INTEGER,
  requires_auth BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings for Carlorbiz
INSERT INTO app_settings (id, app_title, header_subtitle, footer_text)
VALUES ('default', 'Carlorbiz', 'Strategic Consulting', '© Carla Taylor t/as Carlorbiz')
ON CONFLICT (id) DO UPDATE SET
  app_title = EXCLUDED.app_title,
  header_subtitle = EXCLUDED.header_subtitle,
  footer_text = EXCLUDED.footer_text;


-- ============================================================================
-- 2. ACCORDION PAGE COLUMNS (content_type, summary, page_slug)
-- ============================================================================

ALTER TABLE tabs
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS page_slug TEXT;

-- Add check constraint only if it doesn't exist
DO $$ BEGIN
  ALTER TABLE tabs ADD CONSTRAINT tabs_content_type_check
    CHECK (content_type IN ('video', 'pdf', 'text', 'cards'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tabs_page_slug ON tabs (page_slug);


-- ============================================================================
-- 3. USER PROFILES (for admin access)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'external_stakeholder',
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- 4. AI CONFIG (Nera prompts and LLM settings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  llm_provider TEXT NOT NULL DEFAULT 'anthropic',
  llm_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  system_prompt TEXT,
  classify_prompt TEXT,
  no_chunks_response TEXT,
  feedback_system_prompt TEXT,
  insights_prompt TEXT,
  synonym_map JSONB DEFAULT '{}'::jsonb,
  typo_patterns JSONB DEFAULT '[]'::jsonb,
  client_name TEXT DEFAULT 'Carlorbiz',
  support_contact TEXT DEFAULT 'carla@carlorbiz.com.au',
  default_pathway TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO ai_config (id, client_name, support_contact)
VALUES ('default', 'Carlorbiz', 'carla@carlorbiz.com.au')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 5. KNOWLEDGE CHUNKS (for Nera AI — needed later but create now)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  document_source TEXT,
  section_reference TEXT,
  chunk_text TEXT NOT NULL,
  chunk_summary TEXT,
  topic_tags TEXT[] DEFAULT '{}',
  content_type TEXT,
  pathway TEXT,
  classification TEXT,
  mm_category TEXT,
  employment_status TEXT,
  training_term TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  extraction_version TEXT DEFAULT '1.0',
  source_type TEXT,
  source_id UUID,
  fts TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(chunk_summary, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(chunk_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(section_reference, '')), 'C')
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_active ON knowledge_chunks (is_active);
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON knowledge_chunks USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_chunks_topic_tags ON knowledge_chunks USING gin(topic_tags);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON knowledge_chunks (source_tab_id);


-- ============================================================================
-- 6. NERA QUERY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS nera_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT,
  user_id UUID,
  query_text TEXT NOT NULL,
  response_text TEXT,
  chunks_used UUID[],
  sources_cited TEXT[],
  retrieval_method TEXT,
  feedback_score INTEGER,
  response_latency_ms INTEGER,
  confidence_score NUMERIC(3,2),
  detected_intent TEXT,
  detected_pathway TEXT,
  detected_classification TEXT,
  detected_mm_category TEXT,
  reviewed BOOLEAN DEFAULT false,
  test_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- 7. DECISION TREES (interactive guides)
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_trees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT '🗺️',
  tree_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_auth BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nera_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_trees ENABLE ROW LEVEL SECURITY;

-- Public read policies (safe to re-run — uses IF NOT EXISTS pattern via DO blocks)
DO $$ BEGIN
  CREATE POLICY "Public read app_settings" ON app_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read folders" ON folders FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read tabs" ON tabs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read decision_trees" ON decision_trees FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read knowledge_chunks" ON knowledge_chunks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated write policies
DO $$ BEGIN
  CREATE POLICY "Auth manage app_settings" ON app_settings FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth manage folders" ON folders FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth manage tabs" ON tabs FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth manage decision_trees" ON decision_trees FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth manage user_profiles" ON user_profiles FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role ai_config" ON ai_config FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth read nera_queries" ON nera_queries FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Insert nera_queries" ON nera_queries FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 9. SEED ACCORDION CONTENT (About Me + Services + Insights)
-- ============================================================================

-- About Me tabs
INSERT INTO tabs (slug, label, icon, content, order_index, is_visible, content_type, summary, page_slug, file_url) VALUES
('about-changing-narrative', 'Changing the Narrative', '', '', 1, true, 'video',
 'A career built on unexpected pivots has taught me one thing: disruption isn''t something you survive. It''s something you mine.',
 'about-me', NULL),
('about-building-now', 'What I''m Building Now', '', '', 2, true, 'pdf',
 'AI-powered knowledge platforms for ACRRM and RWAV — proof that deep expertise can be structured, accessible, and lasting.',
 'about-me', NULL),
('about-three-decades', 'Three Decades of Transformation', '', '', 3, true, 'pdf',
 'From 135-outlet hospitality scale to 10,000-member peak body turnaround to 30+ country digital reach.',
 'about-me', NULL),
('about-adversity-advantage', 'The Adversity Advantage', '', '', 4, true, 'video',
 'In 2015, I was diagnosed with stage 4 cancer mid-career. Here''s what that taught me about strategy.',
 'about-me', NULL),
('about-how-i-work', 'How I Actually Work', '', '## My Approach

Strategic clarity first. Systems that outlast the engagement. Honest challenge. AI integrated, not AI-led.

### What You Get

- **Discovery & diagnosis** — I listen before I advise. The real problem is rarely the presenting problem.
- **Strategic frameworks** — Bespoke, not borrowed. Your strategy should be as unique as your organisation.
- **Implementation infrastructure** — Plans that actually get executed, with accountability built in.
- **Knowledge transfer** — I work myself out of a job. Your team should be stronger after I leave.', 5, true, 'text',
 'Strategic clarity first. Systems that outlast the engagement. Honest challenge. AI integrated, not AI-led.',
 'about-me', NULL),
('about-tools-products', 'Tools & Products', '', '', 6, true, 'cards',
 'Digital tools, workbooks, and courses for leaders navigating AI and complexity — under the MTMOT brand.',
 'about-me', '[{"title":"Exec Reclaim","tagline":"Privacy-first executive return-to-work tracking","href":"https://exec-reclaim.mtmot.com","category":"PWA Tools"},{"title":"MindGames","tagline":"Cognitive sharpening for executives rebuilding confidence","href":"https://mindgames-app.mtmot.com","category":"PWA Tools"},{"title":"Executive AI Advisor (CJ)","tagline":"AI advisory SaaS for C-suite executives on AI adoption","href":"https://executive-ai-advisor.mtmot.com","category":"PWA Tools"},{"title":"AI Confidence Accelerator","tagline":"30-day executive AI literacy course","href":"https://makethemostoftoday.com","category":"Courses"},{"title":"MTMOT Community","tagline":"Coaching, resources, and peer support for leaders","href":"https://makethemostoftoday.com","category":"Community"}]')
ON CONFLICT (slug) DO NOTHING;

-- Services tabs
INSERT INTO tabs (slug, label, icon, content, order_index, is_visible, content_type, summary, page_slug, file_url) VALUES
('services-central-question', 'The Central Question', '', '', 1, true, 'video',
 'What can you do that no one else can? Everything else flows from that answer.',
 'services', NULL),
('services-strategic-consulting', 'Strategic Consulting', '', '', 2, true, 'pdf',
 'POD discovery, strategic planning, business model innovation, change management.',
 'services', NULL),
('services-ai-knowledge-systems', 'AI-Powered Knowledge Systems', '', '', 3, true, 'pdf',
 'Turning your organisation''s deep expertise into a living, accessible, AI-queryable resource.',
 'services', NULL),
('services-nera-pwa-template', 'Nera PWA Template', '', '', 4, true, 'pdf',
 'A production-ready knowledge platform — open for licensing and custom deployment.',
 'services', NULL),
('services-why-this-works', 'Why This Approach Works', '', '## Built on Your Unique Context

Every engagement starts with understanding what makes your organisation irreplaceable. Not what the market says you should be — what you actually are at your best.

### The Three Pillars

1. **Strategic Clarity** — Cut through complexity to find the one thing that changes everything
2. **Implementation Infrastructure** — Build systems that outlast the consulting engagement
3. **Knowledge Transfer** — Your team owns the strategy, not the consultant

### Why AI Changes Everything

AI doesn''t replace strategic thinking — it amplifies it. The organisations that will thrive are those that structure their deep expertise into systems that AI can enhance, not those that outsource their thinking to AI.', 5, true, 'text',
 'Strategy built on your unique context. Implementation infrastructure. Clarity over complexity.',
 'services', NULL),
('services-case-studies', 'Case Studies', '', '', 6, true, 'pdf',
 'ACRRM and RWAV — proof points for the AI Knowledge Systems service.',
 'services', NULL)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================================
-- DONE! Now do step 2: Create your admin account (see instructions below)
-- ============================================================================

-- STEP 2: ADMIN ACCOUNT SETUP
-- =============================
-- 1. Go to your carlorbiz website and navigate to /login
-- 2. Sign up with your email (carla@carlorbiz.com.au)
-- 3. Check your email for the confirmation link and confirm
-- 4. Then come back here and run this query (replace YOUR_USER_ID):
--
-- To find your user ID, run:
--   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
--
-- Then run:
--   INSERT INTO user_profiles (user_id, email, full_name, role)
--   VALUES ('YOUR_USER_ID_HERE', 'carla@carlorbiz.com.au', 'Carla Taylor', 'internal_admin')
--   ON CONFLICT (user_id) DO UPDATE SET role = 'internal_admin';
