import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-sonnet-4-6";
const MAX_SESSIONS = 50;
const MAX_NERA_QUERIES = 200;

// ─── CORS ─────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Synthesis prompt ──────────────────────────────────────────

const CLIENT_NAME = Deno.env.get("CLIENT_NAME") || "Resource Hub";

const INSIGHTS_SYNTHESIS_PROMPT = `You are a content strategy analyst for a knowledge resources platform (${CLIENT_NAME}). You are analysing aggregated feedback from staff, administrators, and users about the platform's resources.

Your task is to synthesise all feedback sessions and Nera AI assistant query failures into actionable insights for the content administrator, who builds and maintains these resources.

## Analysis Steps

1. **SYNTHESISE THEMES** — Identify the 3-5 dominant themes across all feedback sessions. Write a brief narrative summary (2-3 paragraphs) in plain Australian English.

2. **MAP STRENGTHS** — What content is working well and should be preserved or expanded? Include evidence (which sessions mentioned it, how many).

3. **GAP ANALYSIS** — Cross-reference identified gaps from feedback with topics where the Nera AI assistant failed to answer or received negative feedback. High correlation = high priority gap.

4. **ACCURACY FLAGS** — Any content accuracy concerns raised by experienced practitioners. These are always high priority.

5. **GENERATE SUGGESTIONS** — For each gap, accuracy issue, or improvement opportunity, produce a specific actionable content suggestion.

## Priority Scoring Rules (1-10)

- Multiple feedback sessions mentioning the same gap = higher priority
- Feedback gap PLUS Nera query failures on the same topic = highest priority (corroborated gap, score 9-10)
- Accuracy concerns from practitioners = always priority 8+
- New resource suggestions with clear use-case = 6-8
- Content expansions or nice-to-haves = 3-5

## Output Format

Return ONLY valid JSON with this structure:

{
  "themes_summary": "2-3 paragraph narrative summary of dominant themes",
  "strength_areas": [
    {"area": "string", "evidence": "string", "session_count": number}
  ],
  "gap_analysis": [
    {"topic": "string", "frequency": number, "urgency": "high|medium|low", "source_sessions": ["session_id"], "corroborated_by_nera": boolean}
  ],
  "accuracy_flags": [
    {"content_area": "string", "concern": "string", "severity": "high|medium|low", "source_sessions": ["session_id"]}
  ],
  "nera_gap_correlation": [
    {"feedback_gap": "string", "related_queries_count": number, "sample_queries": ["string"], "avg_feedback_score": number}
  ],
  "unanswered_topics": [
    {"topic": "string", "query_count": number, "sample_queries": ["string"]}
  ],
  "suggestions": [
    {
      "suggestion_type": "new_resource|new_faq|content_correction|content_expansion|content_gap",
      "title": "short actionable title",
      "description": "what to create/fix and why",
      "draft_content": "optional markdown outline or key points",
      "priority_score": number,
      "evidence": {
        "feedback_sessions": ["session_id"],
        "nera_queries": ["query summary"],
        "quotes": ["relevant quote from feedback"]
      },
      "related_tabs": ["existing tab slug if relevant"]
    }
  ]
}`;

// ─── Types ─────────────────────────────────────────────────────

interface FeedbackSession {
  id: string;
  structured_feedback: Record<string, unknown>;
  engagement_level: string | null;
  areas_covered: string[] | null;
  notable_insights: string | null;
  started_at: string;
  completed_at: string | null;
}

interface NeraQueryPattern {
  topic: string;
  query_count: number;
  sample_queries: string[];
  avg_feedback_score: number;
  retrieval_methods: string[];
}

interface TabInfo {
  slug: string;
  label: string;
  folder_id: string | null;
}

