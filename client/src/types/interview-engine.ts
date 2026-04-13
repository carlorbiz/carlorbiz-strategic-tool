// Types for the shared Conversational Interview Engine (ie_* tables).
// Product-agnostic — consumed by strategic-tool, exec-reclaim, and all CJ/Nera surfaces.
// Keep in sync with migrations/strategic-tool/0003_interview_engine.sql.

export type ConversationStatus = 'active' | 'completed' | 'abandoned';
export type CadenceMode = 'single' | 'daily' | 'weekly' | 'retrospective';
export type EngagementMode = 'active' | 'light' | 'weekly' | 'dormant';
export type SentimentTrend = 'improving' | 'stable' | 'declining';
export type EnergyLevelFit = 'low' | 'medium' | 'high' | 'any';
export type EntityType = 'person' | 'event' | 'preference' | 'organisation' | 'commitment';

export interface IeConversation {
  id: string;
  user_id: string;
  product_id: string;
  engagement_id: string | null;
  goal: string | null;
  cadence_mode: CadenceMode;
  status: ConversationStatus;
  summary: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface IeMessage {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  extracted_data: Record<string, unknown> | null;
  confidence_scores: Record<string, number> | null;
  justifications: Record<string, string> | null;
  prompt_id: string | null;
  created_at: string;
}

export interface IeUserState {
  id: string;
  user_id: string;
  product_id: string;
  engagement_mode: EngagementMode;
  capacity_score: number | null;
  sentiment_trend: SentimentTrend | null;
  last_state_eval_at: string | null;
  mode_locked_until: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IePromptCoverage {
  id: string;
  user_id: string;
  product_id: string;
  conversation_id: string | null;
  field_name: string;
  last_touched_at: string | null;
  last_confidence: number | null;
  decay_rate_days: number;
  created_at: string;
}

export interface IePromptLibraryEntry {
  id: string;
  product_id: string;
  prompt_text: string;
  elicits_dimensions: string[];
  cadence_modes: string[];
  energy_level_fit: EnergyLevelFit | null;
  audience_context: string | null;
  is_active: boolean;
  created_at: string;
}

export interface IeEntityMemory {
  id: string;
  user_id: string;
  product_id: string;
  entity_type: EntityType;
  entity_value: string;
  first_mentioned_at: string;
  last_mentioned_at: string;
  mention_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Extraction schema (passed to interview-engine-extract) ────────────────

export interface ExtractionField {
  field_name: string;
  description: string;
  type: 'text' | 'enum' | 'boolean' | 'number';
  valid_values?: string[];
}

export interface ExtractedField {
  field_name: string;
  value: unknown;
  confidence: number;
  justification_quote: string;
}

export interface ExtractionResult {
  extracted_fields: ExtractedField[];
  response_text: string;
}
