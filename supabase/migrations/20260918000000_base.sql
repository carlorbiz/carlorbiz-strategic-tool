-- =============================================================================
-- Strategy Engine — base schema (client-owned deployment)
-- supabase/migrations/20260918000000_base.sql
--
-- The minimal subset of the carlorbiz-website DEFINITIVE_MIGRATION.sql that
-- migrations/strategic-tool/0001-0020 depend on. Nothing else from the website
-- schema (tabs, folders, decision_trees, app_settings, feedback, insights) is
-- created: a client project runs the engine only.
--
-- Copied from DEFINITIVE_MIGRATION.sql with these deliberate differences:
--   * knowledge_chunks.source_tab_id keeps its column (readers select "*") but
--     drops the FK to the website's tabs table, which does not exist here.
--   * ai_config is created for schema parity only. No engine edge function or
--     engine UI reads it (grep 18 Sep 2026), and the Carlorbiz-specific column
--     defaults and seed row are NOT carried over.
--   * The "Public read knowledge_chunks" policy is not created; migration 0014
--     replaces it with engagement-scoped policies in the same bundle anyway.
--
-- Every statement is idempotent (IF NOT EXISTS / DO blocks) so the bundle can
-- be re-applied to a project that was set up by hand from the older files.
-- =============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4() (0001+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid() (0004, campaign tokens)


-- ─── user_profiles ────────────────────────────────────────────────────────────
-- IDENTITY CONTRACT: id must equal user_id must equal the auth.users id.
-- st_user_engagement_roles.user_id FKs user_profiles(id) but the RLS helpers
-- compare it to auth.uid(); only id = user_id = auth uid satisfies both.
-- scripts/bootstrap-admin.sql and the st-provision-* functions honour this.

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'external_stakeholder',
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ─── ai_config (website-era global LLM settings; unused by the engine) ────────

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
  client_name TEXT,
  support_contact TEXT,
  default_pathway TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ─── knowledge_chunks ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_tab_id UUID,                 -- website column kept for shape; no FK here
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


-- ─── nera_queries ─────────────────────────────────────────────────────────────

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


-- ─── Row level security ───────────────────────────────────────────────────────

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nera_queries ENABLE ROW LEVEL SECURITY;

-- Verbatim from DEFINITIVE_MIGRATION.sql. NOTE for a later slice: this policy
-- lets any authenticated user update any user_profiles row (including role).
-- The engine's AuthContext relies on the INSERT half to self-create a profile
-- on first sign-in, so it is carried over unchanged here rather than rewritten.
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
