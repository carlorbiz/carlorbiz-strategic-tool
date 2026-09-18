import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LLMConfig } from "./llm.ts";

// ─── Shared helpers for the Conversational Interview Engine ──────────────────
// Used by all interview-engine-* edge functions.
// Product-agnostic — product isolation is enforced via product_id in every query.

// ─── Multi-LLM config resolution ─────────────────────────────────────────────
// Mirrors the pattern st-nera-query uses: provider + model are read from the
// engagement's st_ai_config row (env-var-swappable), falling back to a
// per-function default. This is what lets a single DB row flip the interview
// engine from metered Claude to cheap/fast Gemini without a redeploy.

export type LLMProvider = "anthropic" | "google" | "openai";

const LLM_PROVIDERS: LLMProvider[] = ["anthropic", "google", "openai"];

const LLM_API_KEYS: Record<LLMProvider, string> = {
  anthropic: Deno.env.get("ANTHROPIC_API_KEY") || "",
  google: Deno.env.get("GOOGLE_API_KEY") || "",
  openai: Deno.env.get("OPENAI_API_KEY") || "",
};

// Deployment-wide defaults (Supabase secrets). Optional. They sit between the
// engagement's st_ai_config row and each function's own defaults, so a client
// that only holds one provider's key sets LLM_PROVIDER once instead of editing
// every engagement. See .env.example.
const ENV_PROVIDER = (Deno.env.get("LLM_PROVIDER") || "").trim().toLowerCase();
const ENV_MODEL = (Deno.env.get("LLM_MODEL") || "").trim();

// Used only when the resolved provider differs from the function's default
// provider and nothing named a model for it. Same trio st-nera-query has used.
const PROVIDER_DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
};

function isProvider(v: string | null | undefined): v is LLMProvider {
  return v === "anthropic" || v === "google" || v === "openai";
}

/**
 * Resolve provider + model + key from an already-fetched st_ai_config row.
 *
 * Precedence for the provider:
 *   1. row.llm_provider                       — the engagement's operator override
 *   2. LLM_PROVIDER secret                    — the deployment-wide default
 *   3. defaults.provider                      — the function's intended provider
 *   4. any provider that has a key            — only when 1-2 are unset AND the
 *      function's default provider has no key (single-provider deployments)
 *
 * Precedence for the model:
 *   1. row.llm_model
 *   2. LLM_MODEL secret, if LLM_PROVIDER is the resolved provider
 *   3. defaults.model, if the resolved provider is the function's default one
 *   4. PROVIDER_DEFAULT_MODELS[provider]
 *
 * Provider and model resolve independently: a row with llm_provider='google'
 * and llm_model NULL keeps each function on its own model tier when the
 * function already defaults to google, and on the provider default otherwise.
 * An explicit provider (row or secret) whose key is missing is an error; the
 * silent fallback in step 4 only applies when nobody chose.
 */
export function resolveLLMConfigFromRow(
  row: { llm_provider?: string | null; llm_model?: string | null } | null | undefined,
  defaults: { provider: LLMProvider; model: string },
): LLMConfig {
  const rowProvider = isProvider(row?.llm_provider) ? row!.llm_provider as LLMProvider : null;
  const envProvider = isProvider(ENV_PROVIDER) ? ENV_PROVIDER : null;

  let provider: LLMProvider = rowProvider ?? envProvider ?? defaults.provider;
  const explicit = rowProvider !== null || envProvider !== null;

  if (!LLM_API_KEYS[provider]) {
    if (explicit) {
      throw new Error(`No API key configured for LLM provider: ${provider}`);
    }
    const available = LLM_PROVIDERS.find((p) => LLM_API_KEYS[p]);
    if (!available) {
      throw new Error(
        "No LLM API key configured (set ANTHROPIC_API_KEY, GOOGLE_API_KEY or OPENAI_API_KEY)",
      );
    }
    provider = available;
  }

  let model: string;
  if (row?.llm_model) {
    model = row.llm_model;
  } else if (ENV_MODEL && envProvider === provider) {
    model = ENV_MODEL;
  } else if (provider === defaults.provider) {
    model = defaults.model;
  } else {
    model = PROVIDER_DEFAULT_MODELS[provider];
  }

  return { provider, model, apiKey: LLM_API_KEYS[provider] };
}

/**
 * Resolve the LLM provider + model for an engagement-scoped call by reading the
 * engagement's st_ai_config row (if any) and delegating to
 * resolveLLMConfigFromRow(). Pass engagementId = null/undefined (e.g. a
 * product-only call with no engagement) to skip the lookup.
 */
export async function resolveLLMConfig(
  supabase: SupabaseClient,
  engagementId: string | null | undefined,
  defaults: { provider: LLMProvider; model: string },
): Promise<LLMConfig> {
  let row: { llm_provider?: string | null; llm_model?: string | null } | null = null;

  if (engagementId) {
    const { data } = await supabase
      .from("st_ai_config")
      .select("llm_provider, llm_model")
      .eq("engagement_id", engagementId)
      .maybeSingle();
    if (data) row = data as { llm_provider?: string | null; llm_model?: string | null };
  }

  return resolveLLMConfigFromRow(row, defaults);
}

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
