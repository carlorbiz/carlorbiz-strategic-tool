-- =============================================================================
-- Carlorbiz Strategic Tool — Fix interview-engine RLS user_id indirection
-- migrations/strategic-tool/0007_fix_ie_rls_user_id_indirection.sql
--
-- The five ie_* tables all have user_id columns with FKs to user_profiles(id).
-- But the original RLS policies check `auth.uid() = user_id`, which can never
-- be true: auth.uid() returns the auth.users.id, and user_id is the SEPARATE
-- user_profiles.id (uuid_generate_v4() default). The link between the two is
-- user_profiles.user_id — not its id column.
--
-- Effect of the bug: every INSERT/SELECT on ie_conversations and friends has
-- silently failed for every user since the schema was created. ie_conversations
-- currently has zero rows. The Start update button on the dashboard is the
-- visible symptom — but no interview-engine feature has ever worked end-to-end.
--
-- Fix: introduce a SECURITY DEFINER helper that returns the current user's
-- user_profiles.id, and rewrite the five ie_* RLS policy families to compare
-- against that helper.
-- =============================================================================

BEGIN;

-- ─── Helper: current_user_profile_id() ──────────────────────────────────────
-- SECURITY DEFINER bypasses RLS on user_profiles for the lookup itself. Caches
-- per row evaluation via STABLE marker.

CREATE OR REPLACE FUNCTION current_user_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION current_user_profile_id() TO anon, authenticated;

-- ─── Rewrite RLS on the five ie_* tables ────────────────────────────────────
-- For each table: SELECT/INSERT/UPDATE/DELETE policies that gate on the
-- current user's user_profiles.id rather than the broken auth.uid() compare.

-- ie_conversations
DROP POLICY IF EXISTS ie_conversations_select ON ie_conversations;
DROP POLICY IF EXISTS ie_conversations_insert ON ie_conversations;
DROP POLICY IF EXISTS ie_conversations_update ON ie_conversations;

CREATE POLICY ie_conversations_select ON ie_conversations
  FOR SELECT USING (user_id = current_user_profile_id());
CREATE POLICY ie_conversations_insert ON ie_conversations
  FOR INSERT WITH CHECK (user_id = current_user_profile_id());
CREATE POLICY ie_conversations_update ON ie_conversations
  FOR UPDATE USING (user_id = current_user_profile_id());

-- ie_user_state
DROP POLICY IF EXISTS ie_user_state_select ON ie_user_state;
DROP POLICY IF EXISTS ie_user_state_insert ON ie_user_state;
DROP POLICY IF EXISTS ie_user_state_update ON ie_user_state;

CREATE POLICY ie_user_state_select ON ie_user_state
  FOR SELECT USING (user_id = current_user_profile_id());
CREATE POLICY ie_user_state_insert ON ie_user_state
  FOR INSERT WITH CHECK (user_id = current_user_profile_id());
CREATE POLICY ie_user_state_update ON ie_user_state
  FOR UPDATE USING (user_id = current_user_profile_id());

-- ie_prompt_coverage
DROP POLICY IF EXISTS ie_prompt_coverage_select ON ie_prompt_coverage;
DROP POLICY IF EXISTS ie_prompt_coverage_insert ON ie_prompt_coverage;
DROP POLICY IF EXISTS ie_prompt_coverage_update ON ie_prompt_coverage;

CREATE POLICY ie_prompt_coverage_select ON ie_prompt_coverage
  FOR SELECT USING (user_id = current_user_profile_id());
CREATE POLICY ie_prompt_coverage_insert ON ie_prompt_coverage
  FOR INSERT WITH CHECK (user_id = current_user_profile_id());
CREATE POLICY ie_prompt_coverage_update ON ie_prompt_coverage
  FOR UPDATE USING (user_id = current_user_profile_id());

-- ie_entity_memory
DROP POLICY IF EXISTS ie_entity_memory_select ON ie_entity_memory;
DROP POLICY IF EXISTS ie_entity_memory_insert ON ie_entity_memory;
DROP POLICY IF EXISTS ie_entity_memory_update ON ie_entity_memory;

CREATE POLICY ie_entity_memory_select ON ie_entity_memory
  FOR SELECT USING (user_id = current_user_profile_id());
CREATE POLICY ie_entity_memory_insert ON ie_entity_memory
  FOR INSERT WITH CHECK (user_id = current_user_profile_id());
CREATE POLICY ie_entity_memory_update ON ie_entity_memory
  FOR UPDATE USING (user_id = current_user_profile_id());

-- ie_messages — has no direct user_id column; access flows through the parent
-- conversation. Rewrite to follow the conversation's owner.

DROP POLICY IF EXISTS ie_messages_select ON ie_messages;
DROP POLICY IF EXISTS ie_messages_insert ON ie_messages;

CREATE POLICY ie_messages_select ON ie_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM ie_conversations WHERE user_id = current_user_profile_id()
    )
  );

CREATE POLICY ie_messages_insert ON ie_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM ie_conversations WHERE user_id = current_user_profile_id()
    )
  );

COMMIT;
