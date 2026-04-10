-- Migration: Create ai_config table for configurable AI prompts and LLM provider
-- Run this against client Supabase instances when deploying from this template

CREATE TABLE IF NOT EXISTS ai_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  llm_provider TEXT NOT NULL DEFAULT 'anthropic',       -- 'anthropic' | 'google' | 'openai'
  llm_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  system_prompt TEXT,                                    -- Nera's main system prompt
  classify_prompt TEXT,                                  -- Query classification + triage prompt
  no_chunks_response TEXT,                               -- Fallback when no knowledge chunks found
  feedback_system_prompt TEXT,                            -- For feedback-chat function
  insights_prompt TEXT,                                   -- For generate-insights function
  synonym_map JSONB DEFAULT '{}'::jsonb,                 -- Domain-specific term mappings for query expansion
  typo_patterns JSONB DEFAULT '[]'::jsonb,               -- Domain-specific typo corrections [{"pattern": "regex", "replacement": "text"}]
  client_name TEXT DEFAULT 'Resource Hub',
  support_contact TEXT,                                   -- e.g. phone number, email for fallback responses
  default_pathway TEXT,                                   -- If domain uses pathway-based filtering
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row
INSERT INTO ai_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- RLS: service role only (edge functions use service role key)
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON ai_config
  FOR ALL USING (true) WITH CHECK (true);
