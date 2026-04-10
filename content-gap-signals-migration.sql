-- ============================================================
-- Nera Content Gap Signals
-- Purpose: Capture actionable "missing/partial coverage" gaps
-- detected during Nera queries so content can be improved in-flight.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_gap_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  query_id UUID REFERENCES public.nera_queries(id) ON DELETE SET NULL,
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  query_text TEXT NOT NULL,
  gap_type TEXT NOT NULL CHECK (gap_type IN (
    'no_explicit_resource',
    'partial_coverage',
    'terminology_mismatch'
  )),
  topic TEXT NOT NULL,

  detected_intent TEXT,
  detected_pathway TEXT,
  detected_classification TEXT,

  suggested_resource_type TEXT NOT NULL DEFAULT 'faq' CHECK (suggested_resource_type IN (
    'faq',
    'guide',
    'checklist',
    'playbook',
    'tab_expansion'
  )),
  confidence_score NUMERIC(3,2) DEFAULT 0.50,

  related_sources TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new',
    'reviewing',
    'accepted',
    'drafting',
    'resolved',
    'dismissed'
  )),
  admin_notes TEXT,
  linked_tab_slug TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_gap_signals_created
  ON public.content_gap_signals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_gap_signals_status
  ON public.content_gap_signals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_gap_signals_gap_type
  ON public.content_gap_signals (gap_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_gap_signals_query_id
  ON public.content_gap_signals (query_id);

ALTER TABLE public.content_gap_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read content gap signals"
  ON public.content_gap_signals FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update content gap signals"
  ON public.content_gap_signals FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Edge Functions use service role key and bypass RLS for inserts.

-- updated_at trigger (reuses existing function if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_content_gap_signals_updated_at'
    ) THEN
      CREATE TRIGGER update_content_gap_signals_updated_at
        BEFORE UPDATE ON public.content_gap_signals
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END $$;

