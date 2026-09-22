-- =============================================================================
-- Strategy Engine — prove a purge left zero rows behind
-- scripts/check-purge-complete.sql
--
-- Run in the Supabase dashboard SQL editor after calling st-purge-engagement
-- (or st_purge_engagement() directly) for an engagement. Set v_engagement
-- below and Run.
--
-- Enumerates every table in the public schema from information_schema — the
-- same discovery st_purge_engagement() itself uses — rather than a hand list,
-- so a table added by a later migration is checked automatically instead of
-- silently skipped. Checks BOTH:
--   (a) every table with a column literally named engagement_id (what the
--       purge function sweeps), and
--   (b) every table whose name starts with st_ (the task's "every st_*
--       table" requirement) even if its FK to the engagement is indirect
--       (e.g. via a document_id/survey_id/conversation_id) — those rows
--       should already be gone by CASCADE or by the sweep, and this half of
--       the check exists to catch it if one ever isn't.
--
-- Prints one row per table with a non-zero count (a FAIL) and one summary
-- line. Zero output rows plus "PASS" means the purge is complete.
-- =============================================================================

DO $$
DECLARE
  v_engagement UUID := '00000000-0000-0000-0000-000000000000';  -- <<< set this
  v_table      TEXT;
  v_column     TEXT;
  v_count      BIGINT;
  v_failures   INT := 0;
  v_checked    INT := 0;
BEGIN
  IF v_engagement = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Set v_engagement to the purged engagement''s id before running this check.';
  END IF;

  RAISE NOTICE '--- Checking every table with an engagement_id column ---';
  FOR v_table, v_column IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'engagement_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('st_purge_receipts')  -- the receipt is SUPPOSED to reference it
  LOOP
    v_checked := v_checked + 1;
    EXECUTE format('SELECT count(*) FROM %I WHERE %I = $1', v_table, v_column)
      INTO v_count USING v_engagement;
    IF v_count > 0 THEN
      v_failures := v_failures + 1;
      RAISE WARNING 'FAIL: % rows remain in %.% for engagement %', v_count, v_table, v_column, v_engagement;
    END IF;
  END LOOP;

  RAISE NOTICE '--- Checking every st_* table for any other column that could hold this engagement id ---';
  -- Belt-and-braces: any st_* table with a UUID column (any name) still
  -- holding this engagement id anywhere is worth knowing about, even if it's
  -- not literally named engagement_id (a future migration could add a
  -- differently-named FK). This does not assume the FK path — it just looks
  -- for the value. st_engagements.id is excluded deliberately: the engagement
  -- shell row itself is kept by design (see the migration's header comment)
  -- so the receipt has something to point at — that is not a purge failure.
  FOR v_table, v_column IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.data_type = 'uuid'
      AND t.table_type = 'BASE TABLE'
      AND t.table_name LIKE 'st\_%'
      AND t.table_name NOT IN ('st_purge_receipts')
      AND NOT (t.table_name = 'st_engagements' AND c.column_name = 'id')
  LOOP
    v_checked := v_checked + 1;
    EXECUTE format('SELECT count(*) FROM %I WHERE %I = $1', v_table, v_column)
      INTO v_count USING v_engagement;
    IF v_count > 0 THEN
      v_failures := v_failures + 1;
      RAISE WARNING 'FAIL: % rows remain in %.% (uuid column, not named engagement_id) for engagement %', v_count, v_table, v_column, v_engagement;
    END IF;
  END LOOP;

  RAISE NOTICE '--- % columns checked across public / st_* tables ---', v_checked;
  IF v_failures = 0 THEN
    RAISE NOTICE 'PASS: zero rows remain for engagement % across every table checked.', v_engagement;
  ELSE
    RAISE WARNING 'FAIL: % column(s) still hold rows for engagement %. See warnings above.', v_failures, v_engagement;
  END IF;
END $$;
