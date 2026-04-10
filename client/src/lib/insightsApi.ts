import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const GENERATE_URL = `${SUPABASE_URL}/functions/v1/generate-insights`;

// ─── Types ─────────────────────────────────────────────────────

export interface InsightsState {
  campaign_id: string;
  last_insight_generated_at: string | null;
  sessions_since_last_insight: number;
  is_stale: boolean;
}

export interface ContentInsight {
  id: string;
  campaign_id: string;
  themes_summary: string;
  strength_areas: Array<{ area: string; evidence: string; session_count: number }>;
  gap_analysis: Array<{ topic: string; frequency: number; urgency: string; source_sessions: string[]; corroborated_by_nera?: boolean }>;
  accuracy_flags: Array<{ content_area: string; concern: string; severity: string; source_sessions: string[] }>;
  nera_gap_correlation: Array<{ feedback_gap: string; related_queries_count: number; sample_queries: string[]; avg_feedback_score: number }>;
  unanswered_topics: Array<{ topic: string; query_count: number; sample_queries: string[] }>;
  sessions_analysed: number;
  nera_queries_analysed: number;
  generated_at: string;
  token_usage: { input_tokens: number; output_tokens: number };
}

export interface ContentSuggestion {
  id: string;
  insight_id: string;
  suggestion_type: string;
  title: string;
  description: string;
  draft_content: string | null;
  priority_score: number;
  evidence: { feedback_sessions?: string[]; nera_queries?: string[]; quotes?: string[] };
  related_tabs: string[];
  status: string;
  dismiss_reason: string | null;
  created_at: string;
}

// ─── API Functions ─────────────────────────────────────────────

export async function getInsightsState(campaignId: string): Promise<InsightsState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('insights_state')
    .select('*')
    .eq('campaign_id', campaignId)
    .single();
  if (error || !data) return null;
  return data as InsightsState;
}

export async function getLatestInsight(campaignId: string): Promise<ContentInsight | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('content_insights')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as ContentInsight;
}

export async function getSuggestions(insightId: string, statusFilter?: string): Promise<ContentSuggestion[]> {
  if (!supabase) return [];
  let query = supabase
    .from('content_suggestions')
    .select('*')
    .eq('insight_id', insightId)
    .order('priority_score', { ascending: false });
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as ContentSuggestion[];
}

export async function generateInsights(campaignId: string): Promise<{ insight_id: string; suggestions_generated: number; error?: string } | null> {
  if (!supabase) return { insight_id: '', suggestions_generated: 0, error: 'Supabase not configured' };
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  try {
    const response = await fetch(GENERATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ campaign_id: campaignId }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { insight_id: '', suggestions_generated: 0, error: (body as Record<string, string>).error || `Edge Function returned ${response.status}` };
    }
    return response.json();
  } catch (err) {
    return { insight_id: '', suggestions_generated: 0, error: `Network error: ${(err as Error).message}` };
  }
}

export async function updateSuggestionStatus(
  id: string,
  status: 'accepted' | 'dismissed' | 'deferred' | 'in_progress' | 'completed',
  dismissReason?: string
): Promise<boolean> {
  if (!supabase) return false;
  const update: Record<string, unknown> = {
    status,
    actioned_at: new Date().toISOString(),
  };
  if (dismissReason) update.dismiss_reason = dismissReason;

  const { error } = await supabase
    .from('content_suggestions')
    .update(update)
    .eq('id', id);
  return !error;
}

// ─── Suggestion → Knowledge Chunk Pipeline ─────────────────────

const SUGGESTION_TYPE_TO_CONTENT_TYPE: Record<string, string> = {
  new_resource: 'definition',
  new_faq: 'definition',
  content_correction: 'requirement',
  content_expansion: 'definition',
  content_gap: 'definition',
};

/**
 * Creates knowledge chunks from an accepted suggestion's draft content,
 * so Nera can use the new knowledge immediately.
 */
export async function createChunksFromSuggestion(
  suggestion: ContentSuggestion
): Promise<{ created: number; error?: string }> {
  if (!supabase) return { created: 0, error: 'Supabase not configured' };
  if (!suggestion.draft_content) return { created: 0, error: 'No draft content' };

  const record = {
    source_tab_id: null,
    document_source: `Content Suggestion: ${suggestion.title}`,
    section_reference: suggestion.title,
    chunk_text: suggestion.draft_content,
    chunk_summary: suggestion.description,
    topic_tags: suggestion.related_tabs.length > 0
      ? suggestion.related_tabs
      : [suggestion.suggestion_type],
    content_type: SUGGESTION_TYPE_TO_CONTENT_TYPE[suggestion.suggestion_type] ?? null,
    pathway: null,
    classification: null,
    mm_category: null,
    employment_status: null,
    training_term: null,
    metadata: {
      source_suggestion_id: suggestion.id,
      source_insight_id: suggestion.insight_id,
      suggestion_type: suggestion.suggestion_type,
      priority_score: suggestion.priority_score,
    },
    is_active: true,
    extraction_version: 'suggestion-v1',
  };

  const { error } = await supabase
    .from('knowledge_chunks')
    .insert([record]);

  if (error) {
    console.error('Failed to create chunk from suggestion:', error);
    return { created: 0, error: error.message };
  }

  return { created: 1 };
}
