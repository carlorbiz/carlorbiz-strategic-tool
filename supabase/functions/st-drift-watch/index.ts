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

// ─── Default drift analysis prompt (fallback if not configured) ──
const DEFAULT_DRIFT_PROMPT = `You are Nera, a strategic governance analyst. Analyse the evidence corpus for the engagement and produce a structured drift report.

For each commitment, assess:
1. Mention frequency — is it appearing in recent documents and survey evidence?
2. Scope extensions — has the definition been stretching?
3. Update recency — when was the last initiative update?
4. Cross-cutting tensions — do any themes reveal contradictions across commitments?

Produce a JSON object with:
- "signals": array of { "type": string (silence|imbalance|scope_creep|staleness|tension|emerging_theme), "commitment_title": string, "severity": "info"|"warning"|"critical", "message": string }
- "merge_suggestions": array of { "commitment_a": string, "commitment_b": string, "similarity": number, "message": string } (only if warranted)
- "narrative": a 2-4 sentence overall summary

Return ONLY the JSON object.`;

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const _userId = await requireAuth(req);
    const { engagement_id } = await req.json();

    if (!engagement_id) {
      return jsonResponse({ error: "engagement_id is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch engagement
    const { data: engagement, error: engErr } = await supabase
      .from("st_engagements")
      .select("*")
      .eq("id", engagement_id)
      .single();

    if (engErr || !engagement) {
      return jsonResponse({ error: "Engagement not found" }, 404);
    }

    // 2. Fetch AI config for drift-watch config and prompts
    const { data: aiConfig } = await supabase
      .from("st_ai_config")
      .select("*")
      .eq("engagement_id", engagement_id)
      .maybeSingle();

    const driftConfig = aiConfig?.drift_watch_config ?? {
      silence_window_days: 60,
      scope_extension_trigger_count: 5,
    };
    const windowDays = driftConfig.silence_window_days ?? 60;

    // 3. Fetch active commitments
    const { data: commitments } = await supabase
      .from("st_commitments")
      .select("id, title, description, kind, status, parent_id")
      .eq("engagement_id", engagement_id)
      .eq("status", "active");

    if (!commitments || commitments.length === 0) {
      return jsonResponse({ error: "No active commitments" }, 400);
    }

    // 4. Determine analysis window
    const windowEnd = new Date();
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    // 5. Per-commitment analysis
    const commitmentAnalysis: Array<{
      title: string;
      kind: string;
      chunk_count: number;
      scope_extension_count: number;
      latest_update: string | null;
      update_status: string | null;
    }> = [];

    for (const commitment of commitments) {
      // Count knowledge chunks mentioning this commitment in the window
      const { count: chunkCount } = await supabase
        .from("knowledge_chunks")
        .select("*", { count: "exact", head: true })
        .eq("engagement_id", engagement_id)
        .eq("source_app", "strategic-tool")
        .gte("created_at", windowStart.toISOString());

      // Count scope extensions in window
      const { count: scopeCount } = await supabase
        .from("st_scope_extensions")
        .select("*", { count: "exact", head: true })
        .eq("commitment_id", commitment.id)
        .gte("created_at", windowStart.toISOString());

      // Most recent initiative update
      const { data: latestUpdate } = await supabase
        .from("st_initiative_updates")
        .select("rag_status, created_at")
        .eq("commitment_id", commitment.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      commitmentAnalysis.push({
        title: commitment.title,
        kind: commitment.kind,
        chunk_count: chunkCount ?? 0,
        scope_extension_count: scopeCount ?? 0,
        latest_update: latestUpdate?.created_at ?? null,
        update_status: latestUpdate?.rag_status ?? null,
      });
    }

    // 6. Fetch recent knowledge chunks for context (summaries only, to stay within limits)
    const { data: recentChunks } = await supabase
      .from("knowledge_chunks")
      .select("chunk_summary, topic_tags, source_type, document_source")
      .eq("engagement_id", engagement_id)
      .eq("source_app", "strategic-tool")
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    // 7. Build LLM input
    const analysisInput = `Engagement: "${engagement.name}" (${engagement.client_name ?? "no client name"})
Analysis window: ${windowStart.toISOString().slice(0, 10)} to ${windowEnd.toISOString().slice(0, 10)} (${windowDays} days)

Commitments and their signals:
${commitmentAnalysis
  .map(
    (c) =>
      `- ${c.title} (${c.kind}): ${c.chunk_count} evidence chunks, ${c.scope_extension_count} scope extensions, latest update: ${c.latest_update ? new Date(c.latest_update).toLocaleDateString("en-AU") + " (" + c.update_status + ")" : "none"}`
  )
  .join("\n")}

Recent evidence summaries (${recentChunks?.length ?? 0} chunks):
${
  recentChunks
    ?.slice(0, 50)
    .map(
      (c) =>
        `- [${c.source_type}/${c.document_source ?? "unknown"}] ${c.chunk_summary ?? "(no summary)"}`
    )
    .join("\n") ?? "No recent chunks."
}`;

    // 8. LLM synthesis
    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    const driftPrompt =
      aiConfig?.system_prompt_drift_watch ?? DEFAULT_DRIFT_PROMPT;

    const llmResult = await callLLM(
      llmConfig,
      driftPrompt.replace("{window_days}", String(windowDays))
        .replace("{client_name}", engagement.client_name ?? "")
        .replace("{engagement_name}", engagement.name ?? ""),
      [{ role: "user", content: analysisInput }],
      4000
    );

    // 9. Parse LLM response
    let signals: unknown[] = [];
    let mergeSuggestions: unknown[] = [];
    let narrative = "";

    try {
      const trimmed = llmResult.trim();
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;
      const parsed = JSON.parse(jsonStr);

      signals = Array.isArray(parsed.signals) ? parsed.signals : [];
      mergeSuggestions = Array.isArray(parsed.merge_suggestions)
        ? parsed.merge_suggestions
        : [];
      narrative = parsed.narrative ?? "";
    } catch {
      // If JSON parse fails, use the raw text as narrative
      narrative = llmResult.trim();
    }

    // 10. Write to st_drift_reports
    const { data: report, error: reportErr } = await supabase
      .from("st_drift_reports")
      .insert({
        engagement_id,
        report_window_start: windowStart.toISOString(),
        report_window_end: windowEnd.toISOString(),
        narrative,
        signals,
        merge_suggestions: mergeSuggestions,
      })
      .select("id")
      .single();

    if (reportErr) {
      return jsonResponse(
        { error: `Failed to save drift report: ${reportErr.message}` },
        500
      );
    }

    return jsonResponse({
      success: true,
      report_id: report.id,
      signals_count: signals.length,
      merge_suggestions_count: mergeSuggestions.length,
      narrative,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("st-drift-watch error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
