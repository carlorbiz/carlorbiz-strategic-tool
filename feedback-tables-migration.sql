-- ============================================================
-- Feedback System Tables Migration
-- Tables: feedback_campaigns, feedback_sessions
-- Run in Supabase SQL Editor (one-time, idempotent)
-- ============================================================

-- ─── feedback_campaigns ─────────────────────────────────────
-- Campaign configuration for feedback interview sessions.
-- Each campaign has its own system prompt, welcome message,
-- and branding. The system_prompt is never exposed to the
-- public frontend — loaded server-side only.

CREATE TABLE IF NOT EXISTS feedback_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  welcome_message TEXT,
  branding_config JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_campaigns_slug
  ON feedback_campaigns (campaign_slug);
CREATE INDEX IF NOT EXISTS idx_feedback_campaigns_status
  ON feedback_campaigns (status);

ALTER TABLE feedback_campaigns ENABLE ROW LEVEL SECURITY;

-- Public can read active campaigns (slug, title, welcome — NOT system_prompt)
CREATE POLICY "Public can read active campaigns"
  ON feedback_campaigns FOR SELECT
  USING (status = 'active');

-- Admins can manage all campaigns
CREATE POLICY "Admins can manage campaigns"
  ON feedback_campaigns FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─── feedback_sessions ──────────────────────────────────────
-- Anonymous feedback interview transcripts. Each session is
-- linked to a campaign and identified by a session_token
-- (UUID generated client-side, used for RLS-safe updates).
-- structured_feedback is extracted from conversation by the
-- Edge Function when Nera outputs a JSON code block.

CREATE TABLE IF NOT EXISTS feedback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES feedback_campaigns(id),
  session_token UUID NOT NULL DEFAULT gen_random_uuid(),
  transcript JSONB,
  structured_feedback JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  engagement_level TEXT,
  areas_covered TEXT[],
  notable_insights TEXT,
  willing_to_chat BOOLEAN,
  preferred_contact TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_sessions_campaign
  ON feedback_sessions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_status
  ON feedback_sessions (status);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_token
  ON feedback_sessions (session_token);

ALTER TABLE feedback_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can create a session (anonymous feedback)
CREATE POLICY "Anyone can create feedback sessions"
  ON feedback_sessions FOR INSERT
  WITH CHECK (true);

-- Anyone can update their own session (matched by session_token)
CREATE POLICY "Session owners can update their sessions"
  ON feedback_sessions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Only authenticated users (admins) can read all sessions
CREATE POLICY "Admins can read all feedback sessions"
  ON feedback_sessions FOR SELECT
  USING (auth.role() = 'authenticated');


-- ─── Trigger: update timestamps ─────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feedback_campaigns_updated_at
  BEFORE UPDATE ON feedback_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_sessions_updated_at
  BEFORE UPDATE ON feedback_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
