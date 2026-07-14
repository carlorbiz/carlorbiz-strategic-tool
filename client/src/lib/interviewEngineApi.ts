import { supabase } from '@/lib/supabase';
import type {
  IeConversation,
  IeMessage,
  IePromptCoverage,
  ExtractionField,
  ExtractionResult,
} from '@/types/interview-engine';

// ─── Interview Engine Client API ─────────────────────────────────────────────
// Wraps the 4 interview-engine-* edge functions + direct Supabase queries
// for the shared Conversational Interview Engine.

const PRODUCT_ID = 'strategic-tool';

async function callEngineFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<unknown> {
  if (!supabase) throw new Error('Supabase not configured');

  const neraApiBase = import.meta.env.VITE_SUPABASE_URL;
  if (!neraApiBase) throw new Error('VITE_SUPABASE_URL not set');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const resp = await fetch(`${neraApiBase}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${functionName} failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

// ── Start a new conversation ─────────────────────────────────────────────────
// ie_conversations.user_id is a FK to user_profiles(id) — NOT auth.users(id).
// We have to resolve the user_profile row before inserting, otherwise the FK
// fails. The RLS policy (migration 0007) uses current_user_profile_id() to
// gate access, so the value we insert must equal that helper's result.

async function currentUserProfileId(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (error || !profile) {
    throw new Error('Your user_profiles row is missing — contact the engagement admin');
  }
  return profile.id as string;
}

export async function startConversation(
  goal: string,
  engagementId?: string,
  metadata?: Record<string, unknown>,
  productId: string = PRODUCT_ID
): Promise<IeConversation> {
  if (!supabase) throw new Error('Supabase not configured');

  const profileId = await currentUserProfileId();

  const { data, error } = await supabase
    .from('ie_conversations')
    .insert({
      user_id: profileId,
      product_id: productId,
      engagement_id: engagementId ?? null,
      goal,
      cadence_mode: 'single',
      status: 'active',
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as IeConversation;
}

// ── Find the caller's resumable (in-progress) conversation ───────────────────
// A returning respondent (fresh page load via the 96h reusable access link)
// must pick up where they left off instead of starting a blank conversation.
// Returns the caller's MOST RECENT still-in-progress conversation for this
// engagement + product, or null if there is none. "In progress" = status
// 'active' AND completed_at IS NULL (a summarised/closed session is neither).

export async function findResumableConversation(
  engagementId?: string,
  productId: string = PRODUCT_ID
): Promise<IeConversation | null> {
  if (!supabase) return null;

  const profileId = await currentUserProfileId();

  let query = supabase
    .from('ie_conversations')
    .select('*')
    .eq('user_id', profileId)
    .eq('product_id', productId)
    .eq('status', 'active')
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  // Scope to the exact engagement so a respondent in two engagements never
  // resumes the wrong one. Mirror startConversation's null handling.
  query = engagementId
    ? query.eq('engagement_id', engagementId)
    : query.is('engagement_id', null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as IeConversation) ?? null;
}

// ── Resume the in-progress conversation, or start a fresh one ─────────────────
// The single entry point the surface should use: RESUME an existing
// in-progress conversation if one exists (returns resumed: true), otherwise
// fall through to startConversation for a first-time respondent (resumed:
// false). No new row is inserted on the resume path.

export async function getOrStartConversation(
  goal: string,
  engagementId?: string,
  metadata?: Record<string, unknown>,
  productId: string = PRODUCT_ID
): Promise<{ conversation: IeConversation; resumed: boolean }> {
  const existing = await findResumableConversation(engagementId, productId);
  if (existing) return { conversation: existing, resumed: true };

  const conversation = await startConversation(goal, engagementId, metadata, productId);
  return { conversation, resumed: false };
}

// ── Fetch a conversation's coverage rows (direct Supabase query) ─────────────
// Used to rehydrate the "covered dimensions" set on resume so select-prompt's
// gap logic and the completion gate agree with the persisted state.

export async function fetchConversationCoverage(
  conversationId: string
): Promise<IePromptCoverage[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('ie_prompt_coverage')
    .select('*')
    .eq('conversation_id', conversationId);

  if (error) throw error;
  return (data ?? []) as IePromptCoverage[];
}

// ── Select the next prompt ───────────────────────────────────────────────────

export async function selectPrompt(
  conversationId: string,
  userId: string,
  engagementId?: string,
  productId: string = PRODUCT_ID
): Promise<{
  prompt_id: string;
  prompt_text: string;
  elicits_dimensions: string[];
  rationale: string;
}> {
  const result = await callEngineFunction('interview-engine-select-prompt', {
    user_id: userId,
    product_id: productId,
    conversation_id: conversationId,
    engagement_id: engagementId,
  });
  return result as {
    prompt_id: string;
    prompt_text: string;
    elicits_dimensions: string[];
    rationale: string;
  };
}

// ── Send a message and extract structured data ───────────────────────────────

export async function sendMessage(
  conversationId: string,
  content: string,
  extractionSchema?: ExtractionField[],
  context?: string
): Promise<ExtractionResult & { conversation_id: string }> {
  const result = await callEngineFunction('interview-engine-extract', {
    conversation_id: conversationId,
    message_content: content,
    extraction_schema: extractionSchema,
    context,
  });
  return result as ExtractionResult & { conversation_id: string };
}

// ── Evaluate user state ──────────────────────────────────────────────────────

export async function evaluateState(
  conversationId: string,
  userId: string
): Promise<{
  capacity_score: number;
  sentiment_trend: string;
  recommended_cadence: string;
  should_end_conversation: boolean;
  reasoning: string;
}> {
  const result = await callEngineFunction('interview-engine-evaluate-state', {
    user_id: userId,
    product_id: PRODUCT_ID,
    conversation_id: conversationId,
  });
  return result as {
    capacity_score: number;
    sentiment_trend: string;
    recommended_cadence: string;
    should_end_conversation: boolean;
    reasoning: string;
  };
}

// ── Summarise and close a session ────────────────────────────────────────────

export async function summariseSession(
  conversationId: string
): Promise<{
  summary: string;
  entities_count: number;
  key_data_points: string[];
}> {
  const result = await callEngineFunction('interview-engine-summarise-session', {
    conversation_id: conversationId,
  });
  return result as {
    summary: string;
    entities_count: number;
    key_data_points: string[];
  };
}

// ── Fetch a conversation with messages (direct Supabase query) ───────────────

export async function fetchConversation(
  conversationId: string
): Promise<{ conversation: IeConversation; messages: IeMessage[] }> {
  if (!supabase) throw new Error('Supabase not configured');

  const [convResult, msgResult] = await Promise.all([
    supabase
      .from('ie_conversations')
      .select('*')
      .eq('id', conversationId)
      .single(),
    supabase
      .from('ie_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ]);

  if (convResult.error) throw convResult.error;
  if (msgResult.error) throw msgResult.error;

  return {
    conversation: convResult.data as IeConversation,
    messages: (msgResult.data ?? []) as IeMessage[],
  };
}

// ── List conversations for an engagement ─────────────────────────────────────

export async function fetchConversations(
  engagementId: string,
  goal?: string
): Promise<IeConversation[]> {
  if (!supabase) return [];

  let query = supabase
    .from('ie_conversations')
    .select('*')
    .eq('product_id', PRODUCT_ID)
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false });

  if (goal) {
    query = query.eq('goal', goal);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as IeConversation[];
}
