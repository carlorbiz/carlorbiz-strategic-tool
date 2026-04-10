-- ============================================================================
-- Migration: Add Carlorbiz-specific dimensions to knowledge_chunks and
--            multi-turn conversation columns to nera_queries
--
-- Context: The nera-query edge function was updated to support Carlorbiz
-- industry/role/service_area filtering and multi-turn triage conversations,
-- but the database schema was not updated to match. Without these columns,
-- Supabase PostgREST returns schema errors on SELECT/INSERT, causing Nera
-- to return "I don't have that information" for every query.
--
-- Run this migration in the Supabase SQL editor AFTER deploying the updated
-- nera-query edge function. The function is defensive — it works without
-- these columns (filtering is skipped, multi-turn fields are omitted from
-- INSERT) — but adding them enables richer retrieval and conversation tracking.
-- ============================================================================

-- 1. knowledge_chunks: Carlorbiz filtering dimensions
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS target_industry TEXT,
  ADD COLUMN IF NOT EXISTS target_role TEXT,
  ADD COLUMN IF NOT EXISTS service_area TEXT,
  ADD COLUMN IF NOT EXISTS engagement_stage TEXT;

COMMENT ON COLUMN knowledge_chunks.target_industry IS 'Industry vertical: healthcare, education, peak-body, professional-services, cross-sector';
COMMENT ON COLUMN knowledge_chunks.target_role IS 'Target audience role: ceo, board, operations, general';
COMMENT ON COLUMN knowledge_chunks.service_area IS 'Service pillar: strategic-clarity, implementation, knowledge-systems, cross-service';
COMMENT ON COLUMN knowledge_chunks.engagement_stage IS 'DAIS stage: discover, architect, implement, sustain';

-- Indexes for common filter patterns
CREATE INDEX IF NOT EXISTS idx_chunks_target_industry ON knowledge_chunks (target_industry) WHERE target_industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_service_area ON knowledge_chunks (service_area) WHERE service_area IS NOT NULL;

-- 2. nera_queries: Multi-turn conversation tracking
ALTER TABLE nera_queries
  ADD COLUMN IF NOT EXISTS response_type TEXT DEFAULT 'answer',
  ADD COLUMN IF NOT EXISTS clarification_options JSONB,
  ADD COLUMN IF NOT EXISTS turn_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accumulated_context JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN nera_queries.response_type IS 'answer or clarification (triage question)';
COMMENT ON COLUMN nera_queries.clarification_options IS 'Array of {label, value} options shown to user during triage';
COMMENT ON COLUMN nera_queries.turn_number IS 'Conversation turn number within a session';
COMMENT ON COLUMN nera_queries.accumulated_context IS 'Accumulated triage answers for multi-turn context';

-- 3. content_gap_signals: Track knowledge base gaps detected by Nera
CREATE TABLE IF NOT EXISTS content_gap_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id UUID REFERENCES nera_queries(id) ON DELETE SET NULL,
  session_id TEXT,
  user_id UUID,
  query_text TEXT NOT NULL,
  gap_type TEXT NOT NULL,
  topic TEXT,
  detected_intent TEXT,
  detected_pathway TEXT,
  detected_classification TEXT,
  suggested_resource_type TEXT,
  confidence_score NUMERIC(3,2),
  related_sources TEXT[],
  status TEXT DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gap_signals_status ON content_gap_signals (status);
COMMENT ON TABLE content_gap_signals IS 'Tracks queries where Nera could not find adequate knowledge chunks — used to identify content gaps';
