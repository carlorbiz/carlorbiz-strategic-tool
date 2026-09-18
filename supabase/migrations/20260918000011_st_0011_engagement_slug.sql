-- =============================================================================
-- Carlorbiz Strategic Tool — Engagement slug field for shareable URLs
-- migrations/strategic-tool/0011_engagement_slug.sql
--
-- Adds a human-readable slug column to st_engagements so prospects can be
-- handed URLs like /e/rural-futures-australia rather than /e/b93cb5 or a
-- raw UUID. Slug is UNIQUE; short_code remains for back-compat (existing
-- URLs keep working).
--
-- fetchEngagement() in client/src/lib/engagementApi.ts is updated in the
-- same commit to resolve URL params in priority order: UUID → slug →
-- short_code.
--
-- Backfill of the Rural Futures Australia demo engagement to slug
-- 'rural-futures-australia' is performed via execute_sql, not in this
-- migration, so the schema migration stays clean of demo-specific data.
-- =============================================================================

BEGIN;

ALTER TABLE st_engagements
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Slug must be unique when set (NULLs allowed for engagements without one yet)
CREATE UNIQUE INDEX IF NOT EXISTS idx_st_engagements_slug
  ON st_engagements (slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN st_engagements.slug IS
  'Human-readable URL slug. Lowercase, hyphenated, ASCII. Unique when set. Used in /e/:slug routes alongside the legacy short_code path. NULL for engagements created before this column was added or where a clean URL is not yet wanted.';

COMMIT;
