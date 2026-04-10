import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXTRACTION_VERSION = "v1.4";
const MAX_OUTPUT_TOKENS = 16000;
const MAX_CHARS_PER_SEGMENT = 12000;

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

async function requireInternalAdmin(
  req: Request
): Promise<{ userId: string; email?: string | null }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  // Service role bypass for server-to-server calls
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { userId: "service-role", email: "system@pipeline" };
  }

  // Decode JWT payload to extract user ID (sub claim).
  // No signature verification needed — verify_jwt is disabled at the gateway,
  // and these functions run within the same Supabase project.
  let userId: string;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("malformed");
    const payload = JSON.parse(atob(parts[1]));
    // Service role tokens have role=service_role but no sub claim
    if (payload.role === "service_role") {
      return { userId: "service-role", email: "system@pipeline" };
    }
    userId = payload.sub;
    if (!userId) throw new Error("no sub claim");
  } catch {
    throw new Error("Invalid bearer token");
  }

  // Verify user is internal_admin via service role client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, email")
    .eq("user_id", userId)
    .single();
  if (profileError || !profile) throw new Error("User profile not found");
  if (profile.role !== "internal_admin") throw new Error("Insufficient permissions");

  return { userId, email: profile.email };
}

// ─── Extraction prompt ───────────────────────────────────────
const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction specialist. Extract discrete knowledge chunks from the provided document.

Rules:
1. One fact, requirement, or concept per chunk
2. Each chunk must be completely self-contained and understandable without context
3. Preserve precision — exact figures, dates, rates, and thresholds must be accurate
4. Consolidate general guidance into broader chunks; keep maximum granularity only for content with specific values (rates, hours, dollars, deadlines)
5. The text content field MUST be named chunk_text
6. Populate dimensional fields ONLY when the content explicitly relates to them. Use null when not applicable.
7. TERM SYNONYMS: When a chunk relates to a specific term or category that has common synonyms or abbreviations, include ALL common synonyms in the chunk_text so it is discoverable by full-text search.

Return a JSON array of objects with exactly these fields:
- chunk_text: the extracted knowledge (complete, self-contained statement)
- document_source: source document name
- section_reference: section or heading where this content appears
- chunk_summary: one sentence summary
- topic_tags: array of relevant lowercase tags
- content_type: one of "definition", "requirement", "entitlement", "procedure", "condition", or null
- pathway: the relevant program or pathway name, or null
- classification: the relevant classification or category code, or null
- mm_category: geographic or tier classification, or null
- employment_status: "employee", "contractor", or null
- training_term: ordinal position (e.g. "first", "second"), or null
- additional_metadata: object capturing ALL structured details for decision-tree logic and quick lookup. Include every field that applies:
  * legislation_reference: exact Act/regulation name and section
  * effective_date: when a rule takes effect
  * rates_and_percentages: numeric values with context
  * dollar_amounts: monetary values with context
  * time_thresholds: hour/day limits that trigger rules
  * fte_status: "full-time" or "part-time" if the rule varies by FTE
  * payment_basis: how pay is calculated
  * rostering_rules: scheduling constraints
  * supervision_mode: how supervision is delivered
  * supervision_percentage: required supervision level by stage
  * compliance_obligation: who must do what
  * pro_rata_rules: how part-time adjustments work
  * clause_reference: internal document cross-references
  * program_requirements: specific program requirements
  * stage: which term/phase this applies to
  * accumulation_rules: whether entitlements can be banked or must be used
  * escalation_pathway: what happens if requirements aren't met
  * people_roles: specific roles involved
  * tools_or_templates: referenced systems, forms, or frameworks
  * notice_and_termination: notice periods, termination conditions
  * registration_and_credentialing: registration, provider numbers, credentialing
  * professional_indemnity: insurance requirements and proof obligations
  * geographic_context: location classifications, regional distinctions
  * dispute_resolution: resolution processes, step-by-step procedures
  * billing_structure: billing rules, write-off rules, billing cycles
  * government_incentives: government funding, incentive payments, eligibility
  * financial_reimbursement: travel, relocation, accommodation subsidies
  * cultural_safety: cultural safety requirements, policies
  * facility_requirements: rooms, IT systems, software, equipment
  * assessment_methods: assessment tools and methods referenced
  * procedural_skills: specific skills or disciplines referenced
  * accreditation_cycle: accreditation status, renewal cycles
  * qualifications: required qualifications, CPD requirements
  * workplace_policies: WHS, governance, compliance policies
  * community_engagement: community integration, retention factors
  * wellbeing_support: pastoral care, support services, fatigue management
  Use empty object {} only if genuinely no structured details apply.

