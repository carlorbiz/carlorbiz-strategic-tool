-- =============================================================================
-- Carlorbiz Strategic Tool — Tier-2 prospect sandboxes + extended-access requests
-- migrations/strategic-tool/0013_demo_sandbox_and_requests.sql
--
-- Builds on 0012 (anonymous read-only demo). Adds the "serious prospect" tier:
--   * A prospect requests extended access from the demo (st_sandbox_requests).
--   * An internal_admin approves; the st-provision-sandbox edge function creates
--     them a real account and calls st_clone_engagement_for_user(), which copies
--     a demo into a NEW private engagement the prospect owns.
--   * Because the clone is an ordinary (non-demo) engagement with the prospect
--     granted a role, the EXISTING role-based RLS isolates it automatically:
--     only they can see or edit it, it persists across logins, and it can never
--     touch the master demo (which stays write-locked by 0012).
--
-- Nera turn caps (5 for anonymous demo, 20 for a sandbox) are enforced in the
-- st-nera-query edge function, keyed off the is_sandbox flag added here.
-- =============================================================================

BEGIN;

-- ─── Sandbox marker columns on st_engagements ───────────────────────────────
ALTER TABLE st_engagements
  ADD COLUMN IF NOT EXISTS is_sandbox    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sandbox_owner UUID,                         -- auth uid of the prospect
  ADD COLUMN IF NOT EXISTS cloned_from   UUID REFERENCES st_engagements(id);

CREATE INDEX IF NOT EXISTS idx_st_engagements_sandbox_owner
  ON st_engagements (sandbox_owner) WHERE is_sandbox;

COMMENT ON COLUMN st_engagements.is_sandbox IS
  'TRUE for a per-prospect demo clone (Tier 2). Drives the 20-turn Nera cap in st-nera-query. Ordinary role-based RLS handles isolation — no special policy needed.';


-- ─── st_sandbox_requests: prospect asks, admin approves ─────────────────────
CREATE TABLE IF NOT EXISTS st_sandbox_requests (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                     TEXT NOT NULL,
  full_name                 TEXT,
  organisation              TEXT,
  message                   TEXT,
  demo_engagement_id        UUID,    -- which demo they were looking at / want a copy of
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  provisioned_engagement_id UUID REFERENCES st_engagements(id) ON DELETE SET NULL,
  note                      TEXT,    -- admin note / last result message
  requested_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at                TIMESTAMPTZ,
  handled_by                UUID
);

CREATE INDEX IF NOT EXISTS idx_st_sandbox_requests_status
  ON st_sandbox_requests (status, requested_at DESC);

ALTER TABLE st_sandbox_requests ENABLE ROW LEVEL SECURITY;

-- Anyone — including an anonymous demo visitor — may submit a request. They
-- cannot read it back (no SELECT for them), so this is write-only intake.
DROP POLICY IF EXISTS st_sandbox_requests_insert ON st_sandbox_requests;
CREATE POLICY st_sandbox_requests_insert ON st_sandbox_requests
  FOR INSERT WITH CHECK (true);

-- Only internal admins can read / triage / delete requests.
DROP POLICY IF EXISTS st_sandbox_requests_select ON st_sandbox_requests;
CREATE POLICY st_sandbox_requests_select ON st_sandbox_requests
  FOR SELECT USING (st_is_admin());

DROP POLICY IF EXISTS st_sandbox_requests_update ON st_sandbox_requests;
CREATE POLICY st_sandbox_requests_update ON st_sandbox_requests
  FOR UPDATE USING (st_is_admin());

DROP POLICY IF EXISTS st_sandbox_requests_delete ON st_sandbox_requests;
CREATE POLICY st_sandbox_requests_delete ON st_sandbox_requests
  FOR DELETE USING (st_is_admin());


