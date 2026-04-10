-- ============================================================
-- Auto-Chunking Pipeline Migration v2
-- Purpose: Trigger extract-tab-chunks Edge Function directly
--          when tabs.content changes (no external workflow tool)
-- Date: March 2026
-- Prerequisites: pg_net extension enabled
-- Replaces: auto-chunking-migration.sql (which used n8n webhook)
-- ============================================================

-- ─── New columns on tabs for chunking status ─────────────────
ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS needs_chunking BOOLEAN DEFAULT false;

ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS last_chunked_at TIMESTAMPTZ;

ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS chunk_status TEXT DEFAULT NULL
    CHECK (chunk_status IS NULL OR chunk_status IN (
      'pending', 'processing', 'complete', 'error'
    ));

CREATE INDEX IF NOT EXISTS idx_tabs_needs_chunking
  ON public.tabs (needs_chunking) WHERE needs_chunking = true;

-- ─── Webhook trigger function ────────────────────────────────
-- Fires when tabs.content changes or needs_chunking is set
-- Uses pg_net to POST directly to extract-tab-chunks Edge Function
--
-- IMPORTANT: Replace YOUR_PROJECT_REF with your Supabase project
-- reference (e.g. abcdefghijkl) and YOUR_SERVICE_ROLE_KEY with
-- your service role key from Settings > API.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_content_changed()
RETURNS trigger AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Configure these for your Supabase project
  -- Option 1: Hardcode (simple, single-project)
  edge_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/extract-tab-chunks';
  service_role_key := 'YOUR_SERVICE_ROLE_KEY';

  -- Option 2: Read from app_settings (if you store config there)
  -- SELECT value INTO edge_function_url FROM app_settings WHERE key = 'chunk_function_url';
  -- SELECT value INTO service_role_key FROM app_settings WHERE key = 'service_role_key';

  -- Case 1: content actually changed
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.chunk_status := 'pending';
    NEW.needs_chunking := false;

    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'tab_id', NEW.id
      )
    );

  -- Case 2: manual re-chunking requested
  ELSIF NEW.needs_chunking = true AND OLD.needs_chunking = false THEN
    NEW.chunk_status := 'pending';

    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'tab_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Attach trigger ──────────────────────────────────────────
DROP TRIGGER IF EXISTS on_tab_content_changed ON public.tabs;

CREATE TRIGGER on_tab_content_changed
  BEFORE UPDATE ON public.tabs
  FOR EACH ROW
  EXECUTE FUNCTION notify_content_changed();

-- ============================================================
-- This version calls the extract-tab-chunks Edge Function
-- directly via pg_net, eliminating the need for n8n or any
-- external workflow tool.
--
-- To backfill existing tabs after deployment:
-- UPDATE tabs SET needs_chunking = true
--   WHERE content IS NOT NULL
--     AND length(content) > 50
--     AND last_chunked_at IS NULL;
-- ============================================================
