-- ============================================================
-- Reporting & Content Verification Schema
-- Purpose: Support admin reporting dashboard, content reviews,
--          and insight regeneration pipeline.
-- Date: March 2026
-- ============================================================

-- 1. Add reviewed flag to nera_queries for negative feedback triage
ALTER TABLE nera_queries
  ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false;

ALTER TABLE nera_queries
  ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_queries_negative_unreviewed
  ON nera_queries (feedback_score, reviewed)
  WHERE feedback_score < 0 AND reviewed = false;

CREATE INDEX IF NOT EXISTS idx_queries_test_mode
  ON nera_queries (test_mode)
  WHERE test_mode = true;

-- 2. Content reviews table (quarterly review sign-off)
CREATE TABLE IF NOT EXISTS content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewed_by TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  flags_found INT DEFAULT 0,
  flags_resolved INT DEFAULT 0,
  sources_updated INT DEFAULT 0
);

ALTER TABLE content_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage content reviews"
  ON content_reviews FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Public can read content reviews"
  ON content_reviews FOR SELECT
  USING (true);

-- 3. Content insights table (AI-generated analysis)
CREATE TABLE IF NOT EXISTS content_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accuracy_flags JSONB DEFAULT '[]'::jsonb,
  themes_summary TEXT,
  strength_areas JSONB DEFAULT '[]'::jsonb,
  gap_analysis JSONB DEFAULT '[]'::jsonb,
  unanswered_topics JSONB DEFAULT '[]'::jsonb,
  nera_gap_correlation JSONB DEFAULT '{}'::jsonb,
  sessions_analysed INT DEFAULT 0,
  queries_analysed INT DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT DEFAULT 'system'
);

ALTER TABLE content_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read content insights"
  ON content_insights FOR SELECT
  USING (true);

CREATE POLICY "System can manage content insights"
  ON content_insights FOR ALL
  USING (auth.role() = 'authenticated');

-- 4. Content suggestions table
CREATE TABLE IF NOT EXISTS content_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type TEXT NOT NULL
    CHECK (suggestion_type IN ('new_content', 'update_existing', 'remove_outdated')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '[]'::jsonb,
  related_sources TEXT[] DEFAULT '{}',
  priority_score NUMERIC(3,1) DEFAULT 5.0,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed')),
  dismiss_reason TEXT,
  insight_id UUID REFERENCES content_insights(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read content suggestions"
  ON content_suggestions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can manage content suggestions"
  ON content_suggestions FOR ALL
  USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_suggestions_pending
  ON content_suggestions (priority_score DESC)
  WHERE status = 'pending';

-- 5. Insights state tracker
CREATE TABLE IF NOT EXISTS insights_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  is_stale BOOLEAN DEFAULT true,
  last_generated TIMESTAMPTZ,
  last_trigger TEXT,
  sessions_since_last INT DEFAULT 0,
  queries_since_last INT DEFAULT 0
);

INSERT INTO insights_state (id) VALUES ('default')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE insights_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read insights state"
  ON insights_state FOR SELECT
  USING (true);

CREATE POLICY "System can update insights state"
  ON insights_state FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================
-- The insights_state.is_stale flag should be set to true by
-- triggers on nera_queries and feedback_sessions inserts.
-- The regenerate-insights edge function resets it to false.
-- ============================================================
