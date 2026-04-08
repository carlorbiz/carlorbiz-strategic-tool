// ── Auth & Roles ──────────────────────────────────────────────
export type UserRole = 'internal_admin' | 'client_admin' | 'external_stakeholder';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  organization?: string;
  created_at: string;
  updated_at?: string;
}

// ── Workshop Sessions ─────────────────────────────────────────
export type SessionStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface WorkshopSession {
  id: string;
  name: string;
  description?: string;
  client_name: string;
  status: SessionStatus;
  access_token: string;
  strategic_plan_data?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ── Stakeholder Input (Pre-Meeting) ──────────────────────────
export type InputType = 'nera_conversation' | 'form_field' | 'survey_response';

export interface StakeholderInput {
  id: string;
  session_id: string;
  user_id?: string;
  participant_name?: string;
  participant_email?: string;
  input_type: InputType;
  content: Record<string, unknown>;
  conversation_history?: Array<{ role: string; content: string }>;
  nera_session_id?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Workshop Decisions ────────────────────────────────────────
export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type DecisionStatus = 'proposed' | 'approved' | 'deferred' | 'rejected';

export interface WorkshopDecision {
  id: string;
  session_id: string;
  category: string;
  title: string;
  description?: string;
  priority: PriorityLevel;
  status: DecisionStatus;
  impact_score?: number;
  feasibility_score?: number;
  stakeholder_alignment?: number;
  rationale?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ── Workshop Photos ───────────────────────────────────────────
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface WorkshopPhoto {
  id: string;
  session_id: string;
  image_url: string;
  ocr_text?: string;
  ocr_status: OcrStatus;
  swot_category?: string;
  priority?: PriorityLevel;
  uploaded_by?: string;
  created_at: string;
}

// ── Workshop Chat (Facilitator AI) ────────────────────────────
export type ChatFunction = 'question' | 'swot_categorisation' | 'narrative_summary';

export interface WorkshopChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  chat_function?: ChatFunction;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ── Workshop Reports ──────────────────────────────────────────
export type ReportStatus = 'generating' | 'completed' | 'failed';

export interface WorkshopReport {
  id: string;
  session_id: string;
  title: string;
  report_url?: string;
  report_data?: Record<string, unknown>;
  status: ReportStatus;
  generated_by?: string;
  created_at: string;
}

// ── App Configuration ─────────────────────────────────────────
export interface AppConfig {
  id: string;
  organisation_name: string;
  primary_colour: string;
  accent_colour: string;
  logo_url?: string;
  nera_system_prompt?: string;
  facilitator_system_prompt?: string;
  default_strategic_plan?: Record<string, unknown>;
  updated_at: string;
}

// ── Strategic Plan Data Structure ─────────────────────────────
export interface StrategicPlanData {
  organisation: {
    name: string;
    mission?: string;
    vision?: string;
  };
  executive_summary: {
    title: string;
    overview: string;
    key_findings: string[];
    strategic_direction: string;
  };
  pillars: Array<{
    id: string;
    name: string;
    description: string;
    objectives: Array<{
      title: string;
      description: string;
      kpis: string[];
    }>;
  }>;
  evidence_base: {
    survey_data?: Record<string, unknown>;
    community_data?: Record<string, unknown>;
    stakeholder_quotes?: Array<{ quote: string; attribution: string }>;
  };
  financial_strategy: {
    overview: string;
    budget_items?: Array<{ category: string; amount: number; description: string }>;
  };
  implementation_timeline: {
    phases: Array<{
      name: string;
      start: string;
      end: string;
      milestones: string[];
    }>;
  };
}

// ── Nera Conversation Types ───────────────────────────────────
export interface NeraMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NeraQueryRequest {
  query: string;
  session_id: string;
  user_id?: string;
  workshop_session_id?: string;
  context?: string;
}

export interface NeraQueryResponse {
  type: 'answer' | 'clarification';
  answer: string;
  sources: string[];
  options?: Array<{ label: string; value: string }>;
  query_id?: string;
}

// ── SSE Stream Types ──────────────────────────────────────────
export interface StreamCallbacks {
  onMeta: (meta: {
    type: string;
    sources?: string[];
    query_id?: string;
    answer?: string;
    options?: Array<{ label: string; value: string }>;
  }) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}
