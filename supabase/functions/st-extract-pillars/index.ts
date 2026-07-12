// =============================================================================
// Carlorbiz Strategic Tool — pillar extraction for the Setup Wizard (admin only)
// supabase/functions/st-extract-pillars/index.ts
//
// CC-94, increment 2. Backs Step 3 (Pillars) of the /setup wizard.
//
// Body: { engagement_id, document_id }
//   document_id is the strategic-plan document chosen on Step 2 (the wizard
//   stashes it in st_engagement_setup.pillar_proposals.source_document_id).
//
// Flow:
//   1. Authn (in-function JWT decode) + internal_admin authz.
//   2. Read that document's knowledge_chunks (engagement_id + source_id).
//   3. Assemble a bounded context (~40k chars): chunks whose text mentions
//      priorities/pillars/goals/strategy get first claim on the budget, then
//      the earliest chunks fill the remainder; everything is emitted in
//      document order.
//   4. One callLLM via the engagement's st_ai_config (fall back to the global
//      row, then to anthropic / claude-sonnet-4-5) asking for 3-7 proposed
//      pillars + optional vocabulary suggestions when the plan itself uses
//      distinctive terms.
//   5. Tolerant fenced-JSON parse. On parse failure we return an error and
//      save nothing — pillars are never fabricated.
//   6. Write { source_document_id, proposals, vocabulary_suggestions,
//      extracted_at } to st_engagement_setup.pillar_proposals and return it.
//
// Deploy WITHOUT gateway JWT verification (project convention — tokens are
// validated in-function): supabase functions deploy st-extract-pillars --no-verify-jwt
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const API_KEYS: Record<string, string> = {
  anthropic: Deno.env.get("ANTHROPIC_API_KEY") || "",
  google: Deno.env.get("GOOGLE_API_KEY") || "",
  openai: Deno.env.get("OPENAI_API_KEY") || "",
};

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-sonnet-4-5";

// Context budget for the extraction call. Chunk text beyond this is dropped
// (keyword-matching chunks first, then earliest chunks — see buildContext).
const CONTEXT_CHAR_CAP = 40_000;
// Keyword-matching chunks may take at most this much of the budget so a
// keyword-dense document can't crowd out the plan's opening pages entirely.
const KEYWORD_CHAR_CAP = 30_000;

const KEYWORD_RE = /priorit|pillar|goal|strategi|strategy|objectiv|mission|vision|focus area/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeUid(req: Request): string {
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw new Error("Missing bearer token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid bearer token");
  const payload = JSON.parse(atob(parts[1]));
  if (!payload.sub) throw new Error("Invalid bearer token");
  return payload.sub as string;
}

// ── Context assembly ─────────────────────────────────────────────────────────

interface ChunkRow {
  chunk_text: string | null;
  chunk_summary: string | null;
}

// Pick chunks under the char cap: keyword-matching chunks claim the budget
// first (up to KEYWORD_CHAR_CAP), then the earliest remaining chunks top it
// up. The final context preserves original (document) order.
function buildContext(chunks: ChunkRow[]): string {
  const texts = chunks.map((c) => (c.chunk_text || c.chunk_summary || "").trim());
  const selected = new Set<number>();
  let used = 0;

  // Pass 1: keyword chunks, in document order.
  for (let i = 0; i < texts.length; i++) {
    if (used >= KEYWORD_CHAR_CAP) break;
    if (!texts[i] || !KEYWORD_RE.test(texts[i])) continue;
    selected.add(i);
    used += texts[i].length + 8;
  }

  // Pass 2: earliest chunks fill the remainder.
  for (let i = 0; i < texts.length; i++) {
    if (used >= CONTEXT_CHAR_CAP) break;
    if (selected.has(i) || !texts[i]) continue;
    if (used + texts[i].length > CONTEXT_CHAR_CAP) continue;
    selected.add(i);
    used += texts[i].length + 8;
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((i) => texts[i])
    .join("\n\n---\n\n");
}

// ── Tolerant fenced-JSON parse ───────────────────────────────────────────────

function parseJsonFromLLM(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(trimmed);
  // Last resort: first "{" to last "}"
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const VALID_LEVELS = new Set(["organisational", "departmental", "programmatic"]);

interface PillarProposal {
  title: string;
  description: string;
  success_signal: string;
  pillar_level: string;
}

function normaliseProposals(raw: unknown): PillarProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is Record<string, unknown> =>
        typeof p === "object" && p !== null && typeof (p as Record<string, unknown>).title === "string",
    )
    .map((p) => ({
      title: String(p.title).trim(),
      description: typeof p.description === "string" ? p.description.trim() : "",
      success_signal: typeof p.success_signal === "string" ? p.success_signal.trim() : "",
      pillar_level: VALID_LEVELS.has(String(p.pillar_level)) ? String(p.pillar_level) : "organisational",
    }))
    .filter((p) => p.title.length > 0)
    .slice(0, 10);
}

