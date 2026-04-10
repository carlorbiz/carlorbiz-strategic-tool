-- ============================================================
-- URL Resources Table + Ingestion Support
-- Purpose: Store external URL resources for ingestion into
--          the knowledge base alongside PDFs and media.
-- Date: March 2026
-- ============================================================

-- URL Resources table
CREATE TABLE IF NOT EXISTS url_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  chunk_count INT DEFAULT 0,
  content_hash TEXT,
  last_fetched TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_url_resources_active
  ON url_resources (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_url_resources_category
  ON url_resources (category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_url_resources_tags
  ON url_resources USING gin (tags) WHERE is_active = true;

-- RLS: public read active, authenticated write
ALTER TABLE url_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active url_resources"
  ON url_resources FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage url_resources"
  ON url_resources FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================
-- Add source_type and source_id to knowledge_chunks if not present.
-- These allow chunks to reference their origin (pdf, audio, video, url).
-- source_tab_id already handles tab-based sources; these handle
-- direct ingestion sources like URL resources.
-- ============================================================

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS source_type TEXT;

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS idx_chunks_source_type
  ON knowledge_chunks (source_type) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_chunks_source_id
  ON knowledge_chunks (source_id) WHERE is_active = true;
