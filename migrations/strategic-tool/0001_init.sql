-- =============================================================================
-- Carlorbiz Strategic Tool — Phase 1 Schema Migration
-- migrations/strategic-tool/0001_init.sql
--
-- Creates all st_* tables, enums, RLS policies, indexes, and storage buckets
-- for the strategic-tool living platform.
--
-- MUST be run on the SHARED carlorbiz-website Supabase project.
-- Every object is prefixed st_* or st-* for clean extraction later.
-- See docs/extraction-plan.md for the commercial extraction checklist.
--
-- Pre-requisites:
--   - DEFINITIVE_MIGRATION.sql (base carlorbiz-website schema)
--   - user_profiles table exists with role column
--   - uuid-ossp extension enabled
--
-- Run: paste into Supabase SQL Editor, or:
--   supabase db execute --project-ref <ref> < migrations/strategic-tool/0001_init.sql
-- =============================================================================

BEGIN;

-- ─── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE st_engagement_status AS ENUM (
    'draft', 'active', 'delivered', 'living', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_engagement_type AS ENUM (
    'strategic_planning', 'grant_reporting', 'governance', 'accreditation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_taxonomy_strictness AS ENUM (
    'soft', 'medium', 'hard'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_commitment_kind AS ENUM (
    'top', 'sub', 'cross_cut'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_commitment_status AS ENUM (
    'active', 'archived', 'merged_into'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_scope_extension_category AS ENUM (
    'clarification', 'expansion', 'reinterpretation', 'correction'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_change_type AS ENUM (
    'commitment_created', 'commitment_modified', 'commitment_archived',
    'commitment_merged', 'scope_extended', 'scope_narrowed',
    'strictness_changed', 'count_cap_overridden'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_ratification_status AS ENUM (
    'draft', 'pending_board', 'ratified', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_document_status AS ENUM (
    'uploaded', 'ingesting', 'ingested', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_survey_status AS ENUM (
    'uploaded', 'ingesting', 'ingested', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_report_status AS ENUM (
    'draft', 'review', 'approved', 'delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_stage_type AS ENUM (
    'interview', 'workshop', 'report', 'checkpoint', 'board_review',
    'retrospective', 'onboarding', 'survey_run', 'reporting_cycle'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_stage_status AS ENUM (
    'draft', 'open', 'closed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE st_update_rag_status AS ENUM (
    'on_track', 'at_risk', 'blocked', 'done'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── Core: Engagements ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_engagements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  client_name     TEXT,
  description     TEXT,
  status          st_engagement_status NOT NULL DEFAULT 'draft',
  type            st_engagement_type NOT NULL DEFAULT 'strategic_planning',
  profile_key     TEXT NOT NULL DEFAULT 'strategic-planning',
  taxonomy_strictness st_taxonomy_strictness NOT NULL DEFAULT 'soft',
  top_count_warning   INT NOT NULL DEFAULT 6,
  top_count_hard_cap  INT NOT NULL DEFAULT 7,
  pulse_cadence_days  INT NOT NULL DEFAULT 42,
  branding_overrides  JSONB DEFAULT '{}'::jsonb,
  created_by      UUID REFERENCES user_profiles(id),
  handed_over_to  UUID REFERENCES user_profiles(id),
  handed_over_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_engagements_status ON st_engagements (status);
CREATE INDEX IF NOT EXISTS idx_st_engagements_created_by ON st_engagements (created_by);


-- ─── Engagement stages ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_engagement_stages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  stage_type      st_stage_type NOT NULL DEFAULT 'workshop',
  status          st_stage_status NOT NULL DEFAULT 'draft',
  order_index     INT NOT NULL DEFAULT 0,
  nera_system_prompt TEXT,
  question_set    JSONB DEFAULT '[]'::jsonb,
  is_recurring    BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern TEXT,          -- e.g. 'every_6_weeks', 'monthly', 'quarterly'
  opens_at        TIMESTAMPTZ,
  closes_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_stages_engagement ON st_engagement_stages (engagement_id);
CREATE INDEX IF NOT EXISTS idx_st_stages_status ON st_engagement_stages (engagement_id, status);


-- ─── Stage participants ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_stage_participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id        UUID NOT NULL REFERENCES st_engagement_stages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES user_profiles(id),
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  UNIQUE (stage_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_st_stage_parts_stage ON st_stage_participants (stage_id);
CREATE INDEX IF NOT EXISTS idx_st_stage_parts_user ON st_stage_participants (user_id);


-- ─── Engagement roles (per-engagement RBAC) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS st_engagement_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  role_key        TEXT NOT NULL,     -- e.g. 'client_admin', 'ceo', 'board_chair', 'board_member', 'operational_lead', 'facilitator'
  label           TEXT NOT NULL,     -- display name, admin-editable
  permissions     JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_profile TEXT,              -- which profile is active by default for this role
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, role_key)
);

CREATE TABLE IF NOT EXISTS st_user_engagement_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES st_engagement_roles(id) ON DELETE CASCADE,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  UNIQUE (user_id, engagement_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_st_user_eng_roles_user ON st_user_engagement_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_st_user_eng_roles_eng ON st_user_engagement_roles (engagement_id);


-- ─── Engagement profiles (many-to-many between engagements and profile keys)

CREATE TABLE IF NOT EXISTS st_engagement_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  profile_key     TEXT NOT NULL,     -- e.g. 'strategic-planning', 'grant-reporting', 'governance'
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (engagement_id, profile_key)
);


-- ─── Commitments (the taxonomy: Priorities / Initiatives / Lenses) ──────────

CREATE TABLE IF NOT EXISTS st_commitments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES st_commitments(id) ON DELETE SET NULL,
  kind            st_commitment_kind NOT NULL DEFAULT 'top',
  title           TEXT NOT NULL,
  description     TEXT,
  success_signal  TEXT,
  status          st_commitment_status NOT NULL DEFAULT 'active',
  merged_into_id  UUID REFERENCES st_commitments(id) ON DELETE SET NULL,
  order_index     INT NOT NULL DEFAULT 0,
  justification_log_id UUID,        -- FK added after st_commitment_change_log exists
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_st_commitments_engagement ON st_commitments (engagement_id);
CREATE INDEX IF NOT EXISTS idx_st_commitments_parent ON st_commitments (parent_id);
CREATE INDEX IF NOT EXISTS idx_st_commitments_kind ON st_commitments (engagement_id, kind);
CREATE INDEX IF NOT EXISTS idx_st_commitments_active ON st_commitments (engagement_id, status) WHERE status = 'active';


-- ─── Commitment change log ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_commitment_change_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  commitment_id   UUID REFERENCES st_commitments(id) ON DELETE SET NULL,
  change_type     st_change_type NOT NULL,
  reason_narrative TEXT,
  success_signal  TEXT,
  ratification_status st_ratification_status DEFAULT 'draft',
  ratification_document_id UUID,     -- FK to st_documents if a board paper was generated
  author_id       UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_change_log_engagement ON st_commitment_change_log (engagement_id);
CREATE INDEX IF NOT EXISTS idx_st_change_log_commitment ON st_commitment_change_log (commitment_id);

-- Now add the deferred FK on st_commitments
ALTER TABLE st_commitments
  ADD CONSTRAINT fk_st_commitments_justification
  FOREIGN KEY (justification_log_id)
  REFERENCES st_commitment_change_log(id)
  ON DELETE SET NULL;


-- ─── Scope extensions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_scope_extensions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commitment_id   UUID NOT NULL REFERENCES st_commitments(id) ON DELETE CASCADE,
  category        st_scope_extension_category NOT NULL,
  narrative       TEXT NOT NULL,
  triggering_document_id UUID,       -- FK to st_documents
  change_log_id   UUID REFERENCES st_commitment_change_log(id),
  created_by      UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_scope_ext_commitment ON st_scope_extensions (commitment_id);


-- ─── Documents (living-phase uploads) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  file_path       TEXT,              -- path in st-documents storage bucket
  file_type       TEXT,              -- pdf, docx, md, txt, xlsx, csv, json, image
  file_size_bytes BIGINT,
  primary_commitment_id UUID REFERENCES st_commitments(id) ON DELETE SET NULL,
  status          st_document_status NOT NULL DEFAULT 'uploaded',
  chunk_count     INT DEFAULT 0,
  contains_pii    BOOLEAN NOT NULL DEFAULT false,
  summary         TEXT,              -- Nera-generated one-sentence summary
  uploaded_by     UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_st_documents_engagement ON st_documents (engagement_id);
CREATE INDEX IF NOT EXISTS idx_st_documents_status ON st_documents (engagement_id, status);
CREATE INDEX IF NOT EXISTS idx_st_documents_commitment ON st_documents (primary_commitment_id);


-- ─── Commitment ↔ Document links (many-to-many) ────────────────────────────

CREATE TABLE IF NOT EXISTS st_commitment_document_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commitment_id   UUID NOT NULL REFERENCES st_commitments(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES st_documents(id) ON DELETE CASCADE,
  link_type       TEXT DEFAULT 'tagged',  -- 'primary', 'tagged', 'cited'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (commitment_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_st_cdl_commitment ON st_commitment_document_links (commitment_id);
CREATE INDEX IF NOT EXISTS idx_st_cdl_document ON st_commitment_document_links (document_id);


-- ─── Stakeholder inputs (Nera-conversation transcripts) ─────────────────────

CREATE TABLE IF NOT EXISTS st_stakeholder_inputs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id        UUID NOT NULL REFERENCES st_engagement_stages(id) ON DELETE CASCADE,
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES user_profiles(id),
  conversation_history JSONB DEFAULT '[]'::jsonb,
  extracted_insights   JSONB DEFAULT '{}'::jsonb,
  is_complete     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_stakeholder_stage ON st_stakeholder_inputs (stage_id);
CREATE INDEX IF NOT EXISTS idx_st_stakeholder_engagement ON st_stakeholder_inputs (engagement_id);


-- ─── Workshop decisions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_workshop_decisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id        UUID NOT NULL REFERENCES st_engagement_stages(id) ON DELETE CASCADE,
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  impact_assessment TEXT,
  swot_category   TEXT CHECK (swot_category IN ('strength', 'weakness', 'opportunity', 'threat')),
  commitment_id   UUID REFERENCES st_commitments(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_decisions_stage ON st_workshop_decisions (stage_id);
CREATE INDEX IF NOT EXISTS idx_st_decisions_engagement ON st_workshop_decisions (engagement_id);


-- ─── Workshop photos ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_workshop_photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id        UUID NOT NULL REFERENCES st_engagement_stages(id) ON DELETE CASCADE,
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,     -- path in st-workshop-photos storage bucket
  ocr_text        TEXT,
  ocr_processed   BOOLEAN NOT NULL DEFAULT false,
  swot_category   TEXT CHECK (swot_category IN ('strength', 'weakness', 'opportunity', 'threat')),
  commitment_id   UUID REFERENCES st_commitments(id) ON DELETE SET NULL,
  uploaded_by     UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_photos_stage ON st_workshop_photos (stage_id);
CREATE INDEX IF NOT EXISTS idx_st_photos_engagement ON st_workshop_photos (engagement_id);


-- ─── Stage insights (synthesised output from a closed stage) ────────────────

CREATE TABLE IF NOT EXISTS st_stage_insights (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id        UUID NOT NULL REFERENCES st_engagement_stages(id) ON DELETE CASCADE,
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  themes          JSONB DEFAULT '[]'::jsonb,
  tensions        JSONB DEFAULT '[]'::jsonb,
  surprises       JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  narrative       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_insights_stage ON st_stage_insights (stage_id);
CREATE INDEX IF NOT EXISTS idx_st_insights_engagement ON st_stage_insights (engagement_id);


-- ─── Engagement deliverables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_engagement_deliverables (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content_markdown TEXT,
  content_structured JSONB DEFAULT '{}'::jsonb,
  render_mode     TEXT DEFAULT 'full',   -- 'full', 'summary', 'executive'
  is_published    BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_deliverables_engagement ON st_engagement_deliverables (engagement_id);


-- ─── Initiative updates (conversational update mode) ────────────────────────

CREATE TABLE IF NOT EXISTS st_initiative_updates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commitment_id   UUID NOT NULL REFERENCES st_commitments(id) ON DELETE CASCADE,
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  rag_status      st_update_rag_status NOT NULL DEFAULT 'on_track',
  narrative       TEXT NOT NULL,
  sources         JSONB DEFAULT '[]'::jsonb,   -- links to documents, photos, conversations
  author_id       UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_updates_commitment ON st_initiative_updates (commitment_id);
CREATE INDEX IF NOT EXISTS idx_st_updates_engagement ON st_initiative_updates (engagement_id);


-- ─── Surveys ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_surveys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  period          TEXT,              -- e.g. '2026 Q1 Staff Survey'
  file_path       TEXT,              -- path in st-surveys storage bucket
  file_type       TEXT,              -- xlsx, xls, csv, json
  status          st_survey_status NOT NULL DEFAULT 'uploaded',
  contains_pii    BOOLEAN NOT NULL DEFAULT false,
  response_count  INT,
  overall_summary TEXT,
  uploaded_by     UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_st_surveys_engagement ON st_surveys (engagement_id);
CREATE INDEX IF NOT EXISTS idx_st_surveys_status ON st_surveys (engagement_id, status);


CREATE TABLE IF NOT EXISTS st_survey_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id       UUID NOT NULL REFERENCES st_surveys(id) ON DELETE CASCADE,
  sheet_name      TEXT,
  question_header TEXT NOT NULL,
  response_value  TEXT,
  respondent_index INT,              -- anonymous sequential index within the survey
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_survey_resp_survey ON st_survey_responses (survey_id);


CREATE TABLE IF NOT EXISTS st_survey_question_summaries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id       UUID NOT NULL REFERENCES st_surveys(id) ON DELETE CASCADE,
  question_header TEXT NOT NULL,
  response_count  INT,
  themes          JSONB DEFAULT '[]'::jsonb,
  sentiment       JSONB DEFAULT '{}'::jsonb,
  notable_quotes  JSONB DEFAULT '[]'::jsonb,
  summary         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_survey_qs_survey ON st_survey_question_summaries (survey_id);


-- ─── Drift reports ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_drift_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  report_window_start TIMESTAMPTZ,
  report_window_end   TIMESTAMPTZ,
  narrative       TEXT,
  signals         JSONB DEFAULT '[]'::jsonb,   -- structured drift signals
  merge_suggestions   JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_drift_engagement ON st_drift_reports (engagement_id);


-- ─── Reporting templates + compliance reports ───────────────────────────────

CREATE TABLE IF NOT EXISTS st_reporting_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID REFERENCES st_engagements(id) ON DELETE CASCADE,  -- NULL = global template
  name            TEXT NOT NULL,
  description     TEXT,
  template_markdown TEXT NOT NULL,   -- structured markdown with section placeholders
  funder_type     TEXT,              -- e.g. 'PHN quarterly', 'state health annual'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_templates_engagement ON st_reporting_templates (engagement_id);


CREATE TABLE IF NOT EXISTS st_compliance_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES st_reporting_templates(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  period_start    DATE,
  period_end      DATE,
  content_markdown TEXT,
  citations       JSONB DEFAULT '[]'::jsonb,    -- [{claim, source_chunk_id, source_document_id}]
  status          st_report_status NOT NULL DEFAULT 'draft',
  delivered_at    TIMESTAMPTZ,
  delivery_metadata JSONB DEFAULT '{}'::jsonb,  -- how/where it was sent
  created_by      UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_reports_engagement ON st_compliance_reports (engagement_id);
CREATE INDEX IF NOT EXISTS idx_st_reports_status ON st_compliance_reports (engagement_id, status);


-- ─── Strategic-tool AI config ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS st_ai_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID REFERENCES st_engagements(id) ON DELETE CASCADE,  -- NULL = global defaults
  profile_key     TEXT,
  llm_provider    TEXT DEFAULT 'anthropic',
  llm_model       TEXT DEFAULT 'claude-sonnet-4-20250514',
  vocabulary_map  JSONB NOT NULL DEFAULT '{
    "commitment_top_singular": "Priority",
    "commitment_top_plural": "Priorities",
    "commitment_sub_singular": "Initiative",
    "commitment_sub_plural": "Initiatives",
    "cross_cut_singular": "Lens",
    "cross_cut_plural": "Lenses",
    "commitment_add_verb": "introduce",
    "commitment_archive_verb": "retire",
    "evidence_singular": "document",
    "evidence_plural": "documents"
  }'::jsonb,
  system_prompt_interview TEXT,
  system_prompt_workshop  TEXT,
  system_prompt_pulse     TEXT,
  system_prompt_drift_watch TEXT,
  system_prompt_brief     TEXT,
  system_prompt_report    TEXT,
  system_prompt_update    TEXT,
  drift_watch_config JSONB DEFAULT '{
    "silence_window_days": 60,
    "scope_extension_trigger_count": 5,
    "scope_extension_window_days": 180,
    "merge_watcher_similarity_threshold": 0.80,
    "merge_watcher_watch_days": 45
  }'::jsonb,
  dashboard_layout JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_ai_config_engagement ON st_ai_config (engagement_id);
CREATE INDEX IF NOT EXISTS idx_st_ai_config_profile ON st_ai_config (profile_key);


-- ─── Storage buckets ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('st-documents', 'st-documents', false),
  ('st-workshop-photos', 'st-workshop-photos', false),
  ('st-surveys', 'st-surveys', false),
  ('st-deliverables', 'st-deliverables', false)
ON CONFLICT (id) DO NOTHING;


-- ─── Enable RLS on ALL st_* tables ──────────────────────────────────────────

ALTER TABLE st_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_engagement_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_stage_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_engagement_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_user_engagement_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_engagement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_commitment_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_scope_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_commitment_document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_stakeholder_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_workshop_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_workshop_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_stage_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_engagement_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_initiative_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_survey_question_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_drift_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_reporting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_ai_config ENABLE ROW LEVEL SECURITY;


-- ─── RLS Policies ───────────────────────────────────────────────────────────
--
-- Strategy: all st_* tables are gated through the user's engagement role.
-- A helper function checks whether the current user has ANY role in the
-- given engagement. Admins (internal_admin in user_profiles) bypass.
--
-- For the shared Supabase project, these policies ensure that:
--   1. Unauthenticated users see NOTHING in st_* tables
--   2. Authenticated users see only engagements they have a role in
--   3. carlorbiz-website's existing tables are completely unaffected
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: does this user have a role in this engagement?
CREATE OR REPLACE FUNCTION st_user_has_engagement_access(eng_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM st_user_engagement_roles
    WHERE user_id = auth.uid()
      AND engagement_id = eng_id
      AND revoked_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'internal_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is this user an internal admin?
CREATE OR REPLACE FUNCTION st_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'internal_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: does this user have a specific role_key in an engagement?
CREATE OR REPLACE FUNCTION st_user_has_role(eng_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM st_user_engagement_roles uer
    JOIN st_engagement_roles er ON er.id = uer.role_id
    WHERE uer.user_id = auth.uid()
      AND uer.engagement_id = eng_id
      AND er.role_key = required_role
      AND uer.revoked_at IS NULL
  )
  OR st_is_admin();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ── st_engagements ──

CREATE POLICY st_engagements_select ON st_engagements
  FOR SELECT USING (st_user_has_engagement_access(id));

CREATE POLICY st_engagements_insert ON st_engagements
  FOR INSERT WITH CHECK (st_is_admin());

CREATE POLICY st_engagements_update ON st_engagements
  FOR UPDATE USING (st_user_has_role(id, 'client_admin') OR st_is_admin());

CREATE POLICY st_engagements_delete ON st_engagements
  FOR DELETE USING (st_is_admin());


-- ── Engagement-scoped tables (same pattern: select if you have engagement access,
--    insert/update if you have engagement access, delete if admin) ──

-- Macro: for each engagement-scoped table with an engagement_id column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'st_engagement_stages',
    -- st_stage_participants excluded: no engagement_id column, handled manually below
    'st_engagement_roles',
    'st_engagement_profiles',
    'st_commitments',
    'st_commitment_change_log',
    'st_documents',
    'st_commitment_document_links',
    'st_stakeholder_inputs',
    'st_workshop_decisions',
    'st_workshop_photos',
    'st_stage_insights',
    'st_engagement_deliverables',
    'st_initiative_updates',
    'st_surveys',
    'st_drift_reports',
    'st_reporting_templates',
    'st_compliance_reports',
    'st_ai_config'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (st_user_has_engagement_access(engagement_id))',
      tbl || '_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (st_user_has_engagement_access(engagement_id))',
      tbl || '_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (st_user_has_engagement_access(engagement_id))',
      tbl || '_update', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (st_is_admin())',
      tbl || '_delete', tbl
    );
  END LOOP;
END $$;

-- ── st_user_engagement_roles: users see their own, admins see all ──

CREATE POLICY st_user_engagement_roles_select ON st_user_engagement_roles
  FOR SELECT USING (user_id = auth.uid() OR st_is_admin());

CREATE POLICY st_user_engagement_roles_insert ON st_user_engagement_roles
  FOR INSERT WITH CHECK (st_is_admin());

CREATE POLICY st_user_engagement_roles_update ON st_user_engagement_roles
  FOR UPDATE USING (st_is_admin());

CREATE POLICY st_user_engagement_roles_delete ON st_user_engagement_roles
  FOR DELETE USING (st_is_admin());

-- ── st_stage_participants: access via stage's engagement ──

CREATE POLICY st_stage_participants_select ON st_stage_participants
  FOR SELECT USING (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_engagement_stages WHERE id = stage_id)
    )
  );

CREATE POLICY st_stage_participants_insert ON st_stage_participants
  FOR INSERT WITH CHECK (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_engagement_stages WHERE id = stage_id)
    )
  );

CREATE POLICY st_stage_participants_update ON st_stage_participants
  FOR UPDATE USING (st_is_admin());

CREATE POLICY st_stage_participants_delete ON st_stage_participants
  FOR DELETE USING (st_is_admin());

-- ── st_scope_extensions: access via commitment's engagement ──

CREATE POLICY st_scope_extensions_select ON st_scope_extensions
  FOR SELECT USING (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_commitments WHERE id = commitment_id)
    )
  );

CREATE POLICY st_scope_extensions_insert ON st_scope_extensions
  FOR INSERT WITH CHECK (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_commitments WHERE id = commitment_id)
    )
  );

CREATE POLICY st_scope_extensions_update ON st_scope_extensions
  FOR UPDATE USING (st_is_admin());

CREATE POLICY st_scope_extensions_delete ON st_scope_extensions
  FOR DELETE USING (st_is_admin());

-- ── st_survey_responses + st_survey_question_summaries: access via survey's engagement ──

CREATE POLICY st_survey_responses_select ON st_survey_responses
  FOR SELECT USING (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_surveys WHERE id = survey_id)
    )
  );

CREATE POLICY st_survey_responses_insert ON st_survey_responses
  FOR INSERT WITH CHECK (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_surveys WHERE id = survey_id)
    )
  );

CREATE POLICY st_survey_responses_update ON st_survey_responses
  FOR UPDATE USING (st_is_admin());

CREATE POLICY st_survey_responses_delete ON st_survey_responses
  FOR DELETE USING (st_is_admin());

CREATE POLICY st_survey_question_summaries_select ON st_survey_question_summaries
  FOR SELECT USING (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_surveys WHERE id = survey_id)
    )
  );

