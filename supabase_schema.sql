-- ============================================================
-- Carlorbiz Strategic Planning Toolkit — Supabase Schema
-- ============================================================

-- User profiles with role-based access
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'external_stakeholder'
    CHECK (role IN ('internal_admin', 'client_admin', 'facilitator', 'board_member', 'external_stakeholder')),
  organisation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Workshop sessions
CREATE TABLE IF NOT EXISTS workshop_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  access_token TEXT UNIQUE NOT NULL,
  strategic_plan_data JSONB,
  config JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-meeting stakeholder inputs
CREATE TABLE IF NOT EXISTS stakeholder_inputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES workshop_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  participant_name TEXT,
  participant_email TEXT,
  input_type TEXT NOT NULL DEFAULT 'nera_conversation'
    CHECK (input_type IN ('nera_conversation', 'survey', 'free_text', 'structured')),
  nera_session_id TEXT UNIQUE,
  conversation_history JSONB,
  content JSONB,
  insights_extracted JSONB,
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'reviewed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workshop decisions
CREATE TABLE IF NOT EXISTS workshop_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES workshop_sessions(id) ON DELETE CASCADE,
  category TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'rejected', 'deferred')),
  impact_analysis JSONB,
  ai_recommendation TEXT,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workshop photos (QR upload + OCR)
CREATE TABLE IF NOT EXISTS workshop_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES workshop_sessions(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  uploaded_by_name TEXT,
  ocr_status TEXT DEFAULT 'pending'
    CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_text TEXT,
  ocr_confidence REAL,
  priority TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  swot_category TEXT CHECK (swot_category IN ('strength', 'weakness', 'opportunity', 'threat')),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workshop AI chat messages
CREATE TABLE IF NOT EXISTS workshop_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES workshop_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  chat_function TEXT DEFAULT 'question'
    CHECK (chat_function IN ('question', 'swot_categorisation', 'narrative_summary')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workshop reports
CREATE TABLE IF NOT EXISTS workshop_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES workshop_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  report_type TEXT DEFAULT 'board_strategy'
    CHECK (report_type IN ('board_strategy', 'executive_summary', 'full_report')),
  content JSONB,
  pdf_url TEXT,
  generated_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application configuration (multi-tenant)
CREATE TABLE IF NOT EXISTS app_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge chunks for Nera AI (same pattern as carlorbiz-website)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES workshop_sessions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'strategic_plan'
    CHECK (source_type IN ('strategic_plan', 'stakeholder_input', 'workshop_decision', 'ocr_text', 'custom')),
  source_id TEXT,
  title TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_stakeholder_inputs_session ON stakeholder_inputs(session_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_inputs_nera ON stakeholder_inputs(nera_session_id);
CREATE INDEX IF NOT EXISTS idx_workshop_decisions_session ON workshop_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_workshop_photos_session ON workshop_photos(session_id);
CREATE INDEX IF NOT EXISTS idx_workshop_chat_session ON workshop_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_session ON knowledge_chunks(session_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY admin_all_user_profiles ON user_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('internal_admin', 'client_admin'))
  );

-- Users can read/update their own profile
CREATE POLICY own_profile ON user_profiles
  FOR ALL USING (user_id = auth.uid());

-- Workshop sessions: admins manage, others read active
CREATE POLICY admin_sessions ON workshop_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('internal_admin', 'client_admin', 'facilitator'))
  );

CREATE POLICY read_active_sessions ON workshop_sessions
  FOR SELECT USING (status = 'active');

-- Stakeholder inputs: own data or admin
CREATE POLICY own_inputs ON stakeholder_inputs
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY admin_inputs ON stakeholder_inputs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('internal_admin', 'client_admin', 'facilitator'))
  );

-- Workshop decisions: read for session participants, write for admins
CREATE POLICY read_decisions ON workshop_decisions
  FOR SELECT USING (true);

CREATE POLICY write_decisions ON workshop_decisions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('internal_admin', 'client_admin', 'facilitator'))
  );

-- Photos: anyone can insert (QR upload), admins manage
CREATE POLICY insert_photos ON workshop_photos
  FOR INSERT WITH CHECK (true);

CREATE POLICY read_photos ON workshop_photos
  FOR SELECT USING (true);

CREATE POLICY admin_photos ON workshop_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('internal_admin', 'client_admin', 'facilitator'))
  );

-- Chat messages: session-scoped
CREATE POLICY all_chat ON workshop_chat_messages
  FOR ALL USING (true);

-- Reports: admins manage
CREATE POLICY admin_reports ON workshop_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('internal_admin', 'client_admin'))
  );

CREATE POLICY read_reports ON workshop_reports
  FOR SELECT USING (status = 'published');

-- Config: admins only
CREATE POLICY admin_config ON app_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'internal_admin')
  );

-- Knowledge chunks: read for all authenticated, write for admins
CREATE POLICY read_knowledge ON knowledge_chunks
  FOR SELECT USING (true);

CREATE POLICY admin_knowledge ON knowledge_chunks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role IN ('internal_admin', 'client_admin'))
  );

-- ============================================================
-- Storage bucket for workshop photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('workshop-photos', 'workshop-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY upload_workshop_photos ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'workshop-photos');

CREATE POLICY read_workshop_photos ON storage.objects
  FOR SELECT USING (bucket_id = 'workshop-photos');
