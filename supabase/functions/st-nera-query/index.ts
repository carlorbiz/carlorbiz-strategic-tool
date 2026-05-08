// =============================================================================
// Carlorbiz Strategic Tool — Engagement-scoped Nera chatbot
// supabase/functions/st-nera-query/index.ts
//
// Engagement-aware replacement for nera-query (which is the carlorbiz-website
// chatbot). Differences:
//   - Requires engagement_id in the request body.
//   - Authorises via st_user_engagement_roles (membership), not just role.
//   - Retrieves chunks scoped to source_app='strategic-tool' AND engagement_id.
//   - Loads system prompt + vocabulary from st_ai_config (per engagement),
//     falling back to a sensible default if no row exists yet.
//   - Multi-LLM (Anthropic / Gemini / OpenAI) per st_ai_config.llm_provider.
//   - Logs to nera_queries with engagement_id + source_app='strategic-tool'.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callLLM,
  streamLLM,
  parseStreamDeltas,
} from "../_shared/llm.ts";
import type { LLMConfig, LLMMessage } from "../_shared/llm.ts";

// ─── Environment ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LLM_API_KEYS: Record<string, string> = {
  anthropic: Deno.env.get("ANTHROPIC_API_KEY") || "",
  google: Deno.env.get("GOOGLE_API_KEY") || "",
  openai: Deno.env.get("OPENAI_API_KEY") || "",
};

// ─── CORS ─────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Auth ─────────────────────────────────────────────────────
// Decode the JWT (signature verification handled at the gateway).
async function decodeUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid bearer token");
  const payload = JSON.parse(atob(parts[1]));
  const sub = payload.sub;
  if (!sub) throw new Error("Invalid bearer token");
  return sub as string;
}

async function authoriseEngagementAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  engagementId: string,
): Promise<{ role: string; isAdmin: boolean }> {
  // Internal admins bypass per-engagement membership checks.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (profile?.role === "internal_admin") {
    return { role: "internal_admin", isAdmin: true };
  }

  const { data: roles } = await supabase
    .from("st_user_engagement_roles")
    .select("role:st_engagement_roles(role_key, permissions)")
    .eq("user_id", userId)
    .eq("engagement_id", engagementId);

  if (!roles || roles.length === 0) {
    throw new Error("No access to this engagement");
  }

  // deno-lint-ignore no-explicit-any
  const first = roles[0] as any;
  const roleKey = first?.role?.role_key ?? "external_stakeholder";
  const isAdmin = !!first?.role?.permissions?.admin;
  return { role: roleKey, isAdmin };
}

// ─── Engagement context ───────────────────────────────────────

interface VocabularyMap {
  commitment_top_singular?: string;
  commitment_top_plural?: string;
  commitment_sub_singular?: string;
  commitment_sub_plural?: string;
  cross_cut_singular?: string;
  cross_cut_plural?: string;
  evidence_singular?: string;
  evidence_plural?: string;
  [k: string]: string | undefined;
}

const DEFAULT_VOCAB: Required<Pick<VocabularyMap,
  "commitment_top_singular" | "commitment_top_plural" |
  "commitment_sub_singular" | "commitment_sub_plural" |
  "cross_cut_singular" | "cross_cut_plural" |
  "evidence_singular" | "evidence_plural"
>> = {
  commitment_top_singular: "Priority",
  commitment_top_plural: "Priorities",
  commitment_sub_singular: "Initiative",
  commitment_sub_plural: "Initiatives",
  cross_cut_singular: "Lens",
  cross_cut_plural: "Lenses",
  evidence_singular: "document",
  evidence_plural: "documents",
};

interface EngagementContext {
  engagement: {
    id: string;
    name: string;
    client_name: string | null;
    status: string;
    short_code: string | null;
  };
  vocabulary: typeof DEFAULT_VOCAB;
  llmConfig: LLMConfig;
  systemPromptOverride: string | null;
  commitments: Array<{
    id: string;
    kind: string;
    title: string;
    parent_id: string | null;
    description: string | null;
  }>;
  stages: Array<{
    title: string;
    stage_type: string;
    status: string;
  }>;
  chunkCount: number;
}

