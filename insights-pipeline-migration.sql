-- Migration: Feedback Insights Pipeline
-- Purpose: Tables for aggregated feedback analysis, content suggestions, and staleness tracking
-- Date: February 2026

-- ============================================================
-- Table 1: content_insights
-- Stores Claude-generated aggregated analysis per campaign
-- One row per insight "run"
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.feedback_campaigns(id),

  -- Claude-generated analysis
  themes_summary TEXT NOT NULL,
  strength_areas JSONB DEFAULT '[]',
  gap_analysis JSONB DEFAULT '[]',
  accuracy_flags JSONB DEFAULT '[]',
  nera_gap_correlation JSONB DEFAULT '[]',
  unanswered_topics JSONB DEFAULT '[]',

  -- Metadata
  sessions_analysed INTEGER NOT NULL DEFAULT 0,
  session_ids_included UUID[] DEFAULT '{}',
  nera_queries_analysed INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generation_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
  token_usage JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Table 2: content_suggestions
-- Individual actionable items derived from insights
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES public.content_insights(id),

  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
    'new_resource',
    'new_faq',
    'content_correction',
    'content_expansion',
    'content_gap'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  draft_content TEXT,

  priority_score INTEGER NOT NULL CHECK (priority_score BETWEEN 1 AND 10),
  evidence JSONB DEFAULT '{}',
  related_tabs TEXT[] DEFAULT '{}',

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'accepted',
    'in_progress',
    'completed',
    'dismissed',
    'deferred'
  )),
  dismiss_reason TEXT,
  actioned_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Table 3: insights_state
-- Lightweight staleness tracker (one row per campaign)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.insights_state (
  campaign_id UUID PRIMARY KEY REFERENCES public.feedback_campaigns(id),
  last_insight_generated_at TIMESTAMPTZ,
  sessions_since_last_insight INTEGER NOT NULL DEFAULT 0,
  is_stale BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_content_insights_campaign ON public.content_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_insights_generated ON public.content_insights(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_insight ON public.content_suggestions(insight_id);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_status ON public.content_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_priority ON public.content_suggestions(priority_score DESC);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.content_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights_state ENABLE ROW LEVEL SECURITY;

-- Insights: only authenticated users can read
CREATE POLICY "Authenticated users can read insights"
  ON public.content_insights FOR SELECT
  USING (auth.role() = 'authenticated');

-- Suggestions: authenticated users can read and update
CREATE POLICY "Authenticated users can read suggestions"
  ON public.content_suggestions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update suggestions"
  ON public.content_suggestions FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Insights state: authenticated users can read
CREATE POLICY "Authenticated users can read insights state"
  ON public.insights_state FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role writes (Edge Function uses service role key, bypasses RLS)

-- ============================================================
-- Trigger: Mark insights stale when feedback completes
-- ============================================================

CREATE OR REPLACE FUNCTION mark_insights_stale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.structured_feedback IS NOT NULL THEN
    INSERT INTO public.insights_state (campaign_id, sessions_since_last_insight, is_stale)
    VALUES (NEW.campaign_id, 1, true)
    ON CONFLICT (campaign_id) DO UPDATE SET
      sessions_since_last_insight = insights_state.sessions_since_last_insight + 1,
      is_stale = true,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_insights_stale
  AFTER INSERT OR UPDATE ON public.feedback_sessions
  FOR EACH ROW EXECUTE FUNCTION mark_insights_stale();

-- ============================================================
-- Updated_at trigger for content_suggestions
-- ============================================================

CREATE TRIGGER update_content_suggestions_updated_at
  BEFORE UPDATE ON public.content_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Seed insights_state for existing campaigns
-- ============================================================

INSERT INTO public.insights_state (campaign_id)
SELECT id FROM public.feedback_campaigns
ON CONFLICT (campaign_id) DO NOTHING;
