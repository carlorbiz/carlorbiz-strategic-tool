import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";

// ─── Environment ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// ─── CORS ─────────────────────────────────────────────────────
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

// ─── Auth ─────────────────────────────────────────────────────
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
    const userId = payload.sub;
    if (!userId) throw new Error("no sub claim");
    return userId;
  } catch {
    throw new Error("Invalid bearer token");
  }
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuth(req);
    const { stage_id } = await req.json();

    if (!stage_id) {
      return jsonResponse({ error: "stage_id is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch stage
    const { data: stage, error: stageErr } = await supabase
      .from("st_engagement_stages")
      .select("*")
      .eq("id", stage_id)
      .single();

    if (stageErr || !stage) {
      return jsonResponse({ error: "Stage not found" }, 404);
    }

    const engagementId = stage.engagement_id;

    // 2. Fetch engagement
    const { data: engagement } = await supabase
      .from("st_engagements")
      .select("name, client_name")
      .eq("id", engagementId)
      .single();

    // 3. Fetch stakeholder inputs for this stage
    const { data: inputs } = await supabase
      .from("st_stakeholder_inputs")
      .select("conversation_history, extraction_result, is_complete")
      .eq("stage_id", stage_id)
      .eq("is_complete", true);

    // 4. Fetch workshop decisions for this stage
    const { data: decisions } = await supabase
      .from("st_workshop_decisions")
      .select("decision_text, category, context_notes, decided_at")
      .eq("stage_id", stage_id);

    // 5. Fetch knowledge chunks created during this stage's window
    let chunksQuery = supabase
      .from("knowledge_chunks")
      .select("id, chunk_summary, topic_tags, source_type")
      .eq("engagement_id", engagementId)
      .eq("source_app", "strategic-tool")
      .order("created_at", { ascending: false })
      .limit(100);

    if (stage.opens_at) {
      chunksQuery = chunksQuery.gte("created_at", stage.opens_at);
    }
    if (stage.closes_at) {
      chunksQuery = chunksQuery.lte("created_at", stage.closes_at);
    }

    const { data: chunks } = await chunksQuery;

    // 6. Fetch commitments for context
    const { data: commitments } = await supabase
      .from("st_commitments")
      .select("title, kind, description")
      .eq("engagement_id", engagementId)
      .eq("status", "active")
      .order("order_index");

    // 7. Fetch AI config
    const { data: aiConfig } = await supabase
      .from("st_ai_config")
      .select("vocabulary_map")
      .eq("engagement_id", engagementId)
      .maybeSingle();

    const vocab = aiConfig?.vocabulary_map ?? {};

    // 8. Build synthesis input
    const synthesisInput = `## Stage: "${stage.title}" (${stage.stage_type})
Engagement: ${engagement?.name ?? "(unknown)"} — ${engagement?.client_name ?? "(no client)"}
${stage.description ? `Description: ${stage.description}` : ""}

## Stakeholder Inputs (${inputs?.length ?? 0} completed)
${
  inputs && inputs.length > 0
    ? inputs
        .map((inp, i) => {
          const extraction =
            typeof inp.extraction_result === "string"
              ? inp.extraction_result
              : JSON.stringify(inp.extraction_result, null, 2);
          return `### Input ${i + 1}
${extraction?.slice(0, 1500) ?? "(no extraction)"}`;
        })
        .join("\n\n")
    : "No stakeholder inputs."
}

## Workshop Decisions (${decisions?.length ?? 0})
${
  decisions && decisions.length > 0
    ? decisions
        .map(
          (d) =>
            `- [${d.category ?? "general"}] ${d.decision_text}${d.context_notes ? ` (context: ${d.context_notes})` : ""}`
        )
        .join("\n")
    : "No workshop decisions."
}

## Evidence Chunks (${chunks?.length ?? 0})
${
  chunks
    ?.slice(0, 50)
    .map(
      (c) =>
        `- [${c.source_type}] ${c.chunk_summary ?? "(no summary)"} (tags: ${c.topic_tags?.join(", ") ?? "none"})`
    )
    .join("\n") ?? "No chunks."
}

## Current ${vocab.commitment_top_plural ?? "Commitments"} (${commitments?.length ?? 0})
${
  commitments
    ?.map((c) => `- ${c.title} (${c.kind}): ${c.description ?? "(no description)"}`)
    .join("\n") ?? "None."
}`;

    // 9. LLM synthesis
    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    const systemPrompt = `You are Nera, synthesising the outputs of a completed engagement stage. Analyse all stakeholder inputs, workshop decisions, and evidence to produce structured insights for the next stage.

Return a JSON object with:
- "themes": array of { "title": string, "description": string, "strength": "strong"|"moderate"|"emerging" }
- "tensions": array of { "description": string, "between": [string, string] } — contradictions or trade-offs
- "emerging_commitments": array of { "title": string, "kind": "top"|"sub"|"cross_cut", "rationale": string } — potential new commitments suggested by the evidence
- "recommendations": array of { "action": string, "rationale": string, "priority": "high"|"medium"|"low" }
- "narrative": a 3-5 sentence overall summary of what this stage revealed

Return ONLY the JSON object.`;

    const llmResult = await callLLM(
      llmConfig,
      systemPrompt,
      [{ role: "user", content: synthesisInput }],
      4000
    );

    // 10. Parse result
    let themes: unknown[] = [];
    let tensions: unknown[] = [];
    let emergingCommitments: unknown[] = [];
    let recommendations: unknown[] = [];
    let narrative = "";

    try {
      const trimmed = llmResult.trim();
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;
      const parsed = JSON.parse(jsonStr);

      themes = Array.isArray(parsed.themes) ? parsed.themes : [];
      tensions = Array.isArray(parsed.tensions) ? parsed.tensions : [];
      emergingCommitments = Array.isArray(parsed.emerging_commitments)
        ? parsed.emerging_commitments
        : [];
      recommendations = Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [];
      narrative = parsed.narrative ?? "";
    } catch {
      narrative = llmResult.trim();
    }

    // 11. Write to st_stage_insights
    const { data: insight, error: insightErr } = await supabase
      .from("st_stage_insights")
      .insert({
        stage_id,
        engagement_id: engagementId,
        themes,
        tensions,
        emerging_commitments: emergingCommitments,
        recommendations,
        narrative,
      })
      .select("id")
      .single();

    if (insightErr) {
      return jsonResponse(
        { error: `Failed to save stage insights: ${insightErr.message}` },
        500
      );
    }

    // 12. Close the stage
    await supabase
      .from("st_engagement_stages")
      .update({ status: "closed" })
      .eq("id", stage_id);

    return jsonResponse({
      success: true,
      insight_id: insight.id,
      themes_count: themes.length,
      tensions_count: tensions.length,
      emerging_commitments_count: emergingCommitments.length,
      recommendations_count: recommendations.length,
      narrative,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("st-synthesise-stage error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