-- ─── st_clone_engagement_for_user: copy a demo into a private sandbox ────────
-- SECURITY DEFINER so it can write across all the st_* tables regardless of the
-- caller's RLS. Guarded to ONLY clone demo engagements, so it can never be used
-- to exfiltrate or duplicate a real client engagement.
--
-- CONTRACT: p_owner must already exist as user_profiles.id (the provisioning
-- edge function creates the prospect's profile with id = user_id = auth uid so
-- that st_user_engagement_roles.user_id = auth.uid() — which is what both the
-- RLS helper (st_user_has_engagement_access) and st-nera-query compare against).
CREATE OR REPLACE FUNCTION st_clone_engagement_for_user(
  p_source UUID,
  p_owner  UUID,
  p_label  TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_new  UUID := uuid_generate_v4();
  v_role UUID;
BEGIN
  IF NOT st_is_demo_engagement(p_source) THEN
    RAISE EXCEPTION 'st_clone_engagement_for_user: source % is not a demo engagement', p_source;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_owner) THEN
    RAISE EXCEPTION 'st_clone_engagement_for_user: owner profile % does not exist', p_owner;
  END IF;

  -- 1. Engagement shell (new id; short_code auto-generates via its DEFAULT;
  --    slug left NULL; status 'living'; flagged as a sandbox owned by p_owner).
  INSERT INTO st_engagements (
    id, name, client_name, description, status, type, profile_key,
    taxonomy_strictness, top_count_warning, top_count_hard_cap, pulse_cadence_days,
    branding_overrides, created_by, is_sandbox, sandbox_owner, cloned_from
  )
  SELECT
    v_new,
    name || COALESCE(' — ' || p_label, ' — Sandbox'),
    client_name, description, 'living', type, profile_key,
    taxonomy_strictness, top_count_warning, top_count_hard_cap, pulse_cadence_days,
    branding_overrides, p_owner, true, p_owner, p_source
  FROM st_engagements WHERE id = p_source;

  -- 2. Commitments — remap ids so the parent/child hierarchy is preserved.
  --    MATERIALIZED forces the CTE to evaluate once, so each old id maps to a
  --    single stable new id used by both the self row and its children.
  WITH map AS MATERIALIZED (
    SELECT id AS old_id, uuid_generate_v4() AS new_id
    FROM st_commitments
    WHERE engagement_id = p_source AND status = 'active'
  )
  INSERT INTO st_commitments (
    id, engagement_id, parent_id, kind, title, description,
    success_signal, status, order_index, created_at
  )
  SELECT
    m.new_id, v_new, pm.new_id, c.kind, c.title, c.description,
    c.success_signal, c.status, c.order_index, now()
  FROM st_commitments c
  JOIN map m       ON m.old_id = c.id
  LEFT JOIN map pm ON pm.old_id = c.parent_id
  WHERE c.engagement_id = p_source AND c.status = 'active';

  -- 3. Organisational pillars
  INSERT INTO st_organisational_pillars (
    engagement_id, title, description, success_signal,
    distinctiveness_claim, sovereignty_claim, pillar_level, order_index, status
  )
  SELECT
    v_new, title, description, success_signal,
    distinctiveness_claim, sovereignty_claim, pillar_level, order_index, status
  FROM st_organisational_pillars
  WHERE engagement_id = p_source AND status = 'active';

  -- 4. Stages
  INSERT INTO st_engagement_stages (
    engagement_id, title, description, stage_type, status, order_index,
    nera_system_prompt, question_set, is_recurring, recurrence_pattern,
    opens_at, closes_at
  )
  SELECT
    v_new, title, description, stage_type, status, order_index,
    nera_system_prompt, question_set, is_recurring, recurrence_pattern,
    opens_at, closes_at
  FROM st_engagement_stages
  WHERE engagement_id = p_source;

  -- 5. Reporting templates (engagement-scoped ones only)
  INSERT INTO st_reporting_templates (
    engagement_id, name, description, template_markdown, funder_type
  )
  SELECT v_new, name, description, template_markdown, funder_type
  FROM st_reporting_templates
  WHERE engagement_id = p_source;

  -- 6. AI config (vocabulary, prompts, LLM choice) — copy the engagement's row
  INSERT INTO st_ai_config (
    engagement_id, profile_key, llm_provider, llm_model, vocabulary_map,
    system_prompt_interview, system_prompt_workshop, system_prompt_pulse,
    system_prompt_drift_watch, system_prompt_brief, system_prompt_report,
    system_prompt_update, drift_watch_config, dashboard_layout
  )
  SELECT
    v_new, profile_key, llm_provider, llm_model, vocabulary_map,
    system_prompt_interview, system_prompt_workshop, system_prompt_pulse,
    system_prompt_drift_watch, system_prompt_brief, system_prompt_report,
    system_prompt_update, drift_watch_config, dashboard_layout
  FROM st_ai_config
  WHERE engagement_id = p_source;

  -- 7. Grant the prospect a client_admin role on their sandbox so the standard
  --    role-based RLS (presence of a non-revoked row) lets them read AND edit.
  INSERT INTO st_engagement_roles (engagement_id, role_key, label, permissions)
  VALUES (v_new, 'client_admin', 'Sandbox Owner', '{"admin": true}'::jsonb)
  RETURNING id INTO v_role;

  INSERT INTO st_user_engagement_roles (user_id, engagement_id, role_id)
  VALUES (p_owner, v_new, v_role);

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION st_clone_engagement_for_user(UUID, UUID, TEXT) IS
  'Clone a demo engagement (guarded by st_is_demo_engagement) into a private sandbox owned by p_owner, granting them a client_admin role. Returns the new engagement id. Called by the st-provision-sandbox edge function on admin approval.';

-- Lock the function down: callable by the service role (edge function) and
-- internal use only. Not exposed to anon/authenticated directly.
REVOKE ALL ON FUNCTION st_clone_engagement_for_user(UUID, UUID, TEXT) FROM PUBLIC;

COMMIT;
