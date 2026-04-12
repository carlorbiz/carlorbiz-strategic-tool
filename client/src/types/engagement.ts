// Types matching the st_* schema from migrations/strategic-tool/0001_init.sql
// Keep in sync with the SQL — if you add a column there, add it here.

// ── Enums ───────────────────────────────────────────────────────────────────

export type EngagementStatus = 'draft' | 'active' | 'delivered' | 'living' | 'archived';
export type EngagementType = 'strategic_planning' | 'grant_reporting' | 'governance' | 'accreditation';
export type TaxonomyStrictness = 'soft' | 'medium' | 'hard';
export type CommitmentKind = 'top' | 'sub' | 'cross_cut';
export type CommitmentStatus = 'active' | 'archived' | 'merged_into';
export type ScopeExtensionCategory = 'clarification' | 'expansion' | 'reinterpretation' | 'correction';
export type ChangeType =
  | 'commitment_created' | 'commitment_modified' | 'commitment_archived'
  | 'commitment_merged' | 'scope_extended' | 'scope_narrowed'
  | 'strictness_changed' | 'count_cap_overridden';
export type RatificationStatus = 'draft' | 'pending_board' | 'ratified' | 'rejected';
export type DocumentStatus = 'uploaded' | 'ingesting' | 'ingested' | 'failed';
export type SurveyStatus = 'uploaded' | 'ingesting' | 'ingested' | 'failed';
export type ReportStatus = 'draft' | 'review' | 'approved' | 'delivered';
export type StageType =
  | 'interview' | 'workshop' | 'report' | 'checkpoint' | 'board_review'
  | 'retrospective' | 'onboarding' | 'survey_run' | 'reporting_cycle';
export type StageStatus = 'draft' | 'open' | 'closed' | 'archived';
export type UpdateRagStatus = 'on_track' | 'at_risk' | 'blocked' | 'done';

// ── Core tables ─────────────────────────────────────────────────────────────

export interface Engagement {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  status: EngagementStatus;
  type: EngagementType;
  profile_key: string;
  taxonomy_strictness: TaxonomyStrictness;
  top_count_warning: number;
  top_count_hard_cap: number;
  pulse_cadence_days: number;
  branding_overrides: Record<string, unknown>;
  created_by: string | null;
  handed_over_to: string | null;
  handed_over_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EngagementStage {
  id: string;
  engagement_id: string;
  title: string;
  description: string | null;
  stage_type: StageType;
  status: StageStatus;
  order_index: number;
  nera_system_prompt: string | null;
  question_set: unknown[];
  is_recurring: boolean;
  recurrence_pattern: string | null;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Commitment {
  id: string;
  engagement_id: string;
  parent_id: string | null;
  kind: CommitmentKind;
  title: string;
  description: string | null;
  success_signal: string | null;
  status: CommitmentStatus;
  merged_into_id: string | null;
  order_index: number;
  justification_log_id: string | null;
  created_at: string;
  archived_at: string | null;
}

// ── Engagement roles ────────────────────────────────────────────────────────

export interface EngagementRole {
  id: string;
  engagement_id: string;
  role_key: string;
  label: string;
  permissions: {
    read?: boolean;
    write?: boolean;
    admin?: boolean;
  };
  default_profile: string | null;
  created_at: string;
}

export interface UserEngagementRole {
  id: string;
  user_id: string;
  engagement_id: string;
  role_id: string;
  granted_at: string;
  revoked_at: string | null;
  // Joined fields (populated when we join st_engagement_roles)
  role?: EngagementRole;
}

// ── AI config + vocabulary ──────────────────────────────────────────────────

export interface VocabularyMap {
  commitment_top_singular: string;
  commitment_top_plural: string;
  commitment_sub_singular: string;
  commitment_sub_plural: string;
  cross_cut_singular: string;
  cross_cut_plural: string;
  commitment_add_verb: string;
  commitment_archive_verb: string;
  evidence_singular: string;
  evidence_plural: string;
  [key: string]: string; // extensible
}

export interface DriftWatchConfig {
  silence_window_days: number;
  scope_extension_trigger_count: number;
  scope_extension_window_days: number;
  merge_watcher_similarity_threshold: number;
  merge_watcher_watch_days: number;
}

export interface StAiConfig {
  id: string;
  engagement_id: string | null;
  profile_key: string | null;
  llm_provider: string;
  llm_model: string;
  vocabulary_map: VocabularyMap;
  system_prompt_interview: string | null;
  system_prompt_workshop: string | null;
  system_prompt_pulse: string | null;
  system_prompt_drift_watch: string | null;
  system_prompt_brief: string | null;
  system_prompt_report: string | null;
  system_prompt_update: string | null;
  drift_watch_config: DriftWatchConfig;
  dashboard_layout: unknown[];
  created_at: string;
  updated_at: string;
}

// ── Documents ───────────────────────────────────────────────────────────────

export interface StDocument {
  id: string;
  engagement_id: string;
  title: string;
  description: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  primary_commitment_id: string | null;
  status: DocumentStatus;
  chunk_count: number;
  contains_pii: boolean;
  summary: string | null;
  uploaded_by: string | null;
  created_at: string;
  processed_at: string | null;
}

// ── Initiative updates ──────────────────────────────────────────────────────

export interface InitiativeUpdate {
  id: string;
  commitment_id: string;
  engagement_id: string;
  rag_status: UpdateRagStatus;
  narrative: string;
  sources: unknown[];
  author_id: string | null;
  created_at: string;
}

// ── Drift reports ───────────────────────────────────────────────────────────

export interface DriftReport {
  id: string;
  engagement_id: string;
  report_window_start: string | null;
  report_window_end: string | null;
  narrative: string | null;
  signals: unknown[];
  merge_suggestions: unknown[];
  created_at: string;
}

// ── Default vocabulary (used as fallback when no config is loaded) ───────────

export const DEFAULT_VOCABULARY: VocabularyMap = {
  commitment_top_singular: 'Priority',
  commitment_top_plural: 'Priorities',
  commitment_sub_singular: 'Initiative',
  commitment_sub_plural: 'Initiatives',
  cross_cut_singular: 'Lens',
  cross_cut_plural: 'Lenses',
  commitment_add_verb: 'introduce',
  commitment_archive_verb: 'retire',
  evidence_singular: 'document',
  evidence_plural: 'documents',
};
