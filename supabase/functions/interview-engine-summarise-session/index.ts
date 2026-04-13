import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";
import {
  fetchConversationHistory,
  formatMessagesForLLM,
} from "../_shared/interview-engine-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");
  if (token === SUPABASE_SERVICE_ROLE_KEY) return "service-role";
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("malformed");
    const payload = JSON.parse(atob(parts[1]));
    if (payload.role === "service_role") return "service-role";
    if (!payload.sub) throw new Error("no sub");
    return payload.sub;
  } catch {
    throw new Error("Invalid bearer token");
  }
}

const SUMMARISE_PROMPT = `Summarise this conversation concisely. Capture:
1. The key topics discussed
2. Any decisions or commitments made
3. Important facts or data points revealed
4. The participant's general state and engagement level

Also extract key entities mentioned (people, organisations, events, dates, commitments).

Return a JSON object:
{
  "summary": "2-4 sentence summary",
  "entities": [
    { "type": "person|event|organisation|preference|commitment", "value": "the entity name or description" }
  ],
  "key_data_points": ["list of specific facts or figures mentioned"]
}

Return ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const _userId = await requireAuth(req);
    const { conversation_id } = await req.json();

    if (!conversation_id) {
      return jsonResponse({ error: "conversation_id is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch conversation record
    const { data: conversation, error: convErr } = await supabase
      .from("ie_conversations")
      .select("user_id, product_id, engagement_id")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conversation) {
      return jsonResponse({ error: "Conversation not found" }, 404);
    }

    // 2. Fetch all messages
    const messages = await fetchConversationHistory(
      supabase,
      conversation_id,
      200
    );

    if (messages.length === 0) {
      return jsonResponse({ error: "No messages to summarise" }, 400);
    }

    // 3. Build summarisation input
    const formattedHistory = formatMessagesForLLM(messages);
    const conversationText = formattedHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    // 4. Call LLM
    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    const result = await callLLM(
      llmConfig,
      SUMMARISE_PROMPT,
      [{ role: "user", content: conversationText }],
      2000
    );

    // 5. Parse response
    let summary = "";
    let entities: Array<{ type: string; value: string }> = [];
    let keyDataPoints: string[] = [];

    try {
      const trimmed = result.trim();
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;
      const parsed = JSON.parse(jsonStr);

      summary = parsed.summary ?? result.trim();
      entities = Array.isArray(parsed.entities) ? parsed.entities : [];
      keyDataPoints = Array.isArray(parsed.key_data_points)
        ? parsed.key_data_points
        : [];
    } catch {
      summary = result.trim();
    }

    // 6. Update conversation with summary and mark completed
    await supabase
      .from("ie_conversations")
      .update({
        summary,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", conversation_id);

    // 7. Upsert entity memory
    for (const entity of entities) {
      if (!entity.type || !entity.value) continue;

      // Try to find existing entity
      const { data: existing } = await supabase
        .from("ie_entity_memory")
        .select("id, mention_count")
        .eq("user_id", conversation.user_id)
        .eq("product_id", conversation.product_id)
        .eq("entity_type", entity.type)
        .eq("entity_value", entity.value)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ie_entity_memory")
          .update({
            mention_count: (existing.mention_count ?? 0) + 1,
            last_mentioned_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("ie_entity_memory").insert({
          user_id: conversation.user_id,
          product_id: conversation.product_id,
          entity_type: entity.type,
          entity_value: entity.value,
        });
      }
    }

    return jsonResponse({
      success: true,
      conversation_id,
      summary,
      entities_count: entities.length,
      key_data_points: keyDataPoints,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("interview-engine-summarise-session error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
