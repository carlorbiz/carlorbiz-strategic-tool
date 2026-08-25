-- =============================================================================
-- 0018_demo_kestrel_mutual.sql — CC-231: the fourth public demo
--
-- Adds Kestrel Mutual (a1b2c3d4-0004-4000-8000-000000000001) to the single
-- source of truth for "what counts as a demo" so the anonymous /demo session
-- can read it under the demo-scoped RLS from migration 0012. The seed itself
-- lives in supabase/seed/demo/kestrel-mutual.sql and is applied after this.
--
-- Client mirror to keep in sync: client/src/lib/demo.ts DEMO_ENGAGEMENT_IDS.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION st_is_demo_engagement(eng_id UUID)
RETURNS BOOLEAN AS $$
  SELECT eng_id IN (
    'a1b2c3d4-0001-4000-8000-000000000001',  -- Acme Catering Group
    'a1b2c3d4-0002-4000-8000-000000000001',  -- National Allied Health Peak Council
    'a1b2c3d4-0003-4000-8000-000000000001',  -- Rural Futures Australia
    'a1b2c3d4-0004-4000-8000-000000000001'   -- Kestrel Mutual (AI strategy, CC-231)
  );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION st_is_demo_engagement(UUID) IS
  'TRUE if the engagement is one of the four public, read-only demo engagements. Single source of truth for demo-scoped RLS (migration 0012; Kestrel Mutual added in 0018). Update here if demos are re-seeded under new UUIDs.';

COMMIT;
