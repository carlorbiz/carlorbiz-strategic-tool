import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_OUTPUT_TOKENS = 16000;

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

async function requireInternalAdmin(req: Request): Promise<{ userId: string }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { userId: "service-role" };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);
  if (authError || !authData?.user) throw new Error("Invalid bearer token");

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .single();
  if (profileError || !profile) throw new Error("User profile not found");
  if (profile.role !== "internal_admin")
    throw new Error("Insufficient permissions");

  return { userId: authData.user.id };
}

// ─── Main handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    await requireInternalAdmin(req);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Regenerating content insights...");

    // 1. Gather recent nera queries (non-test, last 90 days)
    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: queries, error: queryError } = await supabase
      .from("nera_queries")
      .select(
        "query_text, response_text, detected_intent, feedback_score, sources_cited, created_at"
      )
      .eq("test_mode", false)
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200);

    if (queryError) {
      console.error("Error fetching queries:", queryError);
    }

    // 2. Gather feedback sessions (last 90 days)
    const { data: sessions, error: sessionError } = await supabase
      .from("feedback_sessions")
      .select("transcript, structured_feedback, notable_insights, created_at")
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50);

    if (sessionError) {
      console.error("Error fetching sessions:", sessionError);
    }

    // 3. Gather knowledge chunk source summary
    const { data: chunkSources, error: chunkError } = await supabase
      .from("knowledge_chunks")
      .select("document_source, topic_tags, content_type, source_type")
      .eq("is_active", true);

    if (chunkError) {
      console.error("Error fetching chunk sources:", chunkError);
    }

    // Build source summary
    const sourceMap = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    (chunkSources || []).forEach((c) => {
      sourceMap.set(
        c.document_source,
        (sourceMap.get(c.document_source) || 0) + 1
      );
      (c.topic_tags || []).forEach((tag: string) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const sourceSummary = Array.from(sourceMap.entries())
      .map(([source, count]) => `${source}: ${count} chunks`)
      .join("\n");

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag, count]) => `${tag} (${count})`)
      .join(", ");

    // 4. Build query summary for Claude
    const querySummary = (queries || [])
      .slice(0, 100)
      .map(
        (q) =>
          `Intent: ${q.detected_intent || "unknown"} | Feedback: ${q.feedback_score ?? "none"} | Q: ${q.query_text?.slice(0, 150)}`
      )
      .join("\n");

    const negativeFeedback = (queries || [])
      .filter((q) => q.feedback_score !== null && q.feedback_score < 0)
      .map(
        (q) =>
          `Q: ${q.query_text}\nA: ${q.response_text?.slice(0, 300)}\nSources: ${(q.sources_cited || []).join(", ")}`
      )
      .join("\n---\n");

    const sessionSummary = (sessions || [])
      .map((s) => {
        const feedback = s.structured_feedback
          ? JSON.stringify(s.structured_feedback).slice(0, 500)
          : "none";
        const insights = s.notable_insights || "none";
        return `Feedback: ${feedback}\nInsights: ${insights}`;
      })
      .join("\n---\n");

    // 5. Call Claude for analysis
    const analysisPrompt = `Analyse the following data from a knowledge resource platform and generate a structured content health report.

## Knowledge Base Sources
${sourceSummary}

## Top Topic Tags
${topTags}

## Recent Queries (last 90 days, ${(queries || []).length} total)
${querySummary || "No queries found."}

## Negative Feedback Queries
${negativeFeedback || "No negative feedback."}

## Feedback Sessions (${(sessions || []).length} sessions)
${sessionSummary || "No feedback sessions found."}

Generate a JSON object with exactly these fields:

{
  "accuracy_flags": [
    {"flag": "description of issue", "severity": "high|medium|low", "sources": ["source names"], "description": "detail"}
  ],
  "themes_summary": "2-3 paragraph summary of major themes from queries and feedback",
  "strength_areas": ["areas where the knowledge base is strong"],
  "gap_analysis": ["areas where coverage is weak or missing"],
  "unanswered_topics": [
    {"topic": "topic name", "gap_score": 0.0-1.0, "example_queries": ["query examples"]}
  ],
  "nera_gap_correlation": {
    "feedback_topics_in_queries_pct": 0.0,
    "top_overlapping_themes": ["themes appearing in both feedback and queries"]
  },
  "content_suggestions": [
    {"suggestion_type": "new_content|update_existing|remove_outdated", "title": "short title", "description": "what and why", "evidence": ["supporting data points"], "priority_score": 0.0-10.0}
  ]
}

Rules:
1. Be specific — cite actual document names and topic areas from the data
2. accuracy_flags should only flag genuine inconsistencies or errors, not minor wording differences
3. gap_analysis should focus on topics users actually asked about but got weak answers
4. priority_score: 10 = urgent, 1 = nice to have
5. Use Australian English spelling
6. Return ONLY the JSON object. No markdown fences.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: "user", content: analysisPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Claude API error ${response.status}: ${errText.slice(0, 300)}`
      );
    }

    const data = await response.json();
    const resultText = data.content
      .filter((block: { type: string }) => block.type === "text")
      .map((block: { text: string }) => block.text)
      .join("");

    // Parse the analysis
    const cleaned = resultText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const analysis = JSON.parse(cleaned);

    // 6. Write to content_insights
    const { data: insight, error: insightError } = await supabase
      .from("content_insights")
      .insert({
        accuracy_flags: analysis.accuracy_flags || [],
        themes_summary: analysis.themes_summary || "",
        strength_areas: analysis.strength_areas || [],
        gap_analysis: analysis.gap_analysis || [],
        unanswered_topics: analysis.unanswered_topics || [],
        nera_gap_correlation: analysis.nera_gap_correlation || {},
        sessions_analysed: (sessions || []).length,
        queries_analysed: (queries || []).length,
        generated_by: "regenerate-insights",
      })
      .select("id")
      .single();

    if (insightError) {
      console.error("Error saving insight:", insightError);
      throw new Error(`Failed to save insight: ${insightError.message}`);
    }

    // 7. Write content suggestions
    const suggestions = analysis.content_suggestions || [];
    if (suggestions.length > 0 && insight) {
      const suggestionRows = suggestions.map(
        (s: {
          suggestion_type: string;
          title: string;
          description: string;
          evidence: string[];
          priority_score: number;
        }) => ({
          suggestion_type: s.suggestion_type,
          title: s.title,
          description: s.description,
          evidence: s.evidence || [],
          priority_score: s.priority_score ?? 5.0,
          status: "pending",
          insight_id: insight.id,
        })
      );

      await supabase.from("content_suggestions").insert(suggestionRows);
    }

    // 8. Update insights state
    await supabase
      .from("insights_state")
      .update({
        is_stale: false,
        last_generated: new Date().toISOString(),
        last_trigger: "manual",
        sessions_since_last: 0,
        queries_since_last: 0,
      })
      .eq("id", "default");

    console.log(
      `Insights regenerated: ${analysis.accuracy_flags?.length || 0} flags, ${suggestions.length} suggestions`
    );

    return jsonResponse({
      success: true,
      insight_id: insight?.id,
      accuracy_flags: (analysis.accuracy_flags || []).length,
      suggestions: suggestions.length,
      queries_analysed: (queries || []).length,
      sessions_analysed: (sessions || []).length,
    });
  } catch (error) {
    const message = (error as Error).message || "Unknown error";
    if (
      message === "Missing bearer token" ||
      message === "Invalid bearer token"
    ) {
      return jsonResponse({ error: message }, 401);
    }
    if (
      message === "User profile not found" ||
      message === "Insufficient permissions"
    ) {
      return jsonResponse({ error: message }, 403);
    }
    console.error("regenerate-insights error:", error);
    return jsonResponse({ error: `Analysis failed: ${message}` }, 500);
  }
});