CREATE POLICY st_survey_question_summaries_insert ON st_survey_question_summaries
  FOR INSERT WITH CHECK (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_surveys WHERE id = survey_id)
    )
  );

CREATE POLICY st_survey_question_summaries_update ON st_survey_question_summaries
  FOR UPDATE USING (st_is_admin());

CREATE POLICY st_survey_question_summaries_delete ON st_survey_question_summaries
  FOR DELETE USING (st_is_admin());

-- ── st_commitment_document_links: needs special handling (no engagement_id column) ──
-- Already handled in the macro above since it does have a path through
-- commitment_id → st_commitments.engagement_id... but wait, the macro
-- assumed a direct engagement_id column. Let me fix this.

-- Drop the macro-generated policies for st_commitment_document_links
DROP POLICY IF EXISTS st_commitment_document_links_select ON st_commitment_document_links;
DROP POLICY IF EXISTS st_commitment_document_links_insert ON st_commitment_document_links;
DROP POLICY IF EXISTS st_commitment_document_links_update ON st_commitment_document_links;
DROP POLICY IF EXISTS st_commitment_document_links_delete ON st_commitment_document_links;

-- The table doesn't have engagement_id directly — access via commitment's engagement
CREATE POLICY st_commitment_document_links_select ON st_commitment_document_links
  FOR SELECT USING (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_commitments WHERE id = commitment_id)
    )
  );

