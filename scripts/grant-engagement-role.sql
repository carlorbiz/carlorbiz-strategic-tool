-- =============================================================================
-- Strategy Engine — give a signed-up user a role on an engagement
-- scripts/grant-engagement-role.sql
--
-- Run in the Supabase dashboard SQL editor AFTER the person has signed in
-- once (magic link from /login, or Authentication → Users → Invite). Set the
-- three values at the top. Safe to re-run.
--
-- Roles are the role_key values in st_engagement_roles for that engagement
-- ('client_admin' is created by CLIENT_RUNBOOK.md step 8; add others such as
-- 'board_member' or 'operational_lead' the same way). An internal_admin does
-- not need a role row: st_is_admin() already grants everything.
--
-- The profile is keyed id = user_id = auth uid for the reason explained in
-- scripts/bootstrap-admin.sql; a self-created profile with a random id is
-- re-keyed when nothing references it yet.
-- =============================================================================

DO $$
DECLARE
  v_email      TEXT := 'person@example.com';                        -- <<< sign-in email
  v_engagement UUID := '00000000-0000-0000-0000-000000000000';      -- <<< st_engagements.id
  v_role_key   TEXT := 'client_admin';                              -- <<< st_engagement_roles.role_key
  v_uid        UUID;
  v_existing   UUID;
  v_role_id    UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth user with email %. Invite them first, then re-run.', v_email;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM st_engagements WHERE id = v_engagement) THEN
    RAISE EXCEPTION 'No engagement with id %', v_engagement;
  END IF;

  SELECT id INTO v_role_id
  FROM st_engagement_roles WHERE engagement_id = v_engagement AND role_key = v_role_key;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Engagement % has no role_key %. Insert it into st_engagement_roles first.', v_engagement, v_role_key;
  END IF;

  -- Profile keyed to the auth uid.
  SELECT id INTO v_existing FROM user_profiles WHERE user_id = v_uid;
  IF v_existing IS NULL THEN
    INSERT INTO user_profiles (id, user_id, email) VALUES (v_uid, v_uid, v_email);
  ELSIF v_existing <> v_uid THEN
    IF NOT EXISTS (SELECT 1 FROM st_user_engagement_roles WHERE user_id = v_existing)
       AND NOT EXISTS (SELECT 1 FROM st_engagements WHERE created_by = v_existing OR handed_over_to = v_existing)
       AND NOT EXISTS (SELECT 1 FROM ie_conversations WHERE user_id = v_existing)
    THEN
      DELETE FROM user_profiles WHERE id = v_existing;
      INSERT INTO user_profiles (id, user_id, email) VALUES (v_uid, v_uid, v_email);
      RAISE NOTICE 'Re-keyed profile % -> %', v_existing, v_uid;
    ELSE
      RAISE EXCEPTION 'Profile % for % is referenced by engine rows and is not keyed to the auth uid %; resolve by hand.', v_existing, v_email, v_uid;
    END IF;
  END IF;

  INSERT INTO st_user_engagement_roles (user_id, engagement_id, role_id)
  VALUES (v_uid, v_engagement, v_role_id)
  ON CONFLICT (user_id, engagement_id, role_id) DO UPDATE SET revoked_at = NULL;

  RAISE NOTICE 'Granted % on engagement % to % (%)', v_role_key, v_engagement, v_email, v_uid;
END $$;

-- Verify:
-- SELECT up.email, er.role_key, uer.granted_at, uer.revoked_at
-- FROM st_user_engagement_roles uer
-- JOIN user_profiles up ON up.id = uer.user_id
-- JOIN st_engagement_roles er ON er.id = uer.role_id
-- WHERE uer.engagement_id = '<engagement id>';