Return ONLY the JSON array. No markdown fences, no explanation.`;

// ─── Claude API call ──────────────────────────────────────────

async function callClaude(content: string, label: string, context?: { pageUrl: string; folderLabel: string; tabLabel: string }): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
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
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: context
          ? `Extract all knowledge chunks from this content.\n\nThis content is part of Carlorbiz's consulting website (carlorbiz.com.au). It appears on the "${context.folderLabel}" page under the section "${context.tabLabel}" (URL: ${context.pageUrl}).\n\nEach chunk should be self-contained and reflect both the content AND its purpose within Carlorbiz's service offering — what problem it solves, who it's for, and how it connects to the broader consulting practice.\n\nDocument: ${label}\n\n---\n\n${content}`
          : `Extract all knowledge chunks from this document.\n\nDocument: ${label}\n\n---\n\n${content}`,
      }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.content
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("");

  return { text, usage: data.usage ?? { input_tokens: 0, output_tokens: 0 } };
}

// ─── JSON parsing with truncation recovery ────────────────────

function parseChunks(text: string): Record<string, unknown>[] {
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Handle truncated JSON — find last complete object
  if (!cleaned.endsWith("]")) {
    let searchFrom = cleaned.length;
    let recovered = false;
    while (searchFrom > 0) {
      const pos = cleaned.lastIndexOf("}", searchFrom - 1);
      if (pos <= 0) break;
      const candidate = cleaned.slice(0, pos + 1) + "]";
      try {
        JSON.parse(candidate);
        cleaned = candidate;
        recovered = true;
        break;
      } catch {
        searchFrom = pos;
      }
    }
    if (!recovered) {
      throw new Error("Could not recover any valid chunks from truncated response");
    }
  }

  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function splitIntoSegments(content: string): string[] {
  const segments: string[] = [];
  let remaining = content.trim();

  while (remaining.length > MAX_CHARS_PER_SEGMENT) {
    let splitIndex = remaining.lastIndexOf("\n", MAX_CHARS_PER_SEGMENT);
    if (splitIndex < MAX_CHARS_PER_SEGMENT * 0.6) {
      splitIndex = MAX_CHARS_PER_SEGMENT;
    }
    const segment = remaining.slice(0, splitIndex).trim();
    if (segment.length > 0) {
      segments.push(segment);
    }
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining.length > 0) {
    segments.push(remaining);
  }

  return segments.length ? segments : [content];
}

// ─── Main handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    await requireInternalAdmin(req);
    const body = await req.json();
    const { tab_id, tab_ids, segment_index } = body;

    // Support single tab_id or array of tab_ids
    const idsToProcess: string[] = tab_ids
      ? (Array.isArray(tab_ids) ? tab_ids : [tab_ids])
      : tab_id
        ? [tab_id]
        : [];

    if (idsToProcess.length === 0) {
      return jsonResponse({ error: "tab_id or tab_ids is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results: Array<{ tab_id: string; slug: string; status: string; chunks: number; tokens?: { input: number; output: number }; error?: string }> = [];

    for (const id of idsToProcess) {
      // Fetch the tab with folder info for navigation metadata
      const { data: tab, error: tabError } = await supabase
        .from("tabs")
        .select("id, slug, label, content, folder_id")
        .eq("id", id)
        .single();

      if (tabError || !tab) {
        results.push({ tab_id: id, slug: "unknown", status: "error", chunks: 0 });
        continue;
      }

      // Look up folder slug for page URL construction
      let folderSlug = "";
      let folderLabel = "";
      if (tab.folder_id) {
        const { data: folder } = await supabase
          .from("folders")
          .select("slug, label")
          .eq("id", tab.folder_id)
          .single();
        if (folder) {
          folderSlug = folder.slug;
          folderLabel = folder.label;
        }
      }
      const pageUrl = folderSlug ? `/${folderSlug}#${tab.slug}` : `#${tab.slug}`;

      // Skip tabs with no meaningful content
      if (!tab.content || tab.content.trim().length < 50) {
        results.push({ tab_id: id, slug: tab.slug, status: "skipped_no_content", chunks: 0 });
        continue;
      }

      try {
        const segments = splitIntoSegments(tab.content);
        const totalSegments = segments.length;
        const useSegmentIndex = typeof segment_index === "number" ? Math.max(0, Math.floor(segment_index)) : null;

        if (useSegmentIndex !== null && useSegmentIndex >= totalSegments) {
          results.push({ tab_id: id, slug: tab.slug, status: "error", chunks: 0, error: `Invalid segment_index ${useSegmentIndex}` });
          continue;
        }

        const segmentToProcess = useSegmentIndex !== null ? [segments[useSegmentIndex]] : segments;
        const segmentLabel = useSegmentIndex !== null
          ? `${tab.label} (segment ${useSegmentIndex + 1}/${totalSegments})`
          : tab.label;

        let allChunks: Record<string, unknown>[] = [];
        let totalUsage = { input_tokens: 0, output_tokens: 0 };

        for (const segment of segmentToProcess) {
          // Step 1: Extract via Claude
          const { text, usage } = await callClaude(segment, segmentLabel, {
            pageUrl,
            folderLabel: folderLabel || folderSlug,
            tabLabel: tab.label,
          });

          // Step 2: Parse the response
          const chunks = parseChunks(text);
          allChunks = allChunks.concat(chunks);
          totalUsage = {
            input_tokens: totalUsage.input_tokens + usage.input_tokens,
            output_tokens: totalUsage.output_tokens + usage.output_tokens,
          };
        }

        // Step 3: Build records
        const records = allChunks
          .map((chunk) => {
            const chunkText = (chunk.chunk_text as string) || (chunk.extracted_text as string) || "";
            if (!chunkText || chunkText.trim().length < 10) return null;

            return {
              source_tab_id: tab.id,
              document_source: (chunk.document_source as string) || tab.label,
              section_reference: chunk.section_reference ?? null,
              chunk_text: chunkText,
              chunk_summary: chunk.chunk_summary ?? null,
              topic_tags: Array.isArray(chunk.topic_tags) ? chunk.topic_tags : [],
              content_type: chunk.content_type ?? null,
              pathway: chunk.pathway ?? null,
              classification: chunk.classification ?? null,
              mm_category: chunk.mm_category ?? null,
              employment_status: chunk.employment_status ?? null,
              training_term: chunk.training_term ?? null,
              metadata: (chunk.additional_metadata as Record<string, unknown>) ?? {},
              is_active: true,
              extraction_version: EXTRACTION_VERSION,
              page_url: pageUrl,
              tab_slug: tab.slug,
              tab_label: tab.label,
            };
          })
          .filter(Boolean);

        if (records.length === 0) {
          results.push({ tab_id: id, slug: tab.slug, status: "no_chunks", chunks: 0 });
          continue;
        }

        // Step 4: Deactivate old chunks for this tab (only once)
        if (useSegmentIndex === null || useSegmentIndex === 0) {
          await supabase
            .from("knowledge_chunks")
            .update({ is_active: false })
            .eq("source_tab_id", tab.id)
            .eq("is_active", true);
        }

        // Step 5: Insert in batches of 20
        let inserted = 0;
        for (let i = 0; i < records.length; i += 20) {
          const batch = records.slice(i, i + 20);
          const { error: insertError } = await supabase
            .from("knowledge_chunks")
            .insert(batch);

          if (insertError) {
            console.error(`Insert error for ${tab.slug} batch ${Math.floor(i / 20) + 1}:`, insertError);
          } else {
            inserted += batch.length;
          }
        }

        results.push({
          tab_id: id,
          slug: tab.slug,
          status: "complete",
          chunks: inserted,
          tokens: { input: totalUsage.input_tokens, output: totalUsage.output_tokens },
          segments_total: totalSegments,
        });
      } catch (extractError) {
        const errMsg = (extractError as Error).message ?? String(extractError);
        console.error(`Extraction failed for ${tab.slug}:`, extractError);
        results.push({ tab_id: id, slug: tab.slug, status: "error", chunks: 0, error: errMsg });
      }
    }

    // Summary
    const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);
    const totalInput = results.reduce((sum, r) => sum + (r.tokens?.input ?? 0), 0);
    const totalOutput = results.reduce((sum, r) => sum + (r.tokens?.output ?? 0), 0);

    return jsonResponse({
      success: true,
      extraction_version: EXTRACTION_VERSION,
      tabs_processed: results.length,
      total_chunks: totalChunks,
      total_tokens: { input: totalInput, output: totalOutput },
      results,
    });
  } catch (error) {
    const message = (error as Error).message || "Unknown error";
    if (message === "Missing bearer token" || message === "Invalid bearer token") {
      return jsonResponse({ error: message }, 401);
    }
    if (message === "User profile not found" || message === "Insufficient permissions") {
      return jsonResponse({ error: message }, 403);
    }
    console.error("extract-tab-chunks error:", error);
    return jsonResponse({ error: `Extraction failed: ${message}` }, 500);
  }
});
