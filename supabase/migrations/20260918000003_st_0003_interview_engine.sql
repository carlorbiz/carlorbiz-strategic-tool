-- ─── Interview Engine tables ─────────────────────────────────────────────────
-- These ie_* tables are the shared Conversational Interview Engine.
-- Product-agnostic: strategic-tool is the first consumer (Option A, 13 Apr 2026).
-- Exec-reclaim and all other CJ/Nera surfaces consume the same tables via
-- the interview-engine-* edge functions with product-specific configuration.
-- ie_* tables extract independently of st_* tables — see docs/extraction-plan.md.

-- ── ie_conversations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ie_conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id),
  product_id      TEXT NOT NULL,        -- 'strategic-tool', 'exec-reclaim', etc.
  engagement_id   UUID,                 -- nullable; only meaningful for strategic-tool
  goal            TEXT,                 -- 'update', 'pulse', 'stakeholder_interview', 'suitability', etc.
  cadence_mode    TEXT NOT NULL DEFAULT 'single',  -- 'single', 'daily', 'weekly', 'retrospective'
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active', 'completed', 'abandoned'
  summary         TEXT,                 -- cross-session summary (written by summarise-session)
  metadata        JSONB DEFAULT '{}'::jsonb,       -- product-specific context
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ie_conv_user_product ON ie_conversations (user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_ie_conv_engagement ON ie_conversations (engagement_id);
CREATE INDEX IF NOT EXISTS idx_ie_conv_status ON ie_conversations (status);

-- ── ie_messages ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ie_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ie_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,        -- 'system', 'user', 'assistant'
  content         TEXT NOT NULL,
  extracted_data  JSONB,                -- structured extraction output
  confidence_scores JSONB,             -- per-field confidence { field: 0.0-1.0 }
  justifications  JSONB,               -- per-field quoted justification { field: "quote" }
  prompt_id       UUID,                -- which prompt elicited this (if applicable)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ie_msg_conv ON ie_messages (conversation_id, created_at);

-- ── ie_user_state ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ie_user_state (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id),
  product_id      TEXT NOT NULL,
  engagement_mode TEXT NOT NULL DEFAULT 'active',  -- 'active', 'light', 'weekly', 'dormant'
  capacity_score  NUMERIC(3,2),         -- 0.00 to 1.00
  sentiment_trend TEXT,                 -- 'improving', 'stable', 'declining'
  last_state_eval_at TIMESTAMPTZ,
  mode_locked_until  TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Reuse the existing updated_at trigger function
CREATE TRIGGER trg_ie_user_state_updated_at
  BEFORE UPDATE ON ie_user_state
  FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

-- ── ie_prompt_coverage ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ie_prompt_coverage (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id),
  product_id      TEXT NOT NULL,
  conversation_id UUID REFERENCES ie_conversations(id) ON DELETE SET NULL,
  field_name      TEXT NOT NULL,
  last_touched_at TIMESTAMPTZ DEFAULT now(),
  last_confidence NUMERIC(3,2),
  decay_rate_days INT NOT NULL DEFAULT 0,  -- 0 = no decay (per-conversation coverage)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, field_name, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_ie_coverage_user ON ie_prompt_coverage (user_id, product_id, conversation_id);

-- ── ie_prompt_library ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ie_prompt_library (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      TEXT NOT NULL,
  prompt_text     TEXT NOT NULL,
  elicits_dimensions TEXT[] DEFAULT '{}',
  cadence_modes   TEXT[] DEFAULT '{}',
  energy_level_fit TEXT,                -- 'low', 'medium', 'high', 'any'
  audience_context TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ie_prompt_lib ON ie_prompt_library (product_id, is_active);

-- ── ie_entity_memory ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ie_entity_memory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id),
  product_id      TEXT NOT NULL,
  entity_type     TEXT NOT NULL,        -- 'person', 'event', 'preference', 'organisation', 'commitment'
  entity_value    TEXT NOT NULL,
  first_mentioned_at TIMESTAMPTZ DEFAULT now(),
  last_mentioned_at  TIMESTAMPTZ DEFAULT now(),
  mention_count   INT NOT NULL DEFAULT 1,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ie_entity_user ON ie_entity_memory (user_id, product_id, entity_type);


-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE ie_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ie_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ie_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ie_prompt_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ie_prompt_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE ie_entity_memory ENABLE ROW LEVEL SECURITY;

-- ie_conversations: users see their own
CREATE POLICY ie_conversations_select ON ie_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ie_conversations_insert ON ie_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ie_conversations_update ON ie_conversations
  FOR UPDATE USING (auth.uid() = user_id);

-- ie_messages: access via conversation ownership
CREATE POLICY ie_messages_select ON ie_messages
  FOR SELECT USING (
    (SELECT user_id FROM ie_conversations WHERE id = conversation_id) = auth.uid()
  );
CREATE POLICY ie_messages_insert ON ie_messages
  FOR INSERT WITH CHECK (
    (SELECT user_id FROM ie_conversations WHERE id = conversation_id) = auth.uid()
  );

-- ie_user_state: users see their own
CREATE POLICY ie_user_state_select ON ie_user_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ie_user_state_insert ON ie_user_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ie_user_state_update ON ie_user_state
  FOR UPDATE USING (auth.uid() = user_id);

-- ie_prompt_coverage: users see their own
CREATE POLICY ie_prompt_coverage_select ON ie_prompt_coverage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ie_prompt_coverage_insert ON ie_prompt_coverage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ie_prompt_coverage_update ON ie_prompt_coverage
  FOR UPDATE USING (auth.uid() = user_id);

-- ie_prompt_library: all authenticated users can read, admin writes
CREATE POLICY ie_prompt_library_select ON ie_prompt_library
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY ie_prompt_library_insert ON ie_prompt_library
  FOR INSERT WITH CHECK (st_is_admin());
CREATE POLICY ie_prompt_library_update ON ie_prompt_library
  FOR UPDATE USING (st_is_admin());
CREATE POLICY ie_prompt_library_delete ON ie_prompt_library
  FOR DELETE USING (st_is_admin());

-- ie_entity_memory: users see their own
CREATE POLICY ie_entity_memory_select ON ie_entity_memory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ie_entity_memory_insert ON ie_entity_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ie_entity_memory_update ON ie_entity_memory
  FOR UPDATE USING (auth.uid() = user_id);