async function loadEngagementContext(
  supabase: ReturnType<typeof createClient>,
  engagementId: string,
): Promise<EngagementContext> {
  const [engRes, cfgRes, cmtRes, stgRes, chunkRes] = await Promise.all([
    supabase
      .from("st_engagements")
      .select("id, name, client_name, status, short_code")
      .eq("id", engagementId)
      .single(),
    supabase
      .from("st_ai_config")
      .select("vocabulary_map, system_prompt_update, llm_provider, llm_model")
      .eq("engagement_id", engagementId)
      .maybeSingle(),
    supabase
      .from("st_commitments")
      .select("id, kind, title, parent_id, description")
      .eq("engagement_id", engagementId)
      .eq("status", "active")
      .order("kind", { ascending: true })
      .order("title", { ascending: true }),
    supabase
      .from("st_engagement_stages")
      .select("title, stage_type, status")
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: true }),
    supabase
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("source_app", "strategic-tool")
      .eq("engagement_id", engagementId)
      .eq("is_active", true),
  ]);

  if (engRes.error || !engRes.data) {
    throw new Error("Engagement not found");
  }

  // deno-lint-ignore no-explicit-any
  const cfg = (cfgRes.data ?? {}) as any;
  const vocab = { ...DEFAULT_VOCAB, ...(cfg.vocabulary_map ?? {}) };

  const provider = (cfg.llm_provider as "anthropic" | "google" | "openai") || "anthropic";
  const model = (cfg.llm_model as string) ||
    (provider === "google" ? "gemini-2.5-flash"
      : provider === "openai" ? "gpt-4o-mini"
        : "claude-sonnet-4-20250514");
  const apiKey = LLM_API_KEYS[provider];
  if (!apiKey) {
    throw new Error(`No API key configured for LLM provider: ${provider}`);
  }

  return {
    engagement: engRes.data,
    vocabulary: vocab,
    llmConfig: { provider, model, apiKey },
    systemPromptOverride: cfg.system_prompt_update ?? null,
    commitments: cmtRes.data ?? [],
    stages: stgRes.data ?? [],
    chunkCount: chunkRes.count ?? 0,
  };
}

// ─── System prompt ────────────────────────────────────────────

