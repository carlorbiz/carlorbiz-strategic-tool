-- =============================================================================
-- Strategy Engine — client deployment guard
-- supabase/migrations/20260918000022_client_deployment_guard.sql
--
-- Migrations 0012, 0013 and 0018 (and the campaign-token table) install the
-- Carlorbiz marketing tiers: four hard-coded public demo engagement UUIDs with
-- anonymous read policies, a prospect sandbox intake that anyone may write to,
-- and the demo-clone function. A client-owned project must carry the same
-- schema (so the code paths exist and the migration history is one bundle) but
-- must never treat any row as a public demo or accept anonymous intake.
--
-- This migration does not rewrite 0012/0013/0018. It adds ONE setting,
-- st_deployment_settings.demo_tiers_enabled (default false), and re-points the
-- two places those migrations key off:
--
--   * st_is_demo_engagement(uuid)  — the single source of truth every demo RLS
--     policy calls. Same four UUIDs as 0018, now AND-ed with the setting. With
--     the setting false every *_demo_select policy evaluates false and every
--     *_demo_no_* restrictive policy evaluates true, i.e. they become no-ops
--     and the ordinary role-based policies from 0001 are all that applies.
--     st_clone_engagement_for_user() refuses every source for the same reason.
--   * st_sandbox_requests_insert    — the anonymous intake policy from 0013,
--     now gated on the same setting.
--
-- st_campaign_access_tokens (0021) has no policies at all (service-role only)
-- and holds nothing until st-provision-campaign-user is invoked, so it needs no
-- gate; the deploy script simply does not ship the provisioning functions
-- unless asked (deploy/README.md).
--
-- Carla's own project re-enables the tiers with:
--   UPDATE st_deployment_settings SET demo_tiers_enabled = true;
-- and then applies supabase/seed/demo/*.sql. A client project never runs
-- either. Nothing here is destructive; setting the flag back restores 0018.
-- =============================================================================

BEGIN;

-- ─── Deployment settings (single row) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_deployment_settings (
  id                 BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),  -- exactly one row
  demo_tiers_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO st_deployment_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE st_deployment_settings IS
  'One row of deployment-wide switches. demo_tiers_enabled=false (the default) neutralises the public demo / sandbox / campaign tiers from migrations 0012, 0013 and 0018 so a client-owned project never exposes Carlorbiz demo data.';

ALTER TABLE st_deployment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS st_deployment_settings_select ON st_deployment_settings;
CREATE POLICY st_deployment_settings_select ON st_deployment_settings
  FOR SELECT USING (st_is_admin());

DROP POLICY IF EXISTS st_deployment_settings_update ON st_deployment_settings;
CREATE POLICY st_deployment_settings_update ON st_deployment_settings
  FOR UPDATE USING (st_is_admin()) WITH CHECK (st_is_admin());

DROP TRIGGER IF EXISTS trg_st_deployment_settings_updated_at ON st_deployment_settings;
CREATE TRIGGER trg_st_deployment_settings_updated_at
  BEFORE UPDATE ON st_deployment_settings
  FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();


-- ─── Setting reader (SECURITY DEFINER so RLS policies can call it as anyone) ─
CREATE OR REPLACE FUNCTION st_demo_tiers_enabled()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT demo_tiers_enabled FROM st_deployment_settings WHERE id), false);
$$;

REVOKE ALL ON FUNCTION st_demo_tiers_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION st_demo_tiers_enabled() TO anon, authenticated, service_role;


-- ─── Re-point the demo source of truth (same UUIDs as 0018, gated) ───────────
-- Volatility drops from IMMUTABLE to STABLE because the result now depends on
-- a table row. No index or generated column uses this function.
CREATE OR REPLACE FUNCTION st_is_demo_engagement(eng_id UUID)
RETURNS BOOLEAN AS $$
  SELECT st_demo_tiers_enabled() AND eng_id IN (
    'a1b2c3d4-0001-4000-8000-000000000001',  -- Acme Catering Group
    'a1b2c3d4-0002-4000-8000-000000000001',  -- National Allied Health Peak Council
    'a1b2c3d4-0003-4000-8000-000000000001',  -- Rural Futures Australia
    'a1b2c3d4-0004-4000-8000-000000000001'   -- Kestrel Mutual (AI strategy, CC-231)
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION st_is_demo_engagement(UUID) IS
  'TRUE only when st_deployment_settings.demo_tiers_enabled is true AND the engagement is one of the four Carlorbiz public demos (0012/0018). False for every row in a client-owned project.';


-- ─── Gate the anonymous sandbox-request intake from 0013 ─────────────────────
DROP POLICY IF EXISTS st_sandbox_requests_insert ON st_sandbox_requests;
CREATE POLICY st_sandbox_requests_insert ON st_sandbox_requests
  FOR INSERT WITH CHECK (st_demo_tiers_enabled());

COMMIT;
