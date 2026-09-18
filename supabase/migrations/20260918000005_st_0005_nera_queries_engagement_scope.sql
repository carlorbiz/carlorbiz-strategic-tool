-- =============================================================================
-- Carlorbiz Strategic Tool — Scope nera_queries to engagements
-- migrations/strategic-tool/0005_nera_queries_engagement_scope.sql
--
-- Adds engagement_id + source_app columns to the SHARED nera_queries table so
-- strategic-tool queries can be filtered out from carlorbiz-website queries and
-- attributed to a specific engagement.
--
-- Pre-requisites:
--   - nera_queries table exists (from DEFINITIVE_MIGRATION.sql)
--   - migrations/strategic-tool/0001_init.sql has been run (for st_engagements FK)
--
-- IMPORTANT: same convention as 0002 — strategic-tool reads/writes to nera_queries
-- MUST always filter by source_app = 'strategic-tool' AND engagement_id = <uuid>.
-- The existing website RLS on nera_queries is preserved.
-- =============================================================================

BEGIN;

ALTER TABLE nera_queries
  ADD COLUMN IF NOT EXISTS engagement_id UUID;

ALTER TABLE nera_queries
  ADD COLUMN IF NOT EXISTS source_app TEXT;

DO $$ BEGIN
  ALTER TABLE nera_queries
    ADD CONSTRAINT fk_nera_queries_engagement
    FOREIGN KEY (engagement_id)
    REFERENCES st_engagements(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_nera_queries_engagement
  ON nera_queries (engagement_id)
  WHERE engagement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nera_queries_source_app
  ON nera_queries (source_app)
  WHERE source_app IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nera_queries_st_scoped
  ON nera_queries (source_app, engagement_id, created_at DESC)
  WHERE source_app = 'strategic-tool';

COMMENT ON COLUMN nera_queries.engagement_id IS
  'FK to st_engagements. NULL for carlorbiz-website queries. '
  'Non-null for all strategic-tool queries.';

COMMENT ON COLUMN nera_queries.source_app IS
  'Which application owns this query log. Values: carlorbiz-website, strategic-tool. '
  'NULL on legacy rows from before this migration — backfill not required, treat as carlorbiz-website.';

COMMIT;
