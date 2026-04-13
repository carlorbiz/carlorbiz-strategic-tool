import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Shared helpers for the Conversational Interview Engine ──────────────────
// Used by all interview-engine-* edge functions.
// Product-agnostic — product isolation is enforced via product_id in every query.

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  extracted_data: Record<string, unknown> | null;
  confidence_scores: Record<string, number> | null;
  justifications: Record<string, string> | null;
  created_at: string;
}

export interface UserStateRecord {
  id: string;
  user_id: string;
  product_id: string;
  engagement_mode: string;
  capacity_score: number | null;
  sentiment_trend: string | null;
  last_state_eval_at: string | null;
  mode_locked_until: string | null;
  metadata: Record<string, unknown>;
}

export interface CoverageRecord {
  field_name: string;
  last_touched_at: string | null;
  last_confidence: number | null;
  decay_rate_days: number;
}

/**
 * Fetch conversation messages in chronological order.
 */
export async function fetchConversationHistory(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 50
): Promise<MessageRecord[]> {
  const { data, error } = await supabase
    .from("ie_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return (data ?? []) as MessageRecord[];
}

/**
 * Fetch or create user state for a product.
 */
export async function fetchUserState(
  supabase: SupabaseClient,
  userId: string,
  productId: string
): Promise<UserStateRecord> {
  const { data, error } = await supabase
    .from("ie_user_state")
    .select("*")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch user state: ${error.message}`);

  if (data) return data as UserStateRecord;

  // Create default state
  const { data: created, error: createErr } = await supabase
    .from("ie_user_state")
    .insert({
      user_id: userId,
      product_id: productId,
      engagement_mode: "active",
    })
    .select()
    .single();

  if (createErr)
    throw new Error(`Failed to create user state: ${createErr.message}`);
  return created as UserStateRecord;
}

/**
 * Fetch prompt coverage for a user/product, optionally scoped to a conversation.
 */
export async function fetchPromptCoverage(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
  conversationId?: string
): Promise<CoverageRecord[]> {
  let query = supabase
    .from("ie_prompt_coverage")
    .select("field_name, last_touched_at, last_confidence, decay_rate_days")
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (conversationId) {
    query = query.eq("conversation_id", conversationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch coverage: ${error.message}`);
  return (data ?? []) as CoverageRecord[];
}

/**
 * Upsert prompt coverage for a single field.
 */
export async function upsertPromptCoverage(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
  fieldName: string,
  confidence: number,
  conversationId?: string
): Promise<void> {
  const { error } = await supabase.from("ie_prompt_coverage").upsert(
    {
      user_id: userId,
      product_id: productId,
      conversation_id: conversationId ?? null,
      field_name: fieldName,
      last_touched_at: new Date().toISOString(),
      last_confidence: confidence,
    },
    {
      onConflict: "user_id,product_id,field_name,conversation_id",
    }
  );

  if (error)
    throw new Error(`Failed to upsert coverage for ${fieldName}: ${error.message}`);
}

/**
 * Format messages for LLM context (role: content pairs).
 */
export function formatMessagesForLLM(
  messages: MessageRecord[]
): Array<{ role: string; content: string }> {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
}
