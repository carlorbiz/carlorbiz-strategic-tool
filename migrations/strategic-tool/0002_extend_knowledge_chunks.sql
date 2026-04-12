-- =============================================================================
-- Carlorbiz Strategic Tool — Extend knowledge_chunks for multi-app scoping
-- migrations/strategic-tool/0002_extend_knowledge_chunks.sql
--
-- Adds source_app and engagement_id columns to the SHARED knowledge_chunks
-- table so that strategic-tool's chunks can be isolated from carlorbiz-website's
-- chunks without a separate table.
--
-- This is the only migration that touches a non-st_* table. It's intentionally
-- minimal and additive — no existing columns are modified, no existing data
-- is changed in meaning, and the backfill sets safe defaults.
--
-- Pre-requisites:
--   - knowledge_chunks table exists (from DEFINITIVE_MIGRATION.sql)
--   - migrations/strategic-tool/0001_init.sql has been run (for st_engagements FK)
--
-- IMPORTANT: strategic-tool queries MUST always filter by
--   source_app = 'strategic-tool' AND engagement_id = <uuid>
-- This is enforced by convention, not by RLS (because carlorbiz-website's
-- existing "Public read" policy on knowledge_chunks must remain unchanged).
-- =============================================================================

BEGIN;

-- ─── Add columns ────────────────────────────────────────────────────────────

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS source_app TEXT;

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS engagement_id UUID;

-- FK to st_engagements (nullable — carlorbiz-website rows have NULL)
-- Using a DO block because ADD CONSTRAINT doesn't support IF NOT EXISTS
DO $$ BEGIN
  ALTER TABLE knowledge_chunks
    ADD CONSTRAINT fk_chunks_engagement
    FOREIGN KEY (engagement_id)
    REFERENCES st_engagements(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Backfill existing rows ─────────────────────────────────────────────────
-- All existing knowledge_chunks rows belong to carlorbiz-website.
-- Set source_app for any row that doesn't have it yet.

UPDATE knowledge_chunks
SET source_app = 'carlorbiz-website'
WHERE source_app IS NULL;

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chunks_source_app
  ON knowledge_chunks (source_app)
  WHERE source_app IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chunks_engagement_id
  ON knowledge_chunks (engagement_id)
  WHERE engagement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chunks_st_scoped
  ON knowledge_chunks (source_app, engagement_id)
  WHERE source_app = 'strategic-tool';

-- ─── Comments ───────────────────────────────────────────────────────────────

COMMENT ON COLUMN knowledge_chunks.source_app IS
  'Which application owns this chunk. Values: carlorbiz-website, strategic-tool. '
  'Strategic-tool queries MUST filter by source_app + engagement_id.';

COMMENT ON COLUMN knowledge_chunks.engagement_id IS
  'FK to st_engagements. NULL for carlorbiz-website chunks. '
  'Non-null for all strategic-tool chunks (mandatory convention).';


COMMIT;

-- =============================================================================
-- NOTE: The existing RLS policy on knowledge_chunks is:
--   "Public read knowledge_chunks" — FOR SELECT USING (true)
--   "Admins can manage knowledge chunks" — FOR ALL USING (auth.role() = 'authenticated')
--
-- We do NOT modify these policies. Carlorbiz-website's public RAG reads
-- must continue to work. Strategic-tool scoping is enforced at the
-- application/query level (WHERE source_app = 'strategic-tool' AND
-- engagement_id = X), not at the RLS level.
--
-- When strategic-tool is extracted into its own Supabase project,
-- the new project's knowledge_chunks table will have stricter RLS
-- (engagement-scoped, matching the st_* pattern). But in the shared
-- project, we preserve backward compatibility.
-- =============================================================================