function buildSystemPrompt(ctx: EngagementContext): string {
  if (ctx.systemPromptOverride) return ctx.systemPromptOverride;

  const v = ctx.vocabulary;
  const tops = ctx.commitments.filter((c) => c.kind === "top");
  const subs = ctx.commitments.filter((c) => c.kind === "sub");
  const lenses = ctx.commitments.filter((c) => c.kind === "cross_cut");

  const formatCommitments = (): string => {
    if (tops.length === 0) {
      return `(No ${v.commitment_top_plural.toLowerCase()} have been defined yet for this engagement.)`;
    }
    const lines: string[] = [];
    for (const t of tops) {
      lines.push(`- ${t.title}${t.description ? ` — ${t.description}` : ""}`);
      const children = subs.filter((s) => s.parent_id === t.id);
      for (const c of children) {
        lines.push(`    • ${c.title}${c.description ? ` — ${c.description}` : ""}`);
      }
    }
    return lines.join("\n");
  };

  const formatLenses = (): string => {
    if (lenses.length === 0) return "";
    return `\n\n**${v.cross_cut_plural} (cross-cutting tags):**\n` +
      lenses.map((l) => `- ${l.title}`).join("\n");
  };

  const stageLines = ctx.stages.length === 0
    ? "(No stages defined yet.)"
    : ctx.stages
      .map((s) => `- ${s.title} (${s.stage_type}, ${s.status})`)
      .join("\n");

  const corpusLine = ctx.chunkCount === 0
    ? `No ${v.evidence_plural.toLowerCase()} have been ingested yet for this engagement.`
    : `${ctx.chunkCount} knowledge chunks indexed across the engagement's ${v.evidence_plural.toLowerCase()}.`;

  return `You are Nera, the AI assistant for the strategic engagement **${ctx.engagement.name}**${ctx.engagement.client_name ? ` (${ctx.engagement.client_name})` : ""}.

You help the engagement team — admins, stakeholders, and clients — find evidence, track ${v.commitment_top_plural.toLowerCase()}, and make sense of what has been uploaded into the engagement's knowledge base.

# Engagement state

- Status: ${ctx.engagement.status}
- ${corpusLine}

# ${v.commitment_top_plural} taxonomy

${formatCommitments()}${formatLenses()}

# Stages

${stageLines}

# How to answer

1. **Answer ONLY from the reference material provided in the user message.** Never invent figures, dates, names, or quotes. If the material doesn't contain enough to answer, say so explicitly and suggest what evidence would help.
2. **Cite sources naturally** by document name. When a section reference is available, include it (e.g. "Board pre-read, §3.2").
3. **Use the engagement's vocabulary** — say "${v.commitment_top_plural.toLowerCase()}" not "priorities" if those aren't the same; say "${v.evidence_plural.toLowerCase()}" not "documents" if those aren't the same. The vocabulary map above is canonical for this engagement.
4. **Tie answers back to ${v.commitment_top_plural.toLowerCase()} where relevant.** If a piece of evidence is about a specific ${v.commitment_top_singular.toLowerCase()}, name it. If it cuts across multiple, say so.
5. **Be precise with figures.** Quote exact amounts, dates, percentages, and decisions verbatim from the source documents. If a figure isn't in the documents, do not produce one.
6. **Format key values in bold** for scannability. Use bullets when listing multiple findings.
7. **Keep responses tight.** Two to four short paragraphs is usually right. Long blocks of prose lose people.
8. **Voice:** direct, Australian English, plain. Do not pad with "I'd be happy to help" or "Great question". Do not refer to yourself as an AI; you are Nera.

# When you cannot answer

- If no evidence has been ingested yet, say so and recommend uploading the relevant ${v.evidence_plural.toLowerCase()} via the **Documents** tab.
- If the question is genuinely outside the engagement's scope, say so plainly and suggest the user raise it with the engagement admin or open a new ${v.commitment_top_singular.toLowerCase()}.
- Never refer to "knowledge chunks", "context provided", or other internal plumbing terms. Speak as if you inherently know the corpus.`;
}

// ─── Lightweight query understanding ──────────────────────────

const QUERY_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at", "by",
  "with", "what", "how", "can", "should", "do", "does", "is", "are", "be",
  "our", "their", "they", "them", "we", "you", "after", "before", "from",
  "this", "that", "these", "those", "about", "tell", "me", "show", "have",
  "has", "had", "will", "would", "could", "i",
]);

function extractKeywords(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !QUERY_STOPWORDS.has(w));

  const out: string[] = [];
  for (const w of words) {
    if (!out.includes(w)) out.push(w);
    if (out.length >= 8) break;
  }
  return out;
}

// ─── Retrieval ────────────────────────────────────────────────

interface ScopedChunk {
  id: string;
  chunk_text: string;
  chunk_summary: string | null;
  document_source: string;
  section_reference: string | null;
  topic_tags: string[] | null;
}

async function retrieveScopedChunks(
  supabase: ReturnType<typeof createClient>,
  engagementId: string,
  query: string,
  limit = 12,
): Promise<ScopedChunk[]> {
  const selectCols =
    "id, chunk_text, chunk_summary, document_source, section_reference, topic_tags";

  const baseFilter = (
    // deno-lint-ignore no-explicit-any
    q: any,
  ) =>
    q
      .eq("source_app", "strategic-tool")
      .eq("engagement_id", engagementId)
      .eq("is_active", true);

  const keywords = extractKeywords(query);
  const seen = new Set<string>();
  const out: ScopedChunk[] = [];

  // Phase 1 — full-text search on extracted keywords
  if (keywords.length > 0) {
    const fts = keywords.join(" OR ");
    const { data, error } = await baseFilter(
      supabase.from("knowledge_chunks").select(selectCols),
    )
      .textSearch("fts", fts, { type: "websearch" })
      .limit(limit);

    if (!error && data) {
      for (const row of data as ScopedChunk[]) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          out.push(row);
        }
      }
    }
  }

  // Phase 2 — fallback: most recent chunks for the engagement.
  // If FTS returned nothing useful, surface the corpus's recent additions so
  // the LLM has *something* to ground in (the model can still say "no match").
  if (out.length < 3) {
    const { data, error } = await baseFilter(
      supabase
        .from("knowledge_chunks")
        .select(selectCols)
        .order("created_at", { ascending: false }),
    ).limit(limit - out.length);

    if (!error && data) {
      for (const row of data as ScopedChunk[]) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          out.push(row);
        }
      }
    }
  }

  return out.slice(0, limit);
}

