import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";
import {
  fetchConversationHistory,
  fetchUserState,
  fetchPromptCoverage,
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

const SELECTION_PROMPT = `You are selecting the next conversational prompt for an indirect elicitation conversation. Given:
- The conversation history so far
- The list of available prompts with their elicited dimensions
- The coverage gaps (dimensions not yet touched or with low confidence)
- The user's current engagement mode and capacity

Select the single best next prompt. Prefer:
1. Prompts that fill the largest coverage gap
2. Prompts appropriate for the user's energy level
3. Prompts that flow naturally from the last exchange (avoid jarring topic changes)
4. Prompts that haven't been used recently in this conversation

Return a JSON object:
{ "prompt_id": "<uuid>", "rationale": "<one sentence explaining why this prompt>" }

Return ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const _userId = await requireAuth(req);
    const { user_id, product_id, conversation_id, goal, engagement_id } =
      await req.json();

    if (!user_id || !product_id || !conversation_id) {
      return jsonResponse(
        { error: "user_id, product_id, and conversation_id are required" },
        400
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch user state
    const userState = await fetchUserState(supabase, user_id, product_id);

    // 2. Fetch coverage for this conversation
    const coverage = await fetchPromptCoverage(
      supabase,
      user_id,
      product_id,
      conversation_id
    );
    const coveredFields = new Set(coverage.map((c) => c.field_name));

    // 3. Fetch active prompts from the library
    const { data: prompts, error: promptErr } = await supabase
      .from("ie_prompt_library")
      .select("*")
      .eq("product_id", product_id)
      .eq("is_active", true);

    if (promptErr || !prompts || prompts.length === 0) {
      return jsonResponse({ error: "No active prompts in library" }, 404);
    }

    // 4. Score prompts by coverage gap overlap
    const scored = prompts.map((p: Record<string, unknown>) => {
      const dims = (p.elicits_dimensions as string[]) ?? [];
      const uncoveredCount = dims.filter((d) => !coveredFields.has(d)).length;
      return { ...p, uncovered_count: uncoveredCount };
    });

    // Sort: most uncovered first
    scored.sort(
      (a: { uncovered_count: number }, b: { uncovered_count: number }) =>
        b.uncovered_count - a.uncovered_count
    );

    // If top candidates have equal coverage gap, use LLM to pick the best
    const topCandidates = scored.slice(0, Math.min(5, scored.length));

    if (topCandidates.length === 1) {
      return jsonResponse({
        prompt_id: topCandidates[0].id,
        prompt_text: topCandidates[0].prompt_text,
        elicits_dimensions: topCandidates[0].elicits_dimensions,
        rationale: "Only candidate with coverage gaps",
      });
    }

    // 5. Use LLM for final selection among top candidates
    const messages = await fetchConversationHistory(
      supabase,
      conversation_id,
      10
    );
    const formattedHistory = formatMessagesForLLM(messages);

    const candidateList = topCandidates
      .map(
        (p: Record<string, unknown>, i: number) =>
          `${i + 1}. [${p.id}] "${(p.prompt_text as string).slice(0, 100)}..." — fills: ${((p.elicits_dimensions as string[]) ?? []).filter((d: string) => !coveredFields.has(d)).join(", ")}`
      )
      .join("\n");

    const selectionInput = `Conversation history:\n${formattedHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nUser engagement mode: ${userState.engagement_mode}\nCapacity: ${userState.capacity_score ?? "unknown"}\n\nCandidate prompts:\n${candidateList}`;

    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    let selectedId: string;
    let rationale: string;

    try {
      const result = await callLLM(
        llmConfig,
        SELECTION_PROMPT,
        [{ role: "user", content: selectionInput }],
        300
      );

      const parsed = JSON.parse(
        result.trim().replace(/```(?:json)?\s*/g, "").replace(/```/g, "")
      );
      selectedId = parsed.prompt_id;
      rationale = parsed.rationale ?? "";
    } catch {
      // Fallback: pick the top-scored candidate
      selectedId = topCandidates[0].id as string;
      rationale = "LLM selection failed — using highest coverage-gap candidate";
    }

    const selected = prompts.find(
      (p: Record<string, unknown>) => p.id === selectedId
    );
    if (!selected) {
      // Fallback to first candidate
      const fallback = topCandidates[0];
      return jsonResponse({
        prompt_id: fallback.id,
        prompt_text: fallback.prompt_text,
        elicits_dimensions: fallback.elicits_dimensions,
        rationale: "Selected prompt not found — using top candidate",
      });
    }

    return jsonResponse({
      prompt_id: selected.id,
      prompt_text: selected.prompt_text,
      elicits_dimensions: selected.elicits_dimensions,
      rationale,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("interview-engine-select-prompt error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
