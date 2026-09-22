-- =============================================================================
-- Strategy Engine — complete, auditable engagement purge (CC-347 Slice 0b)
--
-- The enforcement half of "we process but do not retain": at the end of an
-- engagement every derived and uploaded artefact must be removable in one
-- call, on demand, with a receipt that proves what was removed. The previous
-- st-purge-engagement function (see supabase/functions/st-purge-engagement)
-- hand-listed a handful of tables and left the rest (nera_queries, the
-- Interview Engine tables, drift reports, stage insights, deliverables,
-- compliance reports, initiative updates, workshop decisions/photos, ...)
-- completely untouched.
--
-- st_purge_engagement() replaces the hand list with a generic sweep: every
-- table in the public schema that has a column literally named
-- `engagement_id` is a candidate, discovered from information_schema at
-- purge time — not hard-coded — so a table added by a later migration is
-- covered automatically without anyone remembering to update a purge
-- function. `st_sandbox_requests` is excluded on purpose: its columns are
-- named demo_engagement_id / provisioned_engagement_id (metadata ABOUT an
-- engagement, not content OF one), so the literal-name sweep already leaves
-- it alone without needing a table-name exclusion list.
--
-- st_documents / st_surveys keep their historical "keep the row, null the
-- content" behaviour for engagements that are still active and might purge
-- a subset — but a full engagement purge now DELETES those rows outright
-- (this function is engagement-scoped and is intended for end-of-engagement
-- use), because the audit trail lives in st_purge_receipts, not in a row
-- with its content stripped out sitting in the working tables forever.
--
-- st_engagements itself is NOT deleted by this function — deleting the
-- engagement row is a separate, obvious admin action (and FK ON DELETE
-- CASCADE already sweeps everything under it if that's what's wanted). This
-- function's job is "no content survives"; a client comparing before/after
-- expects to see the receipt against an engagement they can still find.
-- =============================================================================

BEGIN;

-- ─── Purge receipts: the audit trail, deliberately content-free ────────────
-- No chunk text, no summaries, no survey verbatims — only what was deleted,
-- how many rows, when, and by whom. Safe to show a client directly.

CREATE TABLE IF NOT EXISTS st_purge_receipts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL,        -- not FK'd: the engagement may itself
                                         -- be deleted later; the receipt must
                                         -- outlive it.
  engagement_name TEXT NOT NULL,        -- captured at purge time for the record
  client_name     TEXT,
  table_counts    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"table_name": rows_deleted}
  storage_counts  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"bucket_name": objects_deleted}
  total_rows_deleted INT NOT NULL DEFAULT 0,
  total_objects_deleted INT NOT NULL DEFAULT 0,
  purged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_by       UUID REFERENCES user_profiles(id),
  purged_by_email TEXT,                 -- denormalised so the receipt reads
                                         -- standalone even if the profile is
                                         -- later removed
  confirmation_text TEXT NOT NULL       -- the engagement name the admin typed
                                         -- to confirm, kept for the record
);

CREATE INDEX IF NOT EXISTS idx_st_purge_receipts_engagement
  ON st_purge_receipts (engagement_id);

ALTER TABLE st_purge_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS st_purge_receipts_select ON st_purge_receipts;
CREATE POLICY st_purge_receipts_select ON st_purge_receipts
  FOR SELECT USING (st_is_admin());

-- No INSERT/UPDATE/DELETE policy: only st_purge_engagement() (SECURITY
-- DEFINER, service-role invoked) writes receipts. Direct client writes are
-- refused by RLS with zero write policies.

COMMENT ON TABLE st_purge_receipts IS
  'Auditable record of every st_purge_engagement() run. Contains counts only, never client content — safe to show the client directly.';

-- ─── st_purge_engagement: the sweep ─────────────────────────────────────────
-- SECURITY DEFINER so it can delete across every st_* / ie_* table regardless
-- of the caller's RLS, same pattern as st_clone_engagement_for_user (0013).
-- Runs as one transaction: either the whole engagement's content goes, or
-- (on any error) none of it does — no partial purge left half-done.
--
-- p_confirmation_text must equal the engagement's current name exactly. This
-- mirrors the "type the engagement name to confirm" UI gate at the database
-- level too, so the function can't be called correctly by accident even via
-- direct RPC.

CREATE OR REPLACE FUNCTION st_purge_engagement(
  p_engagement_id UUID,
  p_confirmation_text TEXT,
  p_purged_by UUID DEFAULT NULL,
  p_purged_by_email TEXT DEFAULT NULL
) RETURNS st_purge_receipts
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_engagement RECORD;
  v_table      TEXT;
  v_column     TEXT;
  v_deleted    BIGINT;
  v_counts     JSONB := '{}'::jsonb;
  v_total      INT := 0;
  v_receipt    st_purge_receipts;
