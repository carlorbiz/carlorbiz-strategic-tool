-- =============================================================================
-- 0017_tools_in_play.sql — CC-231: Strategy Engine × Intelligence Engine bolt-on
--
-- Per engagement, the set of vendor tools "in play" (tool_slugs from the Nera
-- Intelligence Engine catalogue, GET /api/catalogue/vendors). The Strategy Engine
-- stores ONLY the slugs. Everything the engine knows about those tools is read
-- live at request time (Tool Intelligence panel; report grounding) and never
-- copied into an st_* table — sovereignty by construction. The engine never
-- learns which engagement asked.
--
-- Also re-declares st_clone_engagement_for_user so a cloned demo/template
-- carries its tools_in_play (the cloneable 'AI Integration Advisory' template).
-- =============================================================================

BEGIN;

ALTER TABLE st_engagements
  ADD COLUMN IF NOT EXISTS tools_in_play TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_st_engagements_tools_in_play
  ON st_engagements USING GIN (tools_in_play);

COMMENT ON COLUMN st_engagements.tools_in_play IS
  'CC-231: Intelligence Engine tool_slugs in play for this engagement (names only; the engine is read live, never copied).';

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
    branding_overrides, created_by, is_sandbox, sandbox_owner, cloned_from,
    tools_in_play
  )
  SELECT
    v_new,
    name || COALESCE(' — ' || p_label, ' — Sandbox'),
    client_name, description, 'living', type, profile_key,
    taxonomy_strictness, top_count_warning, top_count_hard_cap, pulse_cadence_days,
    branding_overrides, p_owner, true, p_owner, p_source,
    tools_in_play
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


COMMIT;
