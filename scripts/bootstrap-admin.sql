-- =============================================================================
-- Strategy Engine — make one signed-up user the first internal_admin
-- scripts/bootstrap-admin.sql
--
-- Run ONCE per project, in the Supabase dashboard SQL editor (it runs as
-- postgres and bypasses RLS) AFTER the person has signed up through the app
-- (or been invited from Authentication → Users). Replace the email below.
--
-- What it does:
--   * finds the auth.users row for that email;
--   * upserts user_profiles with id = user_id = that auth uid and
--     role = 'internal_admin'.
--
-- Why id = user_id: st_user_engagement_roles.user_id and every st_* created_by
-- column FK user_profiles(id), while the RLS helpers compare them to
-- auth.uid(). Only a profile whose id equals the auth uid satisfies both. If
-- the app already self-created a profile with a random id on first sign-in,
-- this script replaces it with a correctly keyed one (the old row is deleted
-- only when nothing references it; otherwise it is left and just re-roled).
-- =============================================================================

DO $$
DECLARE
  v_email TEXT := 'admin@example.com';   -- <<< replace with the admin's sign-in email
  v_uid   UUID;
  v_existing_id UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth user with email %. Sign up / invite first, then re-run.', v_email;
  END IF;

  SELECT id INTO v_existing_id FROM user_profiles WHERE user_id = v_uid;

  IF v_existing_id IS NULL THEN
    INSERT INTO user_profiles (id, user_id, email, role)
    VALUES (v_uid, v_uid, v_email, 'internal_admin');
    RAISE NOTICE 'Created internal_admin profile % for %', v_uid, v_email;

  ELSIF v_existing_id = v_uid THEN
    UPDATE user_profiles SET role = 'internal_admin', email = COALESCE(email, v_email)
    WHERE id = v_uid;
    RAISE NOTICE 'Profile % already keyed correctly; role set to internal_admin', v_uid;

  ELSE
    -- Self-created profile with a random id. Re-key it if nothing points at it.
    IF NOT EXISTS (SELECT 1 FROM st_user_engagement_roles WHERE user_id = v_existing_id)
       AND NOT EXISTS (SELECT 1 FROM st_engagements WHERE created_by = v_existing_id OR handed_over_to = v_existing_id)
       AND NOT EXISTS (SELECT 1 FROM ie_conversations WHERE user_id = v_existing_id)
    THEN
      DELETE FROM user_profiles WHERE id = v_existing_id;
      INSERT INTO user_profiles (id, user_id, email, role)
      VALUES (v_uid, v_uid, v_email, 'internal_admin');
      RAISE NOTICE 'Re-keyed profile % -> % and set internal_admin', v_existing_id, v_uid;
    ELSE
      UPDATE user_profiles SET role = 'internal_admin' WHERE id = v_existing_id;
      RAISE WARNING 'Profile % is referenced by engine rows and could not be re-keyed to %; role set to internal_admin but engagement roles will need id = auth uid. See CLIENT_RUNBOOK.md.', v_existing_id, v_uid;
    END IF;
  END IF;
END $$;

-- Verify:
-- SELECT id, user_id, email, role FROM user_profiles WHERE role = 'internal_admin';