// ─── Main handler ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return jsonResponse({ error: "campaign_id is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Step 1: Load completed feedback sessions ──────────────
    const { data: sessions, error: sessionsError } = await supabase
      .from("feedback_sessions")
      .select(
        "id, structured_feedback, engagement_level, areas_covered, notable_insights, started_at, completed_at"
      )
      .eq("campaign_id", campaign_id)
      .eq("status", "completed")
      .not("structured_feedback", "is", null)
      .order("completed_at", { ascending: false })
      .limit(MAX_SESSIONS);

    if (sessionsError) {
      console.error("Failed to load sessions:", sessionsError);
      return jsonResponse({ error: "Failed to load feedback sessions" }, 500);
    }

    const feedbackSessions: FeedbackSession[] = sessions || [];

    if (feedbackSessions.length === 0) {
      return jsonResponse({
        error: "No completed feedback sessions with structured data found",
      }, 404);
    }

    // ── Step 2: Load problematic Nera queries ─────────────────
    const { data: problemQueries } = await supabase
      .from("nera_queries")
      .select(
        "query_text, detected_intent, detected_pathway, feedback_score, retrieval_method"
      )
      .or("retrieval_method.eq.no_results,feedback_score.eq.-1")
      .order("created_at", { ascending: false })
      .limit(MAX_NERA_QUERIES);

    // Group by detected_intent to find patterns
    const intentGroups = new Map<string, typeof problemQueries>();
    (problemQueries || []).forEach(
      (q: {
        detected_intent: string;
        query_text: string;
        feedback_score: number | null;
        retrieval_method: string;
      }) => {
        const key = q.detected_intent || "unknown";
        if (!intentGroups.has(key)) intentGroups.set(key, []);
        intentGroups.get(key)!.push(q);
      }
    );

    const neraPatterns: NeraQueryPattern[] = [];
    intentGroups.forEach((queries, intent) => {
      const scores = queries
        .map(
          (q: { feedback_score: number | null }) => q.feedback_score
        )
        .filter((s: number | null): s is number => s !== null);
      neraPatterns.push({
        topic: intent,
        query_count: queries.length,
        sample_queries: queries
          .slice(0, 3)
          .map((q: { query_text: string }) => q.query_text),
        avg_feedback_score:
          scores.length > 0
            ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
            : 0,
        retrieval_methods: [
          ...new Set(
            queries.map(
              (q: { retrieval_method: string }) => q.retrieval_method
            )
          ),
        ],
      });
    });

    // ── Step 3: Load content inventory ────────────────────────
    const { data: tabsData } = await supabase
      .from("tabs")
      .select("slug, label, folder_id")
      .eq("is_visible", true);

    const tabs: TabInfo[] = (tabsData || []).map(
      (t: { slug: string; label: string; folder_id: string | null }) => ({
        slug: t.slug,
        label: t.label,
        folder_id: t.folder_id,
      })
    );

    // ── Step 4: Build Claude prompt ───────────────────────────
    const feedbackData = feedbackSessions.map((s) => ({
      session_id: s.id,
      feedback: s.structured_feedback,
      engagement: s.engagement_level,
      areas_covered: s.areas_covered,
      notable: s.notable_insights,
    }));

    const userMessage = `## Feedback Sessions (${feedbackSessions.length} completed)

${JSON.stringify(feedbackData, null, 2)}

## Nera AI Query Failures & Negative Feedback (${neraPatterns.length} topic patterns from ${problemQueries?.length || 0} queries)

${JSON.stringify(neraPatterns, null, 2)}

## Current Content Inventory (${tabs.length} tabs)

${tabs.map((t) => `- ${t.slug}: ${t.label}`).join("\n")}

---

Analyse all of the above and generate your structured insights and content suggestions. Focus on actionable recommendations that a solo content owner can prioritise and act on.`;

    // ── Step 5: Call Claude ────────────────────────────────────
    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 8192,
          system: INSIGHTS_SYNTHESIS_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      }
    );

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", errText);
      return jsonResponse({ error: "Failed to generate insights" }, 502);
    }

    const claudeResult = await claudeResponse.json();
    const responseText =
      claudeResult.content?.[0]?.type === "text"
        ? claudeResult.content[0].text
        : "";

    const tokenUsage = {
      input_tokens: claudeResult.usage?.input_tokens || 0,
      output_tokens: claudeResult.usage?.output_tokens || 0,
    };

    // ── Step 6: Parse response ────────────────────────────────
    // Extract JSON from response (may be wrapped in ```json fences)
    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", parseError);
      console.error("Raw response:", responseText.slice(0, 500));
      return jsonResponse(
        { error: "Failed to parse insights from Claude response" },
        500
      );
    }

    // ── Step 7: Write to content_insights ─────────────────────
    const { data: insight, error: insightError } = await supabase
      .from("content_insights")
      .insert({
        campaign_id,
        themes_summary: parsed.themes_summary || "",
        strength_areas: parsed.strength_areas || [],
        gap_analysis: parsed.gap_analysis || [],
        accuracy_flags: parsed.accuracy_flags || [],
        nera_gap_correlation: parsed.nera_gap_correlation || [],
        unanswered_topics: parsed.unanswered_topics || [],
        sessions_analysed: feedbackSessions.length,
        session_ids_included: feedbackSessions.map((s) => s.id),
        nera_queries_analysed: problemQueries?.length || 0,
        generation_model: MODEL,
        token_usage: tokenUsage,
      })
      .select("id")
      .single();

    if (insightError || !insight) {
      console.error("Failed to write insight:", insightError);
      return jsonResponse({ error: "Failed to save insights" }, 500);
    }

    // ── Step 8: Write content_suggestions ─────────────────────
    const suggestions = (parsed.suggestions as Array<Record<string, unknown>>) || [];
    if (suggestions.length > 0) {
      const suggestionRows = suggestions.map((s) => ({
        insight_id: insight.id,
        suggestion_type: s.suggestion_type || "content_gap",
        title: s.title || "Untitled suggestion",
        description: s.description || "",
        draft_content: s.draft_content || null,
        priority_score: Math.min(10, Math.max(1, Number(s.priority_score) || 5)),
        evidence: s.evidence || {},
        related_tabs: s.related_tabs || [],
      }));

      const { error: suggestionsError } = await supabase
        .from("content_suggestions")
        .insert(suggestionRows);

      if (suggestionsError) {
        console.error("Failed to write suggestions:", suggestionsError);
        // Don't fail the whole request — insights are already saved
      }
    }

    // ── Step 9: Update insights_state ─────────────────────────
    await supabase
      .from("insights_state")
      .upsert({
        campaign_id,
        is_stale: false,
        sessions_since_last_insight: 0,
        last_insight_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    // ── Return summary ────────────────────────────────────────
    return jsonResponse({
      insight_id: insight.id,
      sessions_analysed: feedbackSessions.length,
      nera_queries_analysed: problemQueries?.length || 0,
      suggestions_generated: suggestions.length,
      token_usage: tokenUsage,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
