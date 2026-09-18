-- =============================================================================
-- Carlorbiz Strategic Tool — Pillar sovereignty_claim field
-- migrations/strategic-tool/0010_pillar_sovereignty_claim.sql
--
-- Forces every pillar to carry an explicit sovereignty-commitment statement
-- (what IP, what controls, what behaviours the organisation has committed to
-- holding). This is the architectural anchor for the Sovereignty Drift
-- diagnostic lens of the Drift Trilogy: the tool watches for drift between
-- the sovereignty_claim (the position the organisation has committed to)
-- and the actual practice when work has left the office walls.
--
-- Parallels migration 0009 (distinctiveness_claim, commit cb72390) for the
-- Generic Drift lens. Same shape: nullable TEXT column with COMMENT.
--
-- The six sovereignty drift signals locked at chapter-section granularity
-- in Sovereignty Drift Ch 5 outline (3639440556f78138bb8fdd7f42255555):
--   1. Shadow AI usage
--   2. Off-system IP creation
--   3. Contractor-blur boundaries
--   4. AI-tool licensing exposure
--   5. Data-residency drift
--   6. Oversight-without-visibility
-- The SovereigntyDriftSampleNeraQuestions widget (queued under CC-11) will
-- read these prompts against the sovereignty_claim and the corpus.
--
-- Used by (all queued under CC-11, sequenced behind the Generic Drift queue):
--   - SovereigntyDriftSampleNeraQuestions widget
--   - Sovereignty signal column on Pillar Briefing report template
--   - Sovereignty Drift Detection report template
--   - sovereignty-watch consulting profile
-- =============================================================================

BEGIN;

ALTER TABLE st_organisational_pillars
  ADD COLUMN IF NOT EXISTS sovereignty_claim TEXT;

COMMENT ON COLUMN st_organisational_pillars.sovereignty_claim IS
  'The sovereignty commitment that anchors this pillar: what IP, what controls, what behaviours the organisation has committed to holding. If the organisation cannot point to evidence that the commitment is being honoured in practice, sovereignty has drifted.';

COMMIT;