function normaliseVocabulary(raw: unknown): Record<string, string> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const key of ["priorities_label", "initiatives_label", "lenses_label"]) {
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === "string" && val.trim().length > 0 && val.trim().length <= 60) {
      out[key] = val.trim();
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Authn + admin authz.
  let callerUid: string;
  try {
    callerUid = decodeUid(req);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unauthorised" }, 401);
  }
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("user_id", callerUid)
    .maybeSingle();
  if (callerProfile?.role !== "internal_admin") {
    return jsonResponse({ error: "Admin access required" }, 403);
  }

  // 2. Input.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const engagementId = String(body.engagement_id ?? "").trim();
  const documentId = String(body.document_id ?? "").trim();
  if (!engagementId || !documentId) {
    return jsonResponse({ error: "engagement_id and document_id are required" }, 400);
  }

  // 3. Sanity: the document must belong to the engagement.
  const { data: doc } = await supabase
    .from("st_documents")
    .select("id, engagement_id, title, status")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.engagement_id !== engagementId) {
    return jsonResponse({ error: "Document not found in this engagement" }, 404);
  }

  // The wizard needs a setup row to write proposals into.
  const { data: setup } = await supabase
    .from("st_engagement_setup")
    .select("id")
    .eq("engagement_id", engagementId)
    .maybeSingle();
  if (!setup) {
    return jsonResponse({ error: "No setup record for this engagement" }, 404);
  }

  // 4. Read the document's chunks (document order ≈ insertion order).
  const { data: chunks, error: chunksErr } = await supabase
    .from("knowledge_chunks")
    .select("chunk_text, chunk_summary")
    .eq("engagement_id", engagementId)
    .eq("source_id", documentId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(600);
  if (chunksErr) {
    return jsonResponse({ error: `Could not read the document's chunks: ${chunksErr.message}` }, 500);
  }
  if (!chunks || chunks.length === 0) {
    return jsonResponse(
      {
        error:
          doc.status === "ingested"
            ? "This document has no knowledge chunks to work from."
            : "Nera hasn't finished reading this document yet — wait for it to show as chunked, then try again.",
      },
      409,
    );
  }

  const context = buildContext(chunks as ChunkRow[]);
  if (context.trim().length < 200) {
    return jsonResponse(
      { error: "The document's content is too thin to propose pillars from." },
      409,
    );
  }

  // 5. Engagement details ground the prompt.
  const { data: engagement } = await supabase
    .from("st_engagements")
    .select("name, client_name, sector, description")
    .eq("id", engagementId)
    .maybeSingle();

  // 6. AI config: engagement row → global row → house default.
  let { data: aiConfig } = await supabase
    .from("st_ai_config")
    .select("llm_provider, llm_model")
    .eq("engagement_id", engagementId)
    .maybeSingle();
  if (!aiConfig) {
    const { data: globalConfig } = await supabase
      .from("st_ai_config")
      .select("llm_provider, llm_model")
      .is("engagement_id", null)
      .limit(1)
      .maybeSingle();
    aiConfig = globalConfig;
  }

  let provider = (aiConfig?.llm_provider as string) || DEFAULT_PROVIDER;
  let model = (aiConfig?.llm_model as string) || DEFAULT_MODEL;
  if (!API_KEYS[provider]) {
    // No key for the configured provider — fall back to the house default.
    provider = DEFAULT_PROVIDER;
    model = DEFAULT_MODEL;
  }
  if (!API_KEYS[provider]) {
    return jsonResponse({ error: "No LLM API key configured on the server" }, 500);
  }
  const llmConfig: LLMConfig = {
    provider: provider as LLMConfig["provider"],
    model,
    apiKey: API_KEYS[provider],
  };

  const systemPrompt = `You are Nera, a strategic-planning analyst. You have been given extracts from an organisation's strategic plan. Identify the organisation's strategic pillars — the 3-7 big commitments the plan is actually organised around.

Rules:
- Ground every pillar in what the plan SAYS. Do not invent pillars the document does not support.
- Use the plan's own language for titles where possible.
- "description": 1-3 sentences on what the pillar covers, in plain language.
- "success_signal": one sentence on what success looks like for this pillar, drawn from the plan's stated measures or outcomes where available.
- "pillar_level" is always "organisational" (these are whole-of-organisation strategic priorities).
- vocabulary_suggestions: ONLY when the plan itself consistently uses distinctive terms for its structure (e.g. it calls its priorities "Strategic Directions" or its initiatives "Workstreams"). If the plan uses ordinary language, return null. Labels are plural forms.

Return ONLY a JSON object, no other text:
{
  "pillars": [
    { "title": string, "description": string, "success_signal": string, "pillar_level": "organisational" }
  ],
  "vocabulary_suggestions": { "priorities_label": string, "initiatives_label": string, "lenses_label": string } | null
}
Include only the vocabulary_suggestions keys the plan gives you evidence for.`;

  const userMessage = `Organisation: ${engagement?.client_name || engagement?.name || "(unknown)"}
Sector: ${engagement?.sector || "(not stated)"}
Engagement: ${engagement?.name || "(unknown)"}${engagement?.description ? ` — ${engagement.description}` : ""}
Document: ${doc.title}

Strategic plan extracts:

${context}`;

  // 7. One LLM call.
  let llmResult: string;
  try {
    llmResult = await callLLM(llmConfig, systemPrompt, [{ role: "user", content: userMessage }], 3000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LLM call failed";
    console.error("st-extract-pillars LLM error:", msg);
    return jsonResponse({ error: `Nera couldn't complete the reading: ${msg.slice(0, 300)}` }, 502);
  }

  // 8. Tolerant parse — never fabricate on failure.
  const parsed = parseJsonFromLLM(llmResult);
  const proposals = normaliseProposals(parsed?.pillars);
  if (!parsed || proposals.length === 0) {
    console.error("st-extract-pillars parse failure:", llmResult.slice(0, 400));
    return jsonResponse(
      {
        error:
          "Nera's response couldn't be read as pillar proposals. Nothing was saved — try running the extraction again.",
      },
      502,
    );
  }
  const vocabularySuggestions = normaliseVocabulary(parsed.vocabulary_suggestions);

  // 9. Persist to the setup row and return.
  const pillarProposals = {
    source_document_id: documentId,
    proposals,
    vocabulary_suggestions: vocabularySuggestions,
    extracted_at: new Date().toISOString(),
  };
  const { error: writeErr } = await supabase
    .from("st_engagement_setup")
    .update({ pillar_proposals: pillarProposals })
    .eq("engagement_id", engagementId);
  if (writeErr) {
    return jsonResponse({ error: `Failed to save proposals: ${writeErr.message}` }, 500);
  }

  return jsonResponse({ pillar_proposals: pillarProposals });
});
