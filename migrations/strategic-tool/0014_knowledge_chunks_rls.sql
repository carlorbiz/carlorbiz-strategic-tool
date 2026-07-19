-- =============================================================================
-- 0014_knowledge_chunks_rls.sql  (CC-104 — knowledge_chunks tenant isolation)
-- =============================================================================
-- Replaces the convention-only isolation on the SHARED knowledge_chunks table
-- with enforced RLS.
--
-- BEFORE this migration:
--   SELECT  "Public read knowledge_chunks"        USING (true)
--           → any anon-key client can read EVERY engagement's client evidence.
--   ALL     "Admins can manage knowledge chunks"  USING (auth.role() = 'authenticated')
--           → any authenticated user (incl. anonymous demo sessions) can
--             write/alter ANY chunk.
--
-- Reader reality (why Phase A is zero-regression):
--   Every edge reader (carlorbiz-website `nera-query`, `st-nera-query`,
--   `feedback-chat`) uses the SERVICE_ROLE_KEY, which BYPASSES RLS. No
--   frontend anon-key SELECT of knowledge_chunks exists in this repo.
--   → tightening SELECT breaks nothing.
--
-- Writer reality (why Phase B is Carla-gated):
--   Two frontend anon-key INSERT paths exist —
--     client/src/components/engagement/DeliverableComposer.tsx
--     client/src/lib/insightsApi.ts
--   Both run inside admin-only SPA surfaces; both callers are internal_admin
--   sessions today. Phase B re-scopes writes from "any authenticated user" to
--   internal_admin, which those paths rely on. If you want to land the read
--   fence first and hold the write fence, comment out the Phase B block below.
--
-- Helper used: st_is_admin()  (0001_init.sql:647) — SECURITY DEFINER STABLE,
--   returns true when user_profiles.role = 'internal_admin' for auth.uid().
--
-- NOT YET APPLIED. Apply with:
--   supabase db execute --file migrations/strategic-tool/0014_knowledge_chunks_rls.sql
--   (or paste into the SQL editor / `psql`). Run the regression checks in the
--   CC-104 report immediately after.
-- =============================================================================

BEGIN;

-- ── Phase A: SELECT isolation (zero regression — all edge readers use service-role) ──

DROP POLICY IF EXISTS "Public read knowledge_chunks"            ON knowledge_chunks;
DROP POLICY IF EXISTS "Knowledge chunks are viewable by everyone" ON knowledge_chunks;

-- carlorbiz-website chunks (engagement_id IS NULL) stay publicly readable so the
-- website's public RAG keeps working even if a caller ever uses the anon key.
CREATE POLICY "Public read website chunks"
  ON knowledge_chunks FOR SELECT
  USING (engagement_id IS NULL);

-- strategic-tool chunks are readable only by internal_admins or by users with a
-- live (non-revoked) role on that specific engagement.
CREATE POLICY "Members read own engagement chunks"
  ON knowledge_chunks FOR SELECT
  USING (
    engagement_id IS NOT NULL AND (
      st_is_admin()
      OR EXISTS (
        SELECT 1 FROM st_user_engagement_roles r
        WHERE r.user_id = auth.uid()
          AND r.engagement_id = knowledge_chunks.engagement_id
          AND r.revoked_at IS NULL
      )
    )
  );

-- ── Phase B: WRITE tightening (CARLA-GATED — see header note) ──
-- Re-scopes writes from "any authenticated user" to internal_admin. The two
-- frontend anon-key inserters (DeliverableComposer, insightsApi) run as
-- internal_admin SPA sessions, so this closes the write hole without breaking
-- them. Comment this block out to defer Phase B and ship Phase A alone.

DROP POLICY IF EXISTS "Admins can manage knowledge chunks" ON knowledge_chunks;
CREATE POLICY "Admins manage knowledge chunks"
  ON knowledge_chunks FOR ALL
  USING      (st_is_admin())
  WITH CHECK (st_is_admin());

COMMIT;