BEGIN
  SELECT id, name, client_name INTO v_engagement
  FROM st_engagements WHERE id = p_engagement_id;

  IF v_engagement.id IS NULL THEN
    RAISE EXCEPTION 'st_purge_engagement: no engagement %', p_engagement_id;
  END IF;

  IF p_confirmation_text IS NULL OR p_confirmation_text != v_engagement.name THEN
    RAISE EXCEPTION 'st_purge_engagement: confirmation text does not match the engagement name';
  END IF;

  -- Discover every base table in public that has a column literally named
  -- engagement_id. Excludes st_purge_receipts itself (its engagement_id is
  -- the audit key, not content to purge) and st_engagements (the shell stays).
  FOR v_table, v_column IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'engagement_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('st_purge_receipts', 'st_engagements')
  LOOP
    EXECUTE format(
      'DELETE FROM %I WHERE %I = $1',
      v_table, v_column
    ) USING p_engagement_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted > 0 THEN
      v_counts := v_counts || jsonb_build_object(v_table, v_deleted);
      v_total := v_total + v_deleted;
    END IF;
  END LOOP;

  INSERT INTO st_purge_receipts (
    engagement_id, engagement_name, client_name, table_counts,
    total_rows_deleted, purged_by, purged_by_email, confirmation_text
  ) VALUES (
    p_engagement_id, v_engagement.name, v_engagement.client_name, v_counts,
    v_total, p_purged_by, p_purged_by_email, p_confirmation_text
  ) RETURNING * INTO v_receipt;

  RETURN v_receipt;
END;
$$;

COMMENT ON FUNCTION st_purge_engagement(UUID, TEXT, UUID, TEXT) IS
  'Deletes every row in every public-schema table with an engagement_id column, for one engagement, discovered from information_schema (not hand-listed). Storage objects are removed by the calling edge function (st-purge-engagement) before/after this call and folded into the same receipt row via st_record_purge_storage(). Requires the caller to pass the engagement''s exact current name as p_confirmation_text.';

-- Supabase grants EXECUTE on every new public-schema function to anon,
-- authenticated and service_role through default privileges (pg_default_acl
-- for the postgres and supabase_admin roles), so REVOKE ... FROM PUBLIC on its
-- own leaves both API roles able to call this directly through PostgREST rpc
-- with nothing but the engagement's name as the gate. Verified on the live
-- project on 22 Sep 2026: st_clone_engagement_for_user (0013, same pattern)
-- was executable by anon and authenticated. Only the service role (the edge
-- functions, which do the internal_admin check) may call these.
REVOKE ALL ON FUNCTION st_purge_engagement(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION st_purge_engagement(UUID, TEXT, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION st_purge_engagement(UUID, TEXT, UUID, TEXT) TO service_role;

-- ─── st_record_purge_storage: attach storage-object counts to a receipt ────
-- Storage removal happens in the edge function (it has access to the storage
-- API; plpgsql does not), so the count is folded in after the fact via a
-- small update rather than computed inside st_purge_engagement.

CREATE OR REPLACE FUNCTION st_record_purge_storage(
  p_receipt_id UUID,
  p_storage_counts JSONB,
  p_total_objects INT
) RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  UPDATE st_purge_receipts
  SET storage_counts = p_storage_counts,
      total_objects_deleted = p_total_objects
  WHERE id = p_receipt_id;
$$;

REVOKE ALL ON FUNCTION st_record_purge_storage(UUID, JSONB, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION st_record_purge_storage(UUID, JSONB, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION st_record_purge_storage(UUID, JSONB, INT) TO service_role;

-- Same hole, same fix, for the 0013 clone function: its only caller is the
-- st-provision-sandbox edge function (service role), and on the live project
-- anon could call it directly.
REVOKE EXECUTE ON FUNCTION st_clone_engagement_for_user(UUID, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION st_clone_engagement_for_user(UUID, UUID, TEXT) TO service_role;

-- ─── Sweep order ────────────────────────────────────────────────────────────
-- The sweep deletes tables in information_schema order, which is not
-- guaranteed. st_scope_extensions has no engagement_id (it is reached from
-- st_commitments by CASCADE) but references st_commitment_change_log through
-- a NO ACTION foreign key, so if the change log is swept before the
-- commitments the whole purge fails with a foreign-key error and rolls back.
-- Verified on the live project on 22 Sep 2026 (constraint
-- st_scope_extensions_change_log_id_fkey, ON DELETE NO ACTION). SET NULL
-- matches the other change-log reference (st_commitments.justification_log_id)
-- and makes the sweep order-independent.
ALTER TABLE st_scope_extensions
  DROP CONSTRAINT IF EXISTS st_scope_extensions_change_log_id_fkey;
ALTER TABLE st_scope_extensions
  ADD CONSTRAINT st_scope_extensions_change_log_id_fkey
  FOREIGN KEY (change_log_id) REFERENCES st_commitment_change_log(id)
  ON DELETE SET NULL;

COMMIT;
