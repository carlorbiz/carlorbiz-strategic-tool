import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";
import {
  fetchConversationHistory,
  fetchUserState,
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

const EVALUATION_PROMPT = `You are a conversational capacity evaluator. Analyse the user's recent messages in a conversation to assess their current state.

Evaluate these signals from their responses:
- Response length (shorter = lower capacity)
- Specificity (vague vs detailed)
- Affect markers (enthusiasm, frustration, resignation, warmth)
- Latency patterns (if timestamps suggest slower replies)
- Engagement quality (expanding on topics vs minimal answers)

Return a JSON object:
{
  "capacity_score": 0.0-1.0 (1.0 = fully engaged and energised, 0.0 = disengaged or overwhelmed),
  "sentiment_trend": "improving" | "stable" | "declining",
  "recommended_cadence": "active" | "light" | "weekly" | "dormant",
  "should_end_conversation": true | false,
  "reasoning": "one sentence explaining your assessment"
}

Return ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const _userId = await requireAuth(req);
    const { user_id, product_id, conversation_id } = await req.json();

    if (!user_id || !product_id || !conversation_id) {
      return jsonResponse(
        { error: "user_id, product_id, and conversation_id required" },
        400
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch conversation history (recent messages only)
    const messages = await fetchConversationHistory(
      supabase,
      conversation_id,
      20
    );

    if (messages.length === 0) {
      return jsonResponse({ error: "No messages to evaluate" }, 400);
    }

    // 2. Fetch existing user state
    const userState = await fetchUserState(supabase, user_id, product_id);

    // 3. Build evaluation input
    const userMessages = messages.filter((m) => m.role === "user");
    const formattedHistory = formatMessagesForLLM(messages);

    const evaluationInput = `Current engagement mode: ${userState.engagement_mode}
Previous capacity score: ${userState.capacity_score ?? "none"}
Previous sentiment: ${userState.sentiment_trend ?? "none"}

Recent conversation (${messages.length} messages, ${userMessages.length} from user):
${formattedHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}`;

    // 4. Call LLM
    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    const result = await callLLM(
      llmConfig,
      EVALUATION_PROMPT,
      [{ role: "user", content: evaluationInput }],
      500
    );

    // 5. Parse response
    let evaluation = {
      capacity_score: 0.5,
      sentiment_trend: "stable",
      recommended_cadence: "active",
      should_end_conversation: false,
      reasoning: "",
    };

    try {
      const trimmed = result.trim();
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;
      const parsed = JSON.parse(jsonStr);

      evaluation = {
        capacity_score:
          typeof parsed.capacity_score === "number"
            ? parsed.capacity_score
            : 0.5,
        sentiment_trend: parsed.sentiment_trend ?? "stable",
        recommended_cadence: parsed.recommended_cadence ?? "active",
        should_end_conversation: parsed.should_end_conversation ?? false,
        reasoning: parsed.reasoning ?? "",
      };
    } catch {
      // Keep defaults
    }

    // 6. Upsert user state
    await supabase
      .from("ie_user_state")
      .update({
        engagement_mode: evaluation.recommended_cadence,
        capacity_score: evaluation.capacity_score,
        sentiment_trend: evaluation.sentiment_trend,
        last_state_eval_at: new Date().toISOString(),
      })
      .eq("user_id", user_id)
      .eq("product_id", product_id);

    return jsonResponse({
      success: true,
      ...evaluation,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("interview-engine-evaluate-state error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