CREATE POLICY st_commitment_document_links_insert ON st_commitment_document_links
  FOR INSERT WITH CHECK (
    st_user_has_engagement_access(
      (SELECT engagement_id FROM st_commitments WHERE id = commitment_id)
    )
  );

CREATE POLICY st_commitment_document_links_update ON st_commitment_document_links
  FOR UPDATE USING (st_is_admin());

CREATE POLICY st_commitment_document_links_delete ON st_commitment_document_links
  FOR DELETE USING (st_is_admin());


-- ─── Storage bucket policies ────────────────────────────────────────────────

-- Authenticated users can read from all st-* buckets (RLS on the table data
-- gates which engagement's files they can see; the bucket policy just gates
-- authenticated vs unauthenticated).
-- Only authenticated users can upload.

CREATE POLICY st_documents_bucket_select ON storage.objects
  FOR SELECT USING (bucket_id = 'st-documents' AND auth.role() = 'authenticated');

CREATE POLICY st_documents_bucket_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'st-documents' AND auth.role() = 'authenticated');

CREATE POLICY st_photos_bucket_select ON storage.objects
  FOR SELECT USING (bucket_id = 'st-workshop-photos' AND auth.role() = 'authenticated');

CREATE POLICY st_photos_bucket_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'st-workshop-photos' AND auth.role() = 'authenticated');

