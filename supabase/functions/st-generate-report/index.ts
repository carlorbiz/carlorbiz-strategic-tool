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

// ─── Template section parser ──────────────────────────────────
// Splits a template_markdown into ordered sections based on ## headings
// and {placeholder} tags so we can generate each section independently.

interface TemplateSection {
  heading: string;
  body: string;           // the template body with placeholders
  placeholders: string[]; // e.g. ['for_each_priority', 'drift_signals_narrative']
}

function parseTemplateSections(templateMarkdown: string): TemplateSection[] {
  const lines = templateMarkdown.split("\n");
  const sections: TemplateSection[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];

  const flush = () => {
    if (currentHeading || currentBody.length > 0) {
      const body = currentBody.join("\n").trim();
      const placeholders = [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      sections.push({ heading: currentHeading, body, placeholders });
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return sections;
}

// ─── Citation types ───────────────────────────────────────────

interface Citation {
  claim: string;
  source_chunk_id: string;
  source_document: string | null;
  source_type: string | null;
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await requireAuth(req);
    const {
      engagement_id,
      template_id,
      title,
      period_start,
      period_end,
    } = await req.json();

    if (!engagement_id || !template_id) {
      return jsonResponse(
        { error: "engagement_id and template_id are required" },
        400
      );
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

    // 2. Fetch template
    const { data: template, error: tplErr } = await supabase
      .from("st_reporting_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (tplErr || !template) {
      return jsonResponse({ error: "Template not found" }, 404);
    }

    // 3. Fetch AI config for vocabulary + report prompt
    const { data: aiConfig } = await supabase
      .from("st_ai_config")
      .select("*")
      .eq("engagement_id", engagement_id)
      .maybeSingle();

    const vocab = aiConfig?.vocabulary_map ?? {};

    // 4. Fetch active commitments with their latest updates
    const { data: commitments } = await supabase
      .from("st_commitments")
      .select("id, title, description, kind, status, parent_id, order_index")
      .eq("engagement_id", engagement_id)
      .eq("status", "active")
      .order("order_index");

    // 5. Fetch initiative updates within the period
    let updatesQuery = supabase
      .from("st_initiative_updates")
      .select("*")
      .eq("engagement_id", engagement_id)
      .order("created_at", { ascending: false });

    if (period_start) {
      updatesQuery = updatesQuery.gte("created_at", period_start);
    }
    if (period_end) {
      updatesQuery = updatesQuery.lte("created_at", period_end + "T23:59:59Z");
    }

    const { data: updates } = await updatesQuery;

    // 6. Fetch relevant knowledge chunks within the period
    let chunksQuery = supabase
      .from("knowledge_chunks")
      .select("id, chunk_text, chunk_summary, topic_tags, source_type, document_source")
      .eq("engagement_id", engagement_id)
      .eq("source_app", "strategic-tool")
      .order("created_at", { ascending: false })
      .limit(200);

    if (period_start) {
      chunksQuery = chunksQuery.gte("created_at", period_start);
    }
    if (period_end) {
      chunksQuery = chunksQuery.lte("created_at", period_end + "T23:59:59Z");
    }

    const { data: chunks } = await chunksQuery;

    // 7. Fetch latest drift report for the engagement
    const { data: latestDrift } = await supabase
      .from("st_drift_reports")
      .select("narrative, signals")
      .eq("engagement_id", engagement_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 8. Fetch surveys processed within the period
    let surveysQuery = supabase
      .from("st_surveys")
      .select("name, period, overall_summary")
      .eq("engagement_id", engagement_id)
      .eq("status", "ingested");

    if (period_start) {
      surveysQuery = surveysQuery.gte("processed_at", period_start);
    }

    const { data: surveys } = await surveysQuery;

    // ── Build per-commitment evidence bundles ────────────────────

    const commitmentBundles = (commitments ?? []).map((c) => {
      const commitmentUpdates = (updates ?? []).filter(
        (u) => u.commitment_id === c.id
      );
      const latestUpdate = commitmentUpdates[0] ?? null;

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        kind: c.kind,
        rag_status: latestUpdate?.rag_status ?? "no updates",
        latest_narrative: latestUpdate?.narrative ?? null,
        update_count: commitmentUpdates.length,
        last_update_date: latestUpdate?.created_at
          ? new Date(latestUpdate.created_at).toLocaleDateString("en-AU")
          : "none",
      };
    });

    const topCommitments = commitmentBundles.filter((c) => c.kind === "top");
    const lenses = commitmentBundles.filter((c) => c.kind === "cross_cut");

    // ── Build the evidence context for the LLM ──────────────────

    const evidenceContext = `## Engagement
Name: ${engagement.name}
Client: ${engagement.client_name ?? "(not set)"}
Reporting period: ${period_start ?? "inception"} to ${period_end ?? "now"}

## ${vocab.commitment_top_plural ?? "Priorities"} (${topCommitments.length})
${topCommitments
  .map(
    (c) =>
      `### ${c.title}
Status: ${c.rag_status}
Last update: ${c.last_update_date}
${c.latest_narrative ? `Latest narrative: ${c.latest_narrative}` : "No recent narrative."}
${c.description ? `Description: ${c.description}` : ""}`
  )
  .join("\n\n")}

## ${vocab.cross_cut_plural ?? "Lenses"} (${lenses.length})
${lenses.map((l) => `- ${l.title}: ${l.description ?? "(no description)"}`).join("\n")}

## Drift Signals
${latestDrift?.narrative ?? "No drift report available."}
${
  Array.isArray(latestDrift?.signals) && latestDrift.signals.length > 0
    ? latestDrift.signals
        .map(
          (s: { type?: string; commitment_title?: string; message?: string }) =>
            `- [${s.type}] ${s.commitment_title ?? ""}: ${s.message ?? ""}`
        )
        .join("\n")
    : ""
}

## Survey Evidence
${
  surveys && surveys.length > 0
    ? surveys
        .map(
          (s) =>
            `### ${s.name} (${s.period ?? "no period"})
${s.overall_summary ?? "(no summary)"}`
        )
        .join("\n\n")
    : "No surveys processed in this period."
}

## Source Documents (${chunks?.length ?? 0} evidence chunks)
${
  chunks
    ?.slice(0, 80)
    .map(
      (c) =>
        `[${c.id}] (${c.source_type}/${c.document_source ?? "unknown"}) ${c.chunk_summary ?? c.chunk_text?.slice(0, 200) ?? "(empty)"}`
    )
    .join("\n") ?? "No evidence chunks."
}`;

    // ── Generate the report section by section ──────────────────

    const sections = parseTemplateSections(template.template_markdown);
    const allCitations: Citation[] = [];
    const generatedSections: string[] = [];

    // Build system prompt from config or default
    const reportPromptTemplate =
      aiConfig?.system_prompt_report ??
      `You are Nera, generating a report for {client_name}'s engagement '{engagement_name}' covering the period {period_start} to {period_end}. Draw evidence exclusively from the knowledge corpus. Every claim must be cited to a specific source using [chunk_id] notation. Follow the template structure exactly. Use the organisation's vocabulary throughout. Flag any sections where insufficient evidence exists — do not fabricate.`;

    const systemPrompt = reportPromptTemplate
      .replace(/\{report_template_name\}/g, template.name)
      .replace(/\{client_name\}/g, engagement.client_name ?? "")
      .replace(/\{engagement_name\}/g, engagement.name ?? "")
      .replace(/\{period_start\}/g, period_start ?? "inception")
      .replace(/\{period_end\}/g, period_end ?? "now");

    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    // Generate all sections in one pass for coherence (sections are short enough)
    const sectionInstructions = sections
      .map(
        (s, i) =>
          `Section ${i + 1}: "${s.heading}"
Template: ${s.body}
Placeholders to fill: ${s.placeholders.join(", ") || "none"}`
      )
      .join("\n\n");

    const generationPrompt = `Generate a complete report using this template structure. For each section, produce the content that fills the template placeholders.

IMPORTANT RULES:
1. Every factual claim MUST include a citation in the form [chunk_id] referencing a specific evidence chunk from the source documents list.
2. If insufficient evidence exists for a section, write: "⚠ Insufficient evidence for this section — [N] chunks available, none directly address [topic]."
3. Do NOT fabricate data, statistics, or claims. Only report what the evidence supports.
4. Use the organisation's vocabulary: "${vocab.commitment_top_singular ?? "Priority"}" not "priority", "${vocab.commitment_sub_singular ?? "Initiative"}" not "initiative".
5. Individual patient information must NEVER appear. This is a governance/strategic tool, not a clinical system.

TEMPLATE SECTIONS:
${sectionInstructions}

EVIDENCE CORPUS:
${evidenceContext}

Generate the complete report now. Output as clean markdown. Use ## for section headings matching the template.`;

    const reportContent = await callLLM(
      llmConfig,
      systemPrompt,
      [{ role: "user", content: generationPrompt }],
      8000
    );

    // ── Extract citations from the generated content ────────────

    const citationMatches = [...reportContent.matchAll(/\[([0-9a-f-]{36})\]/g)];
    const chunkIds = new Set(citationMatches.map((m) => m[1]));
    const chunkMap = new Map(
      (chunks ?? []).map((c) => [c.id, c])
    );

    for (const chunkId of chunkIds) {
      const chunk = chunkMap.get(chunkId);
      if (chunk) {
        // Find the sentence containing this citation
        const citationRegex = new RegExp(
          `[^.]*\\[${chunkId}\\][^.]*\\.?`,
          "g"
        );
        const claimMatch = reportContent.match(citationRegex);
        allCitations.push({
          claim: claimMatch?.[0]?.trim() ?? "(citation context not extracted)",
          source_chunk_id: chunkId,
          source_document: chunk.document_source,
          source_type: chunk.source_type,
        });
      }
    }

    // ── Write to st_compliance_reports ───────────────────────────

    const reportTitle =
      title ??
      `${template.name} — ${period_start ?? "inception"} to ${period_end ?? new Date().toISOString().slice(0, 10)}`;

    const { data: report, error: reportErr } = await supabase
      .from("st_compliance_reports")
      .insert({
        engagement_id,
        template_id,
        title: reportTitle,
        period_start: period_start ?? null,
        period_end: period_end ?? null,
        content_markdown: reportContent,
        citations: allCitations,
        status: "draft",
        created_by: userId === "service-role" ? null : userId,
      })
      .select("id, title, status")
      .single();

    if (reportErr) {
      return jsonResponse(
        { error: `Failed to save report: ${reportErr.message}` },
        500
      );
    }

    return jsonResponse({
      success: true,
      report_id: report.id,
      title: report.title,
      status: report.status,
      citation_count: allCitations.length,
      section_count: sections.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("st-generate-report error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
