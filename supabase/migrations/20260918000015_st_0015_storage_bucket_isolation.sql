-- =============================================================================
-- 0015_storage_bucket_isolation.sql  (Strategy Engine sovereignty overhaul)
-- =============================================================================
-- Before this migration every st-* bucket policy was
--   USING (bucket_id = '<bucket>' AND auth.role() = 'authenticated')
-- so ANY authenticated user (including provisioned campaign/sandbox users)
-- could read any engagement's raw uploaded files (0001_init.sql:864-886).
--
-- Both client upload paths prefix object names with the engagement id
-- (documentApi.ts / surveyApi.ts: `${engagementId}/${timestamp}-${name}`), so
-- the first path segment is the tenancy key. Objects whose first segment is
-- not a UUID (none are expected) fall through to admin-only.
--
-- Helper: st_user_has_engagement_access(uuid) — SECURITY DEFINER, true for
-- internal admins and live (non-revoked) engagement members (0001_init.sql).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION st_storage_object_accessible(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  seg TEXT := split_part(object_name, '/', 1);
BEGIN
  IF seg ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN st_user_has_engagement_access(seg::uuid);
  END IF;
  RETURN st_is_admin();
END;
$$;

DROP POLICY IF EXISTS st_documents_bucket_select    ON storage.objects;
DROP POLICY IF EXISTS st_surveys_bucket_select      ON storage.objects;
DROP POLICY IF EXISTS st_photos_bucket_select       ON storage.objects;
DROP POLICY IF EXISTS st_deliverables_bucket_select ON storage.objects;
DROP POLICY IF EXISTS st_documents_bucket_insert    ON storage.objects;
DROP POLICY IF EXISTS st_surveys_bucket_insert      ON storage.objects;
DROP POLICY IF EXISTS st_photos_bucket_insert       ON storage.objects;
DROP POLICY IF EXISTS st_deliverables_bucket_insert ON storage.objects;

DO $$
DECLARE
  b TEXT;
  buckets TEXT[] := ARRAY['st-documents', 'st-surveys', 'st-workshop-photos', 'st-deliverables'];
  suffix TEXT;
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    suffix := replace(replace(b, 'st-', ''), '-', '_');

    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L AND st_storage_object_accessible(name))',
      'st_' || suffix || '_scoped_select', b);
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR INSERT WITH CHECK (bucket_id = %L AND st_storage_object_accessible(name))',
      'st_' || suffix || '_scoped_insert', b);
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR DELETE USING (bucket_id = %L AND st_storage_object_accessible(name))',
      'st_' || suffix || '_scoped_delete', b);
  END LOOP;
END;
$$;

COMMIT;