function formatChunksForContext(chunks: ScopedChunk[]): string {
  return chunks
    .map((c, i) => {
      const sect = c.section_reference ? ` — ${c.section_reference}` : "";
      return `[Source ${i + 1}] ${c.document_source}${sect}\n${c.chunk_text}`;
    })
    .join("\n\n---\n\n");
}

function uniqueSources(chunks: ScopedChunk[]): string[] {
  return [
    ...new Set(
      chunks.map((c) =>
        c.section_reference
          ? `${c.document_source}, ${c.section_reference}`
          : c.document_source
      ),
    ),
  ];
}

// ─── Conversation history ─────────────────────────────────────

async function loadHistory(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  engagementId: string,
  limit = 6,
): Promise<LLMMessage[]> {
  if (!sessionId) return [];
  const { data, error } = await supabase
    .from("nera_queries")
    .select("query_text, response_text")
    .eq("session_id", sessionId)
    .eq("source_app", "strategic-tool")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  const out: LLMMessage[] = [];
  for (const row of data) {
    if (row.query_text) out.push({ role: "user", content: row.query_text });
    if (row.response_text) {
      out.push({ role: "assistant", content: row.response_text });
    }
  }
  return out;
}

// ─── Logging ──────────────────────────────────────────────────

interface LogParams {
  id?: string;
  engagementId: string;
  sessionId: string | null;
  userId: string;
  queryText: string;
  responseText: string;
  chunksUsed: string[];
  sourcesCited: string[];
  retrievalMethod: string;
  responseLatencyMs: number;
}

async function logQuery(
  supabase: ReturnType<typeof createClient>,
  p: LogParams,
): Promise<string | null> {
  const row: Record<string, unknown> = {
    engagement_id: p.engagementId,
    source_app: "strategic-tool",
    session_id: p.sessionId,
    user_id: p.userId,
    query_text: p.queryText,
    response_text: p.responseText,
    chunks_used: p.chunksUsed,
    sources_cited: p.sourcesCited,
    retrieval_method: p.retrievalMethod,
    response_latency_ms: p.responseLatencyMs,
    response_type: "answer",
    turn_number: 1,
    accumulated_context: {},
  };
  if (p.id) row.id = p.id;

  const { data, error } = await supabase
    .from("nera_queries")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("st-nera-query: failed to log query", error);
    return null;
  }
  return (data?.id as string) ?? null;
}

// ─── Feedback ─────────────────────────────────────────────────

async function handleFeedback(
  supabase: ReturnType<typeof createClient>,
  queryId: string,
  score: -1 | 1,
  userId: string,
): Promise<Response> {
  // Strategic-tool feedback: only update rows owned by this user, scoped to
  // strategic-tool. Falls back to admin-bypass if needed.
  const { error: ownerErr } = await supabase
    .from("nera_queries")
    .update({ feedback_score: score })
    .eq("id", queryId)
    .eq("user_id", userId)
    .eq("source_app", "strategic-tool");

  if (ownerErr) {
    return jsonResponse({ error: "Failed to update feedback" }, 500);
  }
  return jsonResponse({ success: true });
}

