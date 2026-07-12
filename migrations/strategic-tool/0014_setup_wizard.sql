-- =============================================================================
-- Carlorbiz Strategic Tool — Engagement Setup Wizard (CC-94, increment 1)
-- migrations/strategic-tool/0014_setup_wizard.sql
--
-- Additive only. Two changes:
--   1. st_engagements.sector — free-text sector captured on the wizard's
--      Details step (e.g. 'community health', 'aged care', 'local government').
--   2. st_engagement_setup — one row per engagement tracking wizard progress:
--      which step the admin is up to, Nera's proposed pillars (increment 2),
--      and the getting-started questionnaire answers (increment 3).
--
-- RLS mirrors the standard engagement-scoped pattern from 0001/0008:
-- SELECT/INSERT/UPDATE via st_user_has_engagement_access(engagement_id)
-- (which already includes the internal_admin override), DELETE admin-only.
--
-- Rows are created by the st-setup-engagement edge function (service role);
-- the wizard UI updates current_step directly under RLS as the admin moves
-- between steps.
-- =============================================================================

BEGIN;

-- ─── Sector on the engagement itself ─────────────────────────────────────────

ALTER TABLE st_engagements
  ADD COLUMN IF NOT EXISTS sector TEXT;

COMMENT ON COLUMN st_engagements.sector IS
  'Free-text sector captured in the Engagement Setup Wizard (Details step). Used to ground Nera''s pillar proposals and questionnaire follow-ups.';


-- ─── st_engagement_setup: wizard progress, one row per engagement ────────────

CREATE TABLE IF NOT EXISTS st_engagement_setup (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id         UUID NOT NULL UNIQUE REFERENCES st_engagements(id) ON DELETE CASCADE,
  current_step          INT NOT NULL DEFAULT 1,
  pillar_proposals      JSONB,          -- Nera-proposed pillars awaiting review (increment 2)
  questionnaire_answers JSONB,          -- answers to the getting-started questions (increment 3)
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE st_engagement_setup ENABLE ROW LEVEL SECURITY;

CREATE POLICY st_engagement_setup_select ON st_engagement_setup
  FOR SELECT USING (st_user_has_engagement_access(engagement_id));
CREATE POLICY st_engagement_setup_insert ON st_engagement_setup
  FOR INSERT WITH CHECK (st_user_has_engagement_access(engagement_id));
CREATE POLICY st_engagement_setup_update ON st_engagement_setup
  FOR UPDATE USING (st_user_has_engagement_access(engagement_id));
CREATE POLICY st_engagement_setup_delete ON st_engagement_setup
  FOR DELETE USING (st_is_admin());

-- Keep updated_at honest, same trigger function as the 0001 tables.
CREATE TRIGGER trg_st_engagement_setup_updated_at
  BEFORE UPDATE ON st_engagement_setup
  FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

COMMENT ON TABLE st_engagement_setup IS
  'Engagement Setup Wizard progress (CC-94). One row per engagement, created by the st-setup-engagement edge function. current_step 1-5: Details, Documents, Pillars, Questionnaire, Invite. completed_at set when the wizard finishes.';

COMMIT;
