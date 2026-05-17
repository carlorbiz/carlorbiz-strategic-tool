-- =============================================================================
-- Carlorbiz Strategic Tool — Pillar distinctiveness_claim field
-- migrations/strategic-tool/0009_pillar_distinctiveness_claim.sql
--
-- Forces every pillar to carry an explicit point-of-difference statement,
-- not just a soft virtue. This is the architectural anchor for the Generic
-- Drift diagnostic lens: the tool watches for drift between the
-- distinctiveness_claim (the position the organisation has committed to)
-- and the evidence streaming in via the corpus.
--
-- If a peer organisation could substitute the same distinctiveness_claim
-- language verbatim, the pillar has not yet earned this field. The field
-- is intentionally optional at the database level so existing pillars
-- continue to load, but the editor UI treats an empty value as a prompt
-- to articulate one.
--
-- Used by:
--   - Pillar Briefing report (new "distinctiveness signal" column,
--     queued tool change #4) — assesses whether the corpus evidence
--     supporting this pillar would equally support a peer's claim.
--   - Generic Drift Detection report (queued tool change #5) — the
--     verbal-actual lag detection runs the claim against the corpus
--     language over time.
-- =============================================================================

BEGIN;

ALTER TABLE st_organisational_pillars
  ADD COLUMN IF NOT EXISTS distinctiveness_claim TEXT;

COMMENT ON COLUMN st_organisational_pillars.distinctiveness_claim IS
  'The point-of-difference statement that justifies this pillar as not-generic. If a peer organisation could substitute the same language, the pillar has not yet earned this field.';

COMMIT;