// ─── Main handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let userId: string;
  try {
    userId = await decodeUser(req);
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unauthorised" },
      401,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Feedback route ──
  if (body.feedback) {
    const fb = body.feedback as {
      query_id?: string;
      score?: number;
    };
    if (!fb.query_id || (fb.score !== -1 && fb.score !== 1)) {
      return jsonResponse(
        { error: "feedback requires query_id and score (-1 or 1)" },
        400,
      );
    }
    return await handleFeedback(supabase, fb.query_id, fb.score as -1 | 1, userId);
  }

  // ── Query route ──
  const engagementId = body.engagement_id as string | undefined;
  const query = body.query as string | undefined;
  const sessionId = (body.session_id as string | undefined) ?? null;

  if (!engagementId || typeof engagementId !== "string") {
    return jsonResponse({ error: "engagement_id is required" }, 400);
  }
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return jsonResponse({ error: "query is required" }, 400);
  }

  try {
    await authoriseEngagementAccess(supabase, userId, engagementId);
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Forbidden" },
      403,
    );
  }

  let ctx: EngagementContext;
  try {
    ctx = await loadEngagementContext(supabase, engagementId);
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Failed to load engagement" },
      500,
    );
  }

  const startTime = Date.now();
  const answerQueryId = crypto.randomUUID();
  const systemPrompt = buildSystemPrompt(ctx);

  const chunks = await retrieveScopedChunks(supabase, engagementId, query);
  const sources = uniqueSources(chunks);
  const retrievalMethod = chunks.length === 0
    ? "no_chunks"
    : "scoped_text_search";

  // Build the user-facing message.
  let userMessage: string;
  if (chunks.length === 0) {
    userMessage =
      `[NO REFERENCE MATERIAL MATCHED THIS QUERY]\n\nThe user asked: "${query}"\n\n` +
      `No ${ctx.vocabulary.evidence_plural.toLowerCase()} have been ingested yet (or none matched the keywords). ` +
      `Acknowledge this directly. If the engagement has zero ${ctx.vocabulary.evidence_plural.toLowerCase()} so far, ` +
      `recommend uploading the relevant ones via the Documents tab. ` +
      `Otherwise, suggest what evidence would help answer the question. ` +
      `Do not invent an answer from thin air.`;
  } else {
    const formatted = formatChunksForContext(chunks);
    userMessage = `REFERENCE MATERIAL:\n\n${formatted}\n\n---\n\nUSER QUESTION: ${query}`;
  }

  const history = await loadHistory(supabase, sessionId ?? "", engagementId);
  const llmMessages: LLMMessage[] = [...history, { role: "user", content: userMessage }];

  let llmResponse: Response;
  try {
    llmResponse = await streamLLM(ctx.llmConfig, systemPrompt, llmMessages, 2048);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("st-nera-query: streamLLM failed", msg);
    return jsonResponse(
      {
        type: "answer",
        answer:
          "I'm sorry, I had trouble generating a response. Please try again, or contact the engagement admin if this persists.",
        sources: [],
        _debug: msg,
      },
      200,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          sseEvent("meta", {
            type: "answer",
            sources,
            query_id: answerQueryId,
          }),
        ),
      );

      let fullText = "";
      let streamErr: string | null = null;

      try {
        for await (
          const delta of parseStreamDeltas(llmResponse, ctx.llmConfig.provider)
        ) {
          fullText += delta.text;
          controller.enqueue(
            encoder.encode(sseEvent("delta", { text: delta.text })),
          );
        }
      } catch (err) {
        streamErr = err instanceof Error ? err.message : String(err);
        console.error("st-nera-query: stream parse error", streamErr);
      }

      // Defensive fallback — if streaming yielded nothing, retry non-streaming.
      if (fullText.length === 0) {
        try {
          const fallback = await callLLM(
            ctx.llmConfig,
            systemPrompt,
            llmMessages,
            2048,
          );
          if (fallback && fallback.trim().length > 0) {
            fullText = fallback;
            controller.enqueue(
              encoder.encode(sseEvent("delta", { text: fallback })),
            );
          }
        } catch (err) {
          console.error("st-nera-query: callLLM fallback failed", err);
        }
      }

      if (fullText.length === 0) {
        const grace =
          "I couldn't generate a response just now. Try rephrasing the question, or refresh the page and try again.";
        fullText = grace;
        controller.enqueue(encoder.encode(sseEvent("delta", { text: grace })));
      }

      const latency = Date.now() - startTime;
      await logQuery(supabase, {
        id: answerQueryId,
        engagementId,
        sessionId,
        userId,
        queryText: query,
        responseText: fullText,
        chunksUsed: chunks.map((c) => c.id),
        sourcesCited: sources,
        retrievalMethod,
        responseLatencyMs: latency,
      });

      controller.enqueue(encoder.encode(sseEvent("done", {})));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});