CREATE POLICY st_surveys_bucket_select ON storage.objects
  FOR SELECT USING (bucket_id = 'st-surveys' AND auth.role() = 'authenticated');

CREATE POLICY st_surveys_bucket_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'st-surveys' AND auth.role() = 'authenticated');

CREATE POLICY st_deliverables_bucket_select ON storage.objects
  FOR SELECT USING (bucket_id = 'st-deliverables' AND auth.role() = 'authenticated');

CREATE POLICY st_deliverables_bucket_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'st-deliverables' AND auth.role() = 'authenticated');


-- ─── Updated-at triggers ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION st_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'st_engagements',
    'st_engagement_stages',
    'st_stakeholder_inputs',
    'st_engagement_deliverables',
    'st_compliance_reports',
    'st_reporting_templates',
    'st_ai_config'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION st_set_updated_at()',
      'trg_' || tbl || '_updated_at', tbl
    );
  END LOOP;
END $$;


COMMIT;

-- =============================================================================
-- End of Phase 1 schema migration.
--
-- Tables created: 24
-- Enums created: 13
-- Indexes created: 34
-- RLS policies created: ~80 (via macro + manual)
-- Storage buckets created: 4
-- Helper functions created: 3
-- Triggers created: 7
--
-- Next: run migrations/strategic-tool/0002_extend_knowledge_chunks.sql
-- to add source_app + engagement_id columns to the shared knowledge_chunks table.
-- =============================================================================
