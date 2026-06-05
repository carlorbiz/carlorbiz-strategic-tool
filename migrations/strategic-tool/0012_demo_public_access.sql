-- =============================================================================
-- Carlorbiz Strategic Tool — Public (anonymous) read-only access to the 3 demos
-- migrations/strategic-tool/0012_demo_public_access.sql
--
-- PURPOSE
--   Let a prospect open a shareable link, get an anonymous Supabase session
--   (supabase.auth.signInAnonymously() — role 'authenticated', is_anonymous=true,
--   NO row in st_user_engagement_roles), and browse the three seeded demo
--   engagements + step through the onboarding wizard — WITHOUT being able to
--   insert, update, or delete ANY demo data.
--
-- WHY THIS IS SAFE
--   Two independent layers, both scoped to the three well-known demo UUIDs only.
--   Real client engagements are never touched by anything in this file.
--
--   1. READ (permissive). RLS permissive policies are OR-combined, so adding a
--      "demo is readable" SELECT policy *widens* read to the demos for everyone
--      (incl. anonymous) on top of the existing role-gated policies. Non-demo
--      rows are unaffected — they still require an engagement role.
--
--   2. WRITE-LOCK (restrictive). RLS restrictive policies are AND-combined on
--      top of the permissive set, so a write must satisfy EVERY restrictive
--      policy. We add a restrictive INSERT/UPDATE/DELETE rule that evaluates
--      false for demo rows unless the actor is an internal_admin. This holds
--      even if a real engagement role is ever granted on a demo — belt and
--      braces over the fact that an anonymous prospect has no role at all.
--
-- IDEMPOTENT: safe to re-run (drops policies first). Wrapped in a transaction.
--
-- The three demo engagement IDs are the well-known UUIDs from
-- supabase/seed/demo/*.sql. If a demo is ever re-seeded under a new UUID,
-- update st_is_demo_engagement() below — that one function is the single
-- source of truth for "what counts as a demo".
-- =============================================================================

BEGIN;

-- ─── Single source of truth: which engagements are public demos ─────────────
CREATE OR REPLACE FUNCTION st_is_demo_engagement(eng_id UUID)
RETURNS BOOLEAN AS $$
  SELECT eng_id IN (
    'a1b2c3d4-0001-4000-8000-000000000001',  -- Acme Catering Group
    'a1b2c3d4-0002-4000-8000-000000000001',  -- National Allied Health Peak Council
    'a1b2c3d4-0003-4000-8000-000000000001'   -- Rural Futures Australia
  );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION st_is_demo_engagement(UUID) IS
  'TRUE if the engagement is one of the three public, read-only demo engagements. Single source of truth for demo-scoped RLS (migration 0012). Update here if demos are re-seeded under new UUIDs.';


-- ─── st_engagements: demo read + demo write-lock ────────────────────────────
DROP POLICY IF EXISTS st_engagements_demo_select ON st_engagements;
CREATE POLICY st_engagements_demo_select ON st_engagements
  FOR SELECT USING (st_is_demo_engagement(id));

DROP POLICY IF EXISTS st_engagements_demo_no_insert ON st_engagements;
CREATE POLICY st_engagements_demo_no_insert ON st_engagements
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (NOT st_is_demo_engagement(id) OR st_is_admin());

DROP POLICY IF EXISTS st_engagements_demo_no_update ON st_engagements;
CREATE POLICY st_engagements_demo_no_update ON st_engagements
  AS RESTRICTIVE FOR UPDATE
  USING (NOT st_is_demo_engagement(id) OR st_is_admin())
  WITH CHECK (NOT st_is_demo_engagement(id) OR st_is_admin());

DROP POLICY IF EXISTS st_engagements_demo_no_delete ON st_engagements;
CREATE POLICY st_engagements_demo_no_delete ON st_engagements
  AS RESTRICTIVE FOR DELETE
  USING (NOT st_is_demo_engagement(id) OR st_is_admin());


-- ─── Engagement-scoped tables (have an engagement_id column) ─────────────────
-- Same demo-read + demo-write-lock pattern, applied via the same table list
-- used by the base policy macro in 0001_init.sql, plus st_organisational_pillars
-- (0008). Permissive demo SELECT widens read; restrictive policies block writes
-- to demo rows for non-admins.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'st_engagement_stages',
    'st_engagement_roles',
    'st_engagement_profiles',
    'st_commitments',
    'st_commitment_change_log',
    'st_documents',
    'st_stakeholder_inputs',
    'st_workshop_decisions',
    'st_workshop_photos',
    'st_stage_insights',
    'st_engagement_deliverables',
    'st_initiative_updates',
    'st_surveys',
    'st_drift_reports',
    'st_reporting_templates',
    'st_compliance_reports',
    'st_ai_config',
    'st_organisational_pillars'
  ]) LOOP
    -- permissive: demo rows are readable by anyone (incl. anonymous)
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_demo_select', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (st_is_demo_engagement(engagement_id))',
      tbl || '_demo_select', tbl
    );

    -- restrictive: no INSERT into a demo engagement unless admin
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_demo_no_insert', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR INSERT '
      'WITH CHECK (NOT st_is_demo_engagement(engagement_id) OR st_is_admin())',
      tbl || '_demo_no_insert', tbl
    );

    -- restrictive: no UPDATE of a demo row, and no moving a row INTO a demo
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_demo_no_update', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR UPDATE '
      'USING (NOT st_is_demo_engagement(engagement_id) OR st_is_admin()) '
      'WITH CHECK (NOT st_is_demo_engagement(engagement_id) OR st_is_admin())',
      tbl || '_demo_no_update', tbl
    );

    -- restrictive: no DELETE of a demo row unless admin
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_demo_no_delete', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR DELETE '
      'USING (NOT st_is_demo_engagement(engagement_id) OR st_is_admin())',
      tbl || '_demo_no_delete', tbl
    );
  END LOOP;
END $$;


-- ─── Child tables (no engagement_id column — resolve via parent) ────────────
-- For each, the demo check resolves the owning engagement through the parent
-- row. Mirrors the parent-lookup pattern already used in 0001_init.sql.

-- st_stage_participants → engagement via st_engagement_stages(stage_id)
DROP POLICY IF EXISTS st_stage_participants_demo_select ON st_stage_participants;
CREATE POLICY st_stage_participants_demo_select ON st_stage_participants
  FOR SELECT USING (st_is_demo_engagement(
    (SELECT engagement_id FROM st_engagement_stages WHERE id = stage_id)));

DROP POLICY IF EXISTS st_stage_participants_demo_no_insert ON st_stage_participants;
CREATE POLICY st_stage_participants_demo_no_insert ON st_stage_participants
  AS RESTRICTIVE FOR INSERT WITH CHECK (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_engagement_stages WHERE id = stage_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_stage_participants_demo_no_update ON st_stage_participants;
CREATE POLICY st_stage_participants_demo_no_update ON st_stage_participants
  AS RESTRICTIVE FOR UPDATE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_engagement_stages WHERE id = stage_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_stage_participants_demo_no_delete ON st_stage_participants;
CREATE POLICY st_stage_participants_demo_no_delete ON st_stage_participants
  AS RESTRICTIVE FOR DELETE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_engagement_stages WHERE id = stage_id))
    OR st_is_admin());

-- st_scope_extensions → engagement via st_commitments(commitment_id)
DROP POLICY IF EXISTS st_scope_extensions_demo_select ON st_scope_extensions;
CREATE POLICY st_scope_extensions_demo_select ON st_scope_extensions
  FOR SELECT USING (st_is_demo_engagement(
    (SELECT engagement_id FROM st_commitments WHERE id = commitment_id)));

DROP POLICY IF EXISTS st_scope_extensions_demo_no_insert ON st_scope_extensions;
CREATE POLICY st_scope_extensions_demo_no_insert ON st_scope_extensions
  AS RESTRICTIVE FOR INSERT WITH CHECK (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_commitments WHERE id = commitment_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_scope_extensions_demo_no_update ON st_scope_extensions;
CREATE POLICY st_scope_extensions_demo_no_update ON st_scope_extensions
  AS RESTRICTIVE FOR UPDATE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_commitments WHERE id = commitment_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_scope_extensions_demo_no_delete ON st_scope_extensions;
CREATE POLICY st_scope_extensions_demo_no_delete ON st_scope_extensions
  AS RESTRICTIVE FOR DELETE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_commitments WHERE id = commitment_id))
    OR st_is_admin());

-- st_commitment_document_links → engagement via st_commitments(commitment_id)
DROP POLICY IF EXISTS st_commitment_document_links_demo_select ON st_commitment_document_links;
CREATE POLICY st_commitment_document_links_demo_select ON st_commitment_document_links
  FOR SELECT USING (st_is_demo_engagement(
    (SELECT engagement_id FROM st_commitments WHERE id = commitment_id)));

DROP POLICY IF EXISTS st_commitment_document_links_demo_no_insert ON st_commitment_document_links;
CREATE POLICY st_commitment_document_links_demo_no_insert ON st_commitment_document_links
  AS RESTRICTIVE FOR INSERT WITH CHECK (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_commitments WHERE id = commitment_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_commitment_document_links_demo_no_update ON st_commitment_document_links;
CREATE POLICY st_commitment_document_links_demo_no_update ON st_commitment_document_links
  AS RESTRICTIVE FOR UPDATE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_commitments WHERE id = commitment_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_commitment_document_links_demo_no_delete ON st_commitment_document_links;
CREATE POLICY st_commitment_document_links_demo_no_delete ON st_commitment_document_links
  AS RESTRICTIVE FOR DELETE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_commitments WHERE id = commitment_id))
    OR st_is_admin());

-- st_survey_responses → engagement via st_surveys(survey_id)
DROP POLICY IF EXISTS st_survey_responses_demo_select ON st_survey_responses;
CREATE POLICY st_survey_responses_demo_select ON st_survey_responses
  FOR SELECT USING (st_is_demo_engagement(
    (SELECT engagement_id FROM st_surveys WHERE id = survey_id)));

DROP POLICY IF EXISTS st_survey_responses_demo_no_insert ON st_survey_responses;
CREATE POLICY st_survey_responses_demo_no_insert ON st_survey_responses
  AS RESTRICTIVE FOR INSERT WITH CHECK (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_surveys WHERE id = survey_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_survey_responses_demo_no_update ON st_survey_responses;
CREATE POLICY st_survey_responses_demo_no_update ON st_survey_responses
  AS RESTRICTIVE FOR UPDATE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_surveys WHERE id = survey_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_survey_responses_demo_no_delete ON st_survey_responses;
CREATE POLICY st_survey_responses_demo_no_delete ON st_survey_responses
  AS RESTRICTIVE FOR DELETE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_surveys WHERE id = survey_id))
    OR st_is_admin());

-- st_survey_question_summaries → engagement via st_surveys(survey_id)
DROP POLICY IF EXISTS st_survey_question_summaries_demo_select ON st_survey_question_summaries;
CREATE POLICY st_survey_question_summaries_demo_select ON st_survey_question_summaries
  FOR SELECT USING (st_is_demo_engagement(
    (SELECT engagement_id FROM st_surveys WHERE id = survey_id)));

DROP POLICY IF EXISTS st_survey_question_summaries_demo_no_insert ON st_survey_question_summaries;
CREATE POLICY st_survey_question_summaries_demo_no_insert ON st_survey_question_summaries
  AS RESTRICTIVE FOR INSERT WITH CHECK (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_surveys WHERE id = survey_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_survey_question_summaries_demo_no_update ON st_survey_question_summaries;
CREATE POLICY st_survey_question_summaries_demo_no_update ON st_survey_question_summaries
  AS RESTRICTIVE FOR UPDATE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_surveys WHERE id = survey_id))
    OR st_is_admin());

DROP POLICY IF EXISTS st_survey_question_summaries_demo_no_delete ON st_survey_question_summaries;
CREATE POLICY st_survey_question_summaries_demo_no_delete ON st_survey_question_summaries
  AS RESTRICTIVE FOR DELETE USING (
    NOT st_is_demo_engagement((SELECT engagement_id FROM st_surveys WHERE id = survey_id))
    OR st_is_admin());

COMMIT;

-- =============================================================================
-- POST-MIGRATION CHECKLIST (one-time, in the Supabase dashboard)
--
--   1. Authentication → Providers → enable "Anonymous sign-ins".
--      Without this, supabase.auth.signInAnonymously() returns a 422 and the
--      shareable demo link cannot mint a session.
--
--   2. (Recommended) Authentication → Rate limits → keep the anonymous
--      sign-in rate limit at a sane number; each demo visit mints one user.
--      Anonymous users accumulate in auth.users — periodically prune ones with
--      is_anonymous = true and last_sign_in_at older than e.g. 30 days.
--
-- VERIFY (run in SQL editor as an anon/at-rest check):
--   -- demo rows are visible:
--   SELECT count(*) FROM st_commitments
--     WHERE engagement_id = 'a1b2c3d4-0001-4000-8000-000000000001';
--   -- a non-admin write to a demo row is rejected by the restrictive policy
--   -- (test from the client as an anonymous session, expect 0 rows / RLS error).
-- =============================================================================
