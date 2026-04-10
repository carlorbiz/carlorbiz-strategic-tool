import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM, streamLLM, parseStreamDeltas } from "../_shared/llm.ts";
import type { LLMConfig, LLMMessage } from "../_shared/llm.ts";

// ─── Environment ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// LLM API keys — provider determined by ai_config table
const LLM_API_KEYS: Record<string, string> = {
  anthropic: Deno.env.get("ANTHROPIC_API_KEY") || "",
  google: Deno.env.get("GOOGLE_API_KEY") || "",
  openai: Deno.env.get("OPENAI_API_KEY") || "",
};

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

async function requireNeraUser(req: Request): Promise<{ userId: string; role: string }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Missing bearer token");
  }

  // Decode JWT payload to extract user ID (sub claim).
  // No signature verification — verify_jwt is disabled at the gateway,
  // and these functions run within the same Supabase project.
  let userId: string;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("malformed");
    const payload = JSON.parse(atob(parts[1]));
    userId = payload.sub;
    if (!userId) throw new Error("no sub claim");
  } catch {
    throw new Error("Invalid bearer token");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  if (profileError || !profile) {
    throw new Error("User profile not found");
  }

  const allowed = new Set(["external_stakeholder", "internal_admin", "client_admin"]);
  if (!allowed.has(profile.role)) {
    throw new Error("Insufficient permissions");
  }

  return { userId, role: profile.role };
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── AI Config (loaded from Supabase at request time) ─────────

interface AIConfig {
  llm_provider: "anthropic" | "google" | "openai";
  llm_model: string;
  system_prompt: string | null;
  classify_prompt: string | null;
  no_chunks_response: string | null;
  synonym_map: Record<string, string[]>;
  typo_patterns: Array<{ pattern: string; replacement: string }>;
  client_name: string;
  support_contact: string | null;
  default_pathway: string | null;
}

const DEFAULT_CONFIG: AIConfig = {
  llm_provider: "anthropic",
  llm_model: "claude-sonnet-4-20250514",
  system_prompt: null,
  classify_prompt: null,
  no_chunks_response: null,
  synonym_map: {},
  typo_patterns: [],
  client_name: "Resource Hub",
  support_contact: null,
  default_pathway: null,
};

let _cachedConfig: AIConfig | null = null;
let _configFetchedAt = 0;
const CONFIG_TTL_MS = 60_000; // Refresh config every 60 seconds

async function loadAIConfig(
  supabase: ReturnType<typeof createClient>
): Promise<AIConfig> {
  const now = Date.now();
  if (_cachedConfig && now - _configFetchedAt < CONFIG_TTL_MS) {
    return _cachedConfig;
  }

  const { data, error } = await supabase
    .from("ai_config")
    .select("*")
    .eq("id", "default")
    .single();

  if (error || !data) {
    console.warn("ai_config not found, using defaults:", error?.message);
    return DEFAULT_CONFIG;
  }

  _cachedConfig = {
    llm_provider: data.llm_provider || DEFAULT_CONFIG.llm_provider,
    llm_model: data.llm_model || DEFAULT_CONFIG.llm_model,
    system_prompt: data.system_prompt,
    classify_prompt: data.classify_prompt,
    no_chunks_response: data.no_chunks_response,
    synonym_map: data.synonym_map || {},
    typo_patterns: data.typo_patterns || [],
    client_name: data.client_name || "Resource Hub",
    support_contact: data.support_contact,
    default_pathway: data.default_pathway,
  };
  _configFetchedAt = now;
  return _cachedConfig;
}

function getLLMConfig(aiConfig: AIConfig): LLMConfig {
  const apiKey = LLM_API_KEYS[aiConfig.llm_provider];
  if (!apiKey) {
    throw new Error(`No API key configured for LLM provider: ${aiConfig.llm_provider}`);
  }
  return {
    provider: aiConfig.llm_provider,
    model: aiConfig.llm_model,
    apiKey,
  };
}

// ─── Default Prompts (used when ai_config table has NULL values) ─

function getClassifyPrompt(config: AIConfig): string {
  if (config.classify_prompt) return config.classify_prompt;

  return `You are a query classifier and triage analyst for a knowledge resources platform (${config.client_name}).

Given a user question, do TWO things:

1. CLASSIFY — extract the query dimensions
2. TRIAGE — decide if a clarifying question would significantly improve the answer

Return ONLY valid JSON, no preamble:

{
  "intent": "lookup | requirement | procedure | general_knowledge | definition | unclear",
  "pathway": null,
  "classification": null,
  "mm_category": null,
  "topic_keywords": ["keyword1", "keyword2"],
  "triage": {
    "needed": false,
    "question": null,
    "options": null
  }
}

When triage IS needed, the triage object should be:
{
  "needed": true,
  "question": "A single, specific clarification question",
  "options": [
    { "label": "Most common scenario (Recommended)", "value": "machine_key" },
    { "label": "Alternative scenario", "value": "another_key" }
  ]
}

IMPORTANT: Maximum 3 options. Do NOT include a "Not sure / Tell me everything" option.

CLASSIFICATION RULES:
- Use null (not the string "null") when a dimension is not mentioned or implied.
- topic_keywords: 2-5 lowercase terms capturing the core subject matter.
- intent: lookup (specific data or figures), requirement (obligations, what must be done), procedure (how to do something), definition (term explanation), general_knowledge (general info), unclear (vague/out of scope).

TRIAGE RULES — When to ask for clarification vs answer directly:

Rule 1: ONLY CLARIFY WHEN THE ANSWER GENUINELY DIFFERS BY PARAMETER.
Ask a clarification question ONLY when ALL of these conditions are true:
  (a) The answer is materially different depending on a parameter you don't have
  (b) That parameter cannot be reasonably assumed from context
  (c) The retrieved chunks contain conflicting information for different values of that parameter

Rule 2: WHEN CLARIFYING, KEEP IT TIGHT.
- Ask ONE specific question
- Provide 2-3 options maximum (not 4+)
- Include a "most common" default that the user can accept with one click`;
}

function getSystemPrompt(config: AIConfig): string {
  if (config.system_prompt) return config.system_prompt;

  const supportLine = config.support_contact
    ? ` Contact ${config.support_contact} for further assistance.`
    : "";

  return `You are Nera, the AI knowledge assistant for ${config.client_name}. You help users find and understand information from the knowledge base.

RULES:
1. Answer ONLY from the provided context. Do not use any outside knowledge. NEVER reference internal terms like "knowledge chunks", "chunks", "context provided", or "based on the information provided". Speak as if you inherently know the content — cite the actual source documents instead.
2. Cite your sources naturally by referencing the document name and section.
3. If the context doesn't contain enough information to answer fully, say so clearly and suggest where to look.
4. Be precise with figures — always quote exact amounts, hours, or percentages from the source documents.
5. When multiple conditions or qualifiers apply, present them clearly using bullet points or a brief table, not buried in prose.
6. Keep responses concise but complete.
7. Format key values in **bold** for scannability.
8. NEVER INVENT SPECIFIC FIGURES. If the retrieved content contains a figure, quote it with the source. If it does NOT, say so. Do NOT generate plausible-sounding numbers from memory.
9. If the user's question identifies a genuine resource gap, be transparent AND helpful: (1) state that the content is not explicit, (2) provide best-available guidance from related sources, and (3) note this as a potential content gap.`;
}

function getNoChunksResponse(config: AIConfig): string {
  if (config.no_chunks_response) return config.no_chunks_response;

  const contactLine = config.support_contact
    ? ` or contact ${config.support_contact}`
    : "";

  return `I don't have that specific information in my knowledge base. Try rephrasing your question${contactLine} for further assistance.`;
}

// ─── Intent classification + triage ───────────────────────────

interface TriageOption {
  label: string;
  value: string;
}

interface TriageRecommendation {
  needed: boolean;
  question: string | null;
  options: TriageOption[] | null;
}

interface QueryClassification {
  intent: string;
  pathway: string | null;
  classification: string | null;
  mm_category: string | null;
  // Carlorbiz-specific dimensions
  target_industry: string | null;
  target_role: string | null;
  service_area: string | null;
  topic_keywords: string[];
  triage: TriageRecommendation;
}

async function classifyQuery(query: string): Promise<QueryClassification> {
  const defaults: QueryClassification = {
    intent: "general_knowledge",
    pathway: null,
    classification: null,
    mm_category: null,
    target_industry: null,
    target_role: null,
    service_area: null,
    topic_keywords: [],
    triage: { needed: false, question: null, options: null },
  };

  try {
    const raw = await callLLM(
      _currentLLMConfig!,
      CLASSIFY_AND_TRIAGE_PROMPT,
      [{ role: "user", content: query }],
      512
    );

    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    const triage: TriageRecommendation = parsed.triage?.needed
      ? {
          needed: true,
          question: parsed.triage.question || null,
          options: Array.isArray(parsed.triage.options)
            ? parsed.triage.options.slice(0, 4) // Cap at 4 options
            : null,
        }
      : { needed: false, question: null, options: null };

    return {
      intent: parsed.intent || defaults.intent,
      pathway: parsed.pathway ?? null,
      classification: parsed.classification ?? null,
      mm_category: parsed.mm_category ?? null,
      target_industry: parsed.target_industry ?? null,
      target_role: parsed.target_role ?? null,
      service_area: parsed.service_area ?? null,
      topic_keywords: Array.isArray(parsed.topic_keywords)
        ? parsed.topic_keywords
        : [],
      triage,
    };
  } catch {
    // If classification fails, proceed with defaults — don't block the query
    return defaults;
  }
}

// ─── Query expansion: synonym lookup ─────────────────────────
// Expands search terms with domain synonyms before hitting the DB.
// Zero cost, handles informal terminology prospectively.
// Synonym map is loaded from ai_config table (domain-specific per client).

// Module-level prompt variables — set from ai_config at request time
let CLASSIFY_AND_TRIAGE_PROMPT = "";
let NERA_SYSTEM_PROMPT = "";
let NO_CHUNKS_RESPONSE = "";
let _currentLLMConfig: LLMConfig | null = null;

// Placeholder — replaced at runtime by config.synonym_map
// Configure domain-specific synonyms in the ai_config table's synonym_map JSONB column.
// See _archive/resources-pwa/ACRRM_Nera_Synonyms.json for an example of a comprehensive map.
let SYNONYM_MAP: Record<string, string[]> = {}; /* loaded from ai_config at runtime */

// Domain-specific synonym map removed (200+ entries).
// Reference: _archive/resources-pwa/ACRRM_Nera_Synonyms.json
// Populate via ai_config.synonym_map JSONB column per client.


function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>(keywords);

  // Check individual keywords
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const synonyms = SYNONYM_MAP[lower];
    if (synonyms) {
      synonyms.forEach((s) => expanded.add(s.toLowerCase()));
    }
  }

  // Check bigrams (e.g. "term 2", "base rate", "annual leave")
  for (let i = 0; i < keywords.length - 1; i++) {
    const bigram = `${keywords[i]} ${keywords[i + 1]}`.toLowerCase();
    const synonyms = SYNONYM_MAP[bigram];
    if (synonyms) {
      synonyms.forEach((s) => expanded.add(s.toLowerCase()));
    }
  }

  return [...expanded];
}

// ─── Typo tolerance / query normalisation ─────────────────────
// Lightweight, domain-specific typo handling before classification.
// Loaded from ai_config.typo_patterns (JSON array of {pattern, replacement}).

let DOMAIN_TYPO_PATTERNS: Array<[RegExp, string]> = [];

const FALLBACK_QUERY_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at", "by",
  "with", "what", "how", "can", "should", "do", "does", "is", "are", "be",
  "our", "their", "they", "them", "we", "you", "after", "before", "from",
  "better", "chance",
]);

function normaliseUserQuery(query: string): string {
  let q = query;
  for (const [pattern, replacement] of DOMAIN_TYPO_PATTERNS) {
    q = q.replace(pattern, replacement);
  }
  return q.replace(/\s+/g, " ").trim();
}

function extractFallbackTopicKeywords(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !FALLBACK_QUERY_STOPWORDS.has(w));

  const deduped: string[] = [];
  for (const w of words) {
    if (!deduped.includes(w)) deduped.push(w);
    if (deduped.length >= 6) break;
  }
  return deduped;
}

function diversifyChunksBySource(
  chunks: KnowledgeChunk[],
  maxTotal: number,
  preferredPerSource = 2
): KnowledgeChunk[] {
  const bySource = new Map<string, KnowledgeChunk[]>();
  for (const chunk of chunks) {
    const key = (chunk.document_source || "unknown").toLowerCase();
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(chunk);
  }

  const selected: KnowledgeChunk[] = [];
  const selectedIds = new Set<string>();
  const perSourceCounts = new Map<string, number>();

  let madeProgress = true;
  while (selected.length < maxTotal && madeProgress) {
    madeProgress = false;

    for (const [source, sourceChunks] of bySource.entries()) {
      if (selected.length >= maxTotal) break;

      const count = perSourceCounts.get(source) || 0;
      if (count >= preferredPerSource) continue;

      const nextChunk = sourceChunks.find((c) => !selectedIds.has(c.id));
      if (!nextChunk) continue;

      selected.push(nextChunk);
      selectedIds.add(nextChunk.id);
      perSourceCounts.set(source, count + 1);
      madeProgress = true;
    }
  }

  // Fill remaining slots in original order if diversity pass didn't fill up.
  if (selected.length < maxTotal) {
    for (const chunk of chunks) {
      if (selected.length >= maxTotal) break;
      if (selectedIds.has(chunk.id)) continue;
      selected.push(chunk);
      selectedIds.add(chunk.id);
    }
  }

  return selected;
}

// ─── Chunk retrieval ──────────────────────────────────────────

interface KnowledgeChunk {
  id: string;
  chunk_text: string;
  chunk_summary: string | null;
  document_source: string;
  section_reference: string | null;
  content_type: string | null;
  pathway: string | null;
  classification: string | null;
  topic_tags?: string[] | null;
}

function hasRetentionAdvisorySignal(classified: QueryClassification): boolean {
  const joined = classified.topic_keywords.join(" ").toLowerCase();
  return /retain|retention|workforce|stay|pastoral|wellbeing|community/.test(joined);
}

function hasPmResourceSignal(classified: QueryClassification): boolean {
  const joined = classified.topic_keywords.join(" ").toLowerCase();
  return /resource|help|support|where|contact|gpsa|gpra|contract|template|practice manager/.test(joined);
}

function rerankForRetentionAdvisory(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
  const scored = chunks.map((chunk, idx) => {
    let score = 0;
    const summary = (chunk.chunk_summary || "").toLowerCase();
    const text = (chunk.chunk_text || "").toLowerCase();
    const tags = (chunk.topic_tags || []).join(" ").toLowerCase();

    if (/retain|retention|workforce/.test(summary)) score += 6;
    if (/wellbeing|pastoral|supportive|culture|community/.test(summary)) score += 4;
    if (/retain|retention|wellbeing|pastoral|community/.test(tags)) score += 5;
    if (/retain|retention|wellbeing|pastoral care|supportive/.test(text)) score += 3;

    return { chunk, idx, score };
  });

  scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
  return scored.map((s) => s.chunk);
}

function rerankForPmResourceSupport(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
  const scored = chunks.map((chunk, idx) => {
    let score = 0;
    const summary = (chunk.chunk_summary || "").toLowerCase();
    const text = (chunk.chunk_text || "").toLowerCase();
    const tags = (chunk.topic_tags || []).join(" ").toLowerCase();

    if (/template|contract|employment|support|resource/.test(text)) score += 5;
    if (/resource|support|template|contact/.test(summary)) score += 3;
    if (/support|resource|template/.test(tags)) score += 2;

    return { chunk, idx, score };
  });

  scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
  return scored.map((s) => s.chunk);
}

async function retrieveChunks(
  supabase: ReturnType<typeof createClient>,
  classified: QueryClassification
): Promise<KnowledgeChunk[]> {
  const chunks: KnowledgeChunk[] = [];
  const seenIds = new Set<string>();
  // The Carlorbiz classify prompt puts document_source names (e.g. "The Nera Platform
  // (segment 1/1)") into the pathway field. These are NOT real pathway dimension values
  // (pathway is an ACRRM concept — AGPT, RVTS, etc.). Nullify pathway if it looks like
  // a document source to prevent it from triggering structured-only retrieval.
  if (classified.pathway && /segment \d+\/\d+|^The |^How |^Why |^Mining /.test(classified.pathway)) {
    classified.pathway = null;
  }

  const hasStructuredDimensions = !!(
    classified.pathway ||
    classified.classification ||
    classified.mm_category
  );
  const selectCols =
    "id, chunk_text, chunk_summary, document_source, section_reference, content_type, pathway, classification, topic_tags, target_industry, target_role, service_area, engagement_stage";

  // NOTE: content_type filtering has been REMOVED entirely (20 Feb 2026).
  // It caused retrieval failures for rate_lookup (Schedule A tagged "requirement"
  // not "entitlement") AND procedure queries (PRODA/HPOS content tagged differently).
  // The extraction prompt does not tag content_type reliably enough to use as a
  // hard filter. Dimension filters (pathway, classification, mm_category) and
  // text search provide sufficient relevance without it.

  // Helper: apply pathway, mm_category, and Carlorbiz dimension filters
  function applyCommonFilters(
    q: ReturnType<ReturnType<typeof createClient>["from"]>
  ) {
    if (classified.pathway) {
      q = q.or(`pathway.eq.${classified.pathway},pathway.is.null`);
    }
    if (classified.mm_category) {
      q = q.or(
        `mm_category.eq.${classified.mm_category},mm_category.is.null`
      );
    }
    // Carlorbiz dimensions: prefer matching chunks but include untagged (null) ones too
    if (classified.target_industry) {
      q = q.or(`target_industry.eq.${classified.target_industry},target_industry.eq.cross-sector,target_industry.is.null`);
    }
    if (classified.target_role) {
      q = q.or(`target_role.eq.${classified.target_role},target_role.eq.general,target_role.is.null`);
    }
    if (classified.service_area) {
      q = q.or(`service_area.eq.${classified.service_area},service_area.eq.cross-service,service_area.is.null`);
    }
    return q;
  }

  // ── Phase 0: Topical FTS — ALWAYS runs when keywords exist ──
  // This is the primary retrieval method for Carlorbiz. Even when structured
  // dimensions are present, FTS ensures we find relevant content by topic.
  // Without this, queries like "what is a knowledge platform" return nothing
  // because the structured phases filter on dimension columns (pathway,
  // classification) that don't match any Carlorbiz chunks.
  if (classified.topic_keywords.length > 0) {
    const expandedKeywords = expandKeywords(classified.topic_keywords);

    const hasRetentionSignal = expandedKeywords.some((k) =>
      /retain|retention|stay after|workforce|community engagement/i.test(k)
    );
    if (hasRetentionSignal) {
      expandedKeywords.push(
        "retention",
        "registrar retention",
        "workforce retention",
        "community engagement",
        "community connection",
        "support",
        "supervision",
        "wellbeing"
      );
    }

    const searchTerms = expandedKeywords.join(" OR ");

    const { data: topicalResults } = await supabase
      .from("knowledge_chunks")
      .select(selectCols)
      .eq("is_active", true)
      .textSearch("fts", searchTerms, { type: "websearch" })
      .limit(20);

    if (topicalResults) {
      for (const chunk of topicalResults) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          chunks.push(chunk);
        }
      }
    }

    console.log(
      `[retrieve] topical FTS (no structured dims): ${chunks.length} chunks`
    );
  }

  // ── Phase 1: Exact classification match (specific chunks first) ──
  // This ensures chunks tagged with a specific classification (e.g. GPT2)
  // are not crowded out by the much larger pool of classification=NULL chunks.
  if (classified.classification) {
    const cls = classified.classification;
    const termNum = cls.replace(/^[A-Z]+/, "");
    const altCls = cls.startsWith("GPT") ? `CGT${termNum}` : `GPT${termNum}`;

    let exactQuery = supabase
      .from("knowledge_chunks")
      .select(selectCols)
      .eq("is_active", true)
      .or(`classification.eq.${cls},classification.eq.${altCls}`);

    exactQuery = applyCommonFilters(exactQuery);
    exactQuery = exactQuery.limit(8);

    const { data: exactResults } = await exactQuery;
    if (exactResults) {
      for (const chunk of exactResults) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          chunks.push(chunk);
        }
      }
    }
    console.log(
      `[retrieve] exact classification (${cls}/${altCls}): ${chunks.length} chunks found`
    );
  }

  // ── Phase 2: Generic chunks (classification IS NULL — applies to all terms) ──
  if (chunks.length < 10 && hasStructuredDimensions) {
    let genQuery = supabase
      .from("knowledge_chunks")
      .select(selectCols)
      .eq("is_active", true);

    // If we already fetched specific classification chunks, only get generic ones now
    if (classified.classification) {
      genQuery = genQuery.is("classification", null);
    }

    genQuery = applyCommonFilters(genQuery);
    genQuery = genQuery.limit(10 - chunks.length);

    const { data: genResults } = await genQuery;
    if (genResults) {
      for (const chunk of genResults) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          chunks.push(chunk);
        }
      }
    }
    console.log(
      `[retrieve] after generic fill: ${chunks.length} total chunks`
    );
  }

  // ── Fallback: full-text search if structured returned < 3 results ──
  if (chunks.length < 3 && classified.topic_keywords.length > 0) {
    const expandedKeywords = expandKeywords(classified.topic_keywords);

    // Inject rate-specific terms for lookup intents to improve retrieval
    if (classified.intent === "lookup" || classified.intent === "rate_lookup") {
      expandedKeywords.push("rate", "schedule", "base rate", "remuneration");
      if (classified.classification) {
        expandedKeywords.push(classified.classification.toLowerCase());
      }
    }

    const searchTerms = expandedKeywords.join(" OR ");

    const { data: ftsResults } = await supabase
      .from("knowledge_chunks")
      .select(
        "id, chunk_text, chunk_summary, document_source, section_reference, content_type, pathway, classification, topic_tags"
      )
      .eq("is_active", true)
      .textSearch("fts", searchTerms, { type: "websearch" })
      .limit(15);

    if (ftsResults) {
      for (const chunk of ftsResults) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          chunks.push(chunk);
        }
      }
    }
    console.log(
      `[retrieve] after FTS fallback: ${chunks.length} total chunks`
    );
  }

  // ── Last resort: broader text search using the raw query ──
  if (chunks.length < 3) {
    let broadSearchTerms: string;
    if ((classified.intent === "lookup" || classified.intent === "rate_lookup") && classified.classification) {
      // For lookups, search specifically for the classification
      broadSearchTerms = `"rate" OR "schedule" OR "${classified.classification}"`;
    } else if (classified.topic_keywords.length > 0) {
      broadSearchTerms = expandKeywords(classified.topic_keywords.slice(0, 3)).join(" ");
    } else {
      broadSearchTerms = "guide resource information";
    }

    const { data: broadResults } = await supabase
      .from("knowledge_chunks")
      .select(
        "id, chunk_text, chunk_summary, document_source, section_reference, content_type, pathway, classification, topic_tags"
      )
      .eq("is_active", true)
      .textSearch("fts", broadSearchTerms, { type: "websearch" })
      .limit(15);

    if (broadResults) {
      for (const chunk of broadResults) {
        if (!seenIds.has(chunk.id)) {
          seenIds.add(chunk.id);
          chunks.push(chunk);
        }
      }
    }
  }

  // Log final retrieval summary for diagnostics
  const shouldPreferSourceVariety =
    !hasStructuredDimensions &&
    new Set(["general_knowledge", "procedure", "requirement"]).has(
      classified.intent
    );

  let rankedChunks = chunks;
  if (!hasStructuredDimensions && hasRetentionAdvisorySignal(classified)) {
    rankedChunks = rerankForRetentionAdvisory(chunks);
  } else if (!hasStructuredDimensions && hasPmResourceSignal(classified)) {
    rankedChunks = rerankForPmResourceSupport(chunks);
  }

  const finalChunks = shouldPreferSourceVariety
    ? diversifyChunksBySource(rankedChunks, 15, 2)
    : rankedChunks.slice(0, 15);

  const uniqueSources = [...new Set(finalChunks.map((c) => c.document_source))];
  console.log(
    `[retrieve] FINAL: ${finalChunks.length} chunks across ${uniqueSources.length} sources. ` +
    `Sources: ${uniqueSources.join(" | ")}. ` +
    `Classifications: ${finalChunks.map((c) => c.classification || "null").join(", ")}`
  );

  return finalChunks; // Cap at 15 chunks to stay within token budget
}

// ─── Answer synthesis ─────────────────────────────────────────

function formatChunksForContext(chunks: KnowledgeChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const source = chunk.document_source;
      const section = chunk.section_reference
        ? ` — ${chunk.section_reference}`
        : "";
      return `[Source ${i + 1}] ${source}${section}\n${chunk.chunk_text}`;
    })
    .join("\n\n---\n\n");
}

interface TriageContext {
  originalQuery: string;
  userClarification: string;
  resolvedPathway: string | null;
}

async function synthesiseAnswer(
  query: string,
  chunks: KnowledgeChunk[],
  triageContext?: TriageContext
): Promise<{ answer: string; sources: string[] }> {
  if (chunks.length === 0) {
    return { answer: NO_CHUNKS_RESPONSE, sources: [] };
  }

  const context = formatChunksForContext(chunks);

  let userMessage: string;
  if (triageContext) {
    userMessage = `REFERENCE MATERIAL:\n\n${context}\n\n---\n\nORIGINAL QUESTION: ${triageContext.originalQuery}\nUSER CLARIFIED: ${triageContext.userClarification}${triageContext.resolvedPathway ? `\nPATHWAY: ${triageContext.resolvedPathway}` : ""}\n\nAnswer the original question through the lens of what the user clarified. Be specific and targeted.`;
  } else {
    userMessage = `REFERENCE MATERIAL:\n\n${context}\n\n---\n\nUSER QUESTION: ${query}`;
  }

  const answer = await callLLM(
    _currentLLMConfig!,
    NERA_SYSTEM_PROMPT,
    [{ role: "user", content: userMessage }]
  );

  // Extract unique source references
  const sources = [
    ...new Set(
      chunks
        .map((c) => {
          const section = c.section_reference
            ? `, ${c.section_reference}`
            : "";
          return `${c.document_source}${section}`;
        })
    ),
  ];

  return { answer, sources };
}

// ─── Logging ──────────────────────────────────────────────────

async function logQuery(
  supabase: ReturnType<typeof createClient>,
  params: {
    id?: string;
    session_id?: string;
    user_id?: string;
    query_text: string;
    response_text: string;
    chunks_used: string[];
    sources_cited: string[];
    retrieval_method: string;
    detected_intent: string;
    detected_pathway: string | null;
    detected_classification: string | null;
    detected_mm_category: string | null;
    response_latency_ms: number;
    response_type: "answer" | "clarification";
    clarification_options?: TriageOption[] | null;
    turn_number: number;
    accumulated_context: Record<string, unknown>;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("nera_queries")
    .insert({
      ...(params.id && { id: params.id }),
      session_id: params.session_id,
      user_id: params.user_id || null,
      query_text: params.query_text,
      response_text: params.response_text,
      chunks_used: params.chunks_used,
      sources_cited: params.sources_cited,
      retrieval_method: params.retrieval_method,
      detected_intent: params.detected_intent,
      detected_pathway: params.detected_pathway,
      detected_classification: params.detected_classification,
      detected_mm_category: params.detected_mm_category,
      response_latency_ms: params.response_latency_ms,
      response_type: params.response_type,
      clarification_options: params.clarification_options ?? null,
      turn_number: params.turn_number,
      accumulated_context: params.accumulated_context,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to log query:", error);
    return null;
  }
  return data?.id ?? null;
}

type GapType = "no_explicit_resource" | "partial_coverage" | "terminology_mismatch";

function detectContentGapSignal(params: {
  queryText: string;
  responseText: string;
  retrievalMethod: string;
  classified: QueryClassification;
  sources: string[];
}): {
  gap_type: GapType;
  topic: string;
  confidence: number;
  suggested_resource_type: string;
  reason: string;
} | null {
  const q = params.queryText.toLowerCase();
  const r = params.responseText.toLowerCase();
  const hasSources = params.sources.length > 0;

  const partialCoveragePhrases = [
    "outside the scope",
    "don't have specific",
    "do not have specific",
    "not in my current knowledge base",
    "not been loaded into my knowledge base",
    "this falls outside",
  ];

  const retentionSignal = /retain|retention|stay.*practice|post-fellowship|pastoral|community integration|wellbeing/.test(
    q
  );

  if (
    hasSources &&
    partialCoveragePhrases.some((p) => r.includes(p))
  ) {
    const suggested = retentionSignal ? "guide" : "faq";
    return {
      gap_type: "partial_coverage",
      topic: params.classified.topic_keywords?.[0] || (retentionSignal ? "registrar retention" : "knowledge gap"),
      confidence: retentionSignal ? 0.9 : 0.75,
      suggested_resource_type: suggested,
      reason: "NERA reported missing explicit resource despite retrieved supporting sources",
    };
  }

  if (params.retrievalMethod === "no_results") {
    return {
      gap_type: "no_explicit_resource",
      topic: params.classified.topic_keywords?.[0] || "missing topic",
      confidence: 0.7,
      suggested_resource_type: "faq",
      reason: "No results retrieved for query",
    };
  }

  return null;
}

async function logContentGapSignal(
  supabase: ReturnType<typeof createClient>,
  params: {
    query_id: string;
    session_id?: string;
    user_id?: string;
    query_text: string;
    gap_type: GapType;
    topic: string;
    detected_intent: string;
    detected_pathway: string | null;
    detected_classification: string | null;
    suggested_resource_type: string;
    confidence_score: number;
    related_sources: string[];
    reason: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from("content_gap_signals")
    .insert({
      query_id: params.query_id,
      session_id: params.session_id ?? null,
      user_id: params.user_id ?? null,
      query_text: params.query_text,
      gap_type: params.gap_type,
      topic: params.topic,
      detected_intent: params.detected_intent,
      detected_pathway: params.detected_pathway,
      detected_classification: params.detected_classification,
      suggested_resource_type: params.suggested_resource_type,
      confidence_score: params.confidence_score,
      related_sources: params.related_sources,
      status: "new",
      admin_notes: params.reason,
    });

  if (error) {
    console.warn("Failed to log content gap signal:", error.message);
  }
}

// ─── Conversation history ─────────────────────────────────────

interface ConversationTurn {
  query_text: string;
  response_text: string;
  response_type: string | null;
  clarification_options: TriageOption[] | null;
  detected_intent: string | null;
  detected_pathway: string | null;
  accumulated_context: Record<string, unknown> | null;
  turn_number: number | null;
}

async function loadConversationHistory(
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<ConversationTurn[]> {
  if (!sessionId) return [];

  const { data, error } = await supabase
    .from("nera_queries")
    .select(
      "query_text, response_text, response_type, clarification_options, detected_intent, detected_pathway, accumulated_context, turn_number"
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error || !data) return [];
  return data as ConversationTurn[];
}

// ─── Context merging for triage responses ─────────────────────

interface MergedContext {
  originalQuery: string;
  userClarification: string | null;
  resolvedPathway: string | null;
  turnNumber: number;
  accumulatedContext: Record<string, unknown>;
  isTriageResponse: boolean;
}

const PATHWAY_VALUE_MAP: Record<string, string> = {
  agpt: "AGPT",
  rvts: "RVTS",
  ip: "IP",
  fsp: "FSP",
  rgts: "RGTS",
};

function mergeConversationContext(
  currentQuery: string,
  history: ConversationTurn[]
): MergedContext {
  const defaultContext: MergedContext = {
    originalQuery: currentQuery,
    userClarification: null,
    resolvedPathway: null,
    turnNumber: history.length + 1,
    accumulatedContext: {},
    isTriageResponse: false,
  };

  if (history.length === 0) return defaultContext;

  // Check if the last turn was a clarification
  const lastTurn = history[history.length - 1];
  if (lastTurn.response_type !== "clarification") return defaultContext;

  // This IS a triage response — build accumulated context
  const accumulated: Record<string, unknown> =
    (lastTurn.accumulated_context as Record<string, unknown>) || {};

  // The original question is the first user query in the session
  const originalQuery = history[0].query_text;

  // Find the selected option's label from the clarification options
  const selectedOption = lastTurn.clarification_options?.find(
    (opt: TriageOption) => opt.value === currentQuery.toLowerCase() || opt.value === currentQuery
  );
  const userClarification = selectedOption?.label || currentQuery;

  // Try to resolve a pathway from the selection
  const resolvedPathway = PATHWAY_VALUE_MAP[currentQuery.toLowerCase()] || null;

  accumulated.selection = currentQuery;
  accumulated.clarification = userClarification;
  if (resolvedPathway) {
    accumulated.pathway = resolvedPathway;
  }

  return {
    originalQuery,
    userClarification,
    resolvedPathway,
    turnNumber: history.length + 1,
    accumulatedContext: accumulated,
    isTriageResponse: true,
  };
}

// ─── Feedback handler ─────────────────────────────────────────

async function handleFeedback(
  supabase: ReturnType<typeof createClient>,
  queryId: string,
  score: -1 | 1,
  userId?: string
): Promise<Response> {
  const { error } = await supabase
    .from("nera_queries")
    .update({ feedback_score: score })
    .eq("id", queryId)
    .eq("user_id", userId ?? "");

  if (error) {
    // Fallback: try without user_id filter (for unauthenticated queries)
    const { error: retryError } = await supabase
      .from("nera_queries")
      .update({ feedback_score: score })
      .eq("id", queryId);

    if (retryError) {
      return jsonResponse({ error: "Failed to update feedback" }, 500);
    }
  }

  return jsonResponse({ success: true });
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
    // Parse body first so we can check for public-mode flag
    const body = await req.json();

    // Public mode: anonymous queries from the public Services page.
    // Skips role-based auth. Still runs with service role for reads/writes.
    // The edge function itself is protected by Supabase anon key (required for invocation).
    const isPublicQuery = body.public === true;

    if (!isPublicQuery) {
      await requireNeraUser(req);
    }

    // Initialise Supabase client with service role (bypasses RLS for writes)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Server-side rate limiting for public queries — IP-based, 15 queries per 24 hours.
    // This is the real protection; client-side localStorage is just UX guidance.
    if (isPublicQuery) {
      const clientIp = req.headers.get("x-real-ip")
        || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "unknown";

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase
        .from("nera_queries")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twentyFourHoursAgo)
        .like("session_id", "public-%")
        .eq("accumulated_context->>client_ip", clientIp);

      const queryCount = count ?? 0;
      const PUBLIC_DAILY_LIMIT = 15;

      if (!countError && queryCount >= PUBLIC_DAILY_LIMIT) {
        return jsonResponse({
          error: "rate_limited",
          message: `You've reached the daily limit of ${PUBLIC_DAILY_LIMIT} questions. Come back tomorrow, or contact Carla to discuss a deeper engagement.`,
          limit: PUBLIC_DAILY_LIMIT,
          remaining: 0,
        }, 429);
      }

      // Stash the IP in accumulated_context so we can count it later
      if (!body.accumulated_context) body.accumulated_context = {};
      body.accumulated_context.client_ip = clientIp;
    }

    // Load AI config and set module-level prompts
    const aiConfig = await loadAIConfig(supabase);
    _currentLLMConfig = getLLMConfig(aiConfig);
    CLASSIFY_AND_TRIAGE_PROMPT = getClassifyPrompt(aiConfig);
    NERA_SYSTEM_PROMPT = getSystemPrompt(aiConfig);
    NO_CHUNKS_RESPONSE = getNoChunksResponse(aiConfig);
    SYNONYM_MAP = aiConfig.synonym_map || {};
    DOMAIN_TYPO_PATTERNS = (aiConfig.typo_patterns || []).map(
      (p: { pattern: string; replacement: string }) => [new RegExp(p.pattern, "gi"), p.replacement] as [RegExp, string]
    );

    // Public intake mode: allow frontend to override the system prompt
    // (e.g. for conversational enquiry intakes where Nera runs an interview
    // rather than answering Q&A). Only honoured when public=true.
    if (isPublicQuery && typeof body.system_prompt_override === "string" && body.system_prompt_override.length > 0) {
      NERA_SYSTEM_PROMPT = body.system_prompt_override;
    }

    // ── Route: Feedback submission ──
    if (body.feedback) {
      const { query_id, score, user_id } = body.feedback;
      if (!query_id || (score !== -1 && score !== 1)) {
        return jsonResponse(
          { error: "feedback requires query_id and score (-1 or 1)" },
          400
        );
      }
      return await handleFeedback(supabase, query_id, score, user_id);
    }

    // ── Route: Query ──
    const { query, user_id, session_id } = body;
    if (!query || typeof query !== "string") {
      return jsonResponse({ error: "query is required" }, 400);
    }

    const startTime = Date.now();

    // Step 1: Load conversation history (if session_id provided)
    const history = session_id
      ? await loadConversationHistory(supabase, session_id)
      : [];

    // Step 2: Merge context from previous turns
    const merged = mergeConversationContext(query, history);
    const normalisedCurrentQuery = normaliseUserQuery(query);
    const normalisedOriginalQuery = normaliseUserQuery(merged.originalQuery);

    // Step 3: Classify — use original question if this is a triage response
    let classified: QueryClassification;
    if (merged.isTriageResponse) {
      // Re-classify the ORIGINAL question, not the triage option value
      classified = await classifyQuery(normalisedOriginalQuery);
      // Override pathway if the triage resolved one
      if (merged.resolvedPathway) {
        classified.pathway = merged.resolvedPathway;
      }
      // Suppress triage — don't ask again after the user already answered
      classified.triage = { needed: false, question: null, options: null };
    } else {
      classified = await classifyQuery(normalisedCurrentQuery);
    }

    // Fallback: if classifier returns weak/no keywords, derive some from the
    // normalised query so retrieval still has topical anchors.
    if (!classified.topic_keywords || classified.topic_keywords.length === 0) {
      classified.topic_keywords = extractFallbackTopicKeywords(
        merged.isTriageResponse ? normalisedOriginalQuery : normalisedCurrentQuery
      );
    }

    console.log(
      `[classify] intent=${classified.intent} pathway=${classified.pathway} ` +
      `classification=${classified.classification} triage=${classified.triage.needed} ` +
      `keywords=${classified.topic_keywords.join(",")}`
    );

    // Step 4: Retrieve relevant knowledge chunks
    let chunks = await retrieveChunks(supabase, classified);

    // If this is a triage follow-up, always merge preserved chunks from Turn 1.
    // Turn 2's re-retrieval uses tighter filters and may return lower-relevance
    // results. The Turn 1 chunks were retrieved before pathway narrowing and are
    // often the best matches. Deduplication ensures no overlap.
    if (merged.isTriageResponse) {
      const preservedIds = (merged.accumulatedContext as Record<string, unknown>)
        .preserved_chunk_ids as string[] | undefined;
      if (preservedIds && preservedIds.length > 0) {
        const seenIds = new Set(chunks.map((c) => c.id));
        const missingIds = preservedIds.filter((id) => !seenIds.has(id));
        if (missingIds.length > 0) {
          const { data: preservedChunks } = await supabase
            .from("knowledge_chunks")
            .select(
              "id, chunk_text, chunk_summary, document_source, section_reference, content_type, pathway, classification"
            )
            .in("id", missingIds)
            .eq("is_active", true);

          if (preservedChunks) {
            for (const chunk of preservedChunks) {
              chunks.push(chunk);
            }
          }
        }
      }
    }

    // Determine retrieval method used
    const retrievalMethod =
      chunks.length === 0
        ? "no_results"
        : classified.pathway || classified.classification || classified.mm_category
          ? "structured_lookup"
          : "text_search";

    // Step 5: Apply default pathway from config (if configured).
    // Some domains have a dominant pathway that should be assumed when not specified.
    if (!classified.pathway && aiConfig.default_pathway) {
      classified.pathway = aiConfig.default_pathway;
      // If we also have a classification, there's nothing left to clarify
      if (classified.classification) {
        classified.triage = { needed: false, question: null, options: null };
      }
    }

    const shouldClarify =
      classified.triage.needed &&
      classified.triage.question &&
      classified.triage.options &&
      classified.triage.options.length >= 2;

    if (shouldClarify) {
      // ── CLARIFICATION RESPONSE (JSON, not streamed) ──
      // Persist Turn 1 chunk IDs so Turn 2 can reuse them instead of re-retrieving
      const contextWithChunks = {
        ...merged.accumulatedContext,
        preserved_chunk_ids: chunks.map((c) => c.id),
      };
      const latency = Date.now() - startTime;
      const options = classified.triage.options!;
      const queryId = await logQuery(supabase, {
        session_id,
        user_id,
        query_text: query,
        response_text: classified.triage.question!,
        chunks_used: chunks.map((c) => c.id),
        sources_cited: [],
        retrieval_method: "triage",
        detected_intent: classified.intent,
        detected_pathway: classified.pathway,
        detected_classification: classified.classification,
        detected_mm_category: classified.mm_category,
        response_latency_ms: latency,
        response_type: "clarification",
        clarification_options: options,
        turn_number: merged.turnNumber,
        accumulated_context: contextWithChunks,
      });

      return jsonResponse({
        type: "clarification",
        answer: classified.triage.question!,
        sources: [],
        options,
        query_id: queryId,
      });
    }

    // ── ANSWER RESPONSE (SSE streamed) ──
    const answerQueryId = crypto.randomUUID();
    const effectiveQuery = merged.isTriageResponse
      ? merged.originalQuery
      : query;

    const triageContext = merged.isTriageResponse && merged.userClarification
      ? {
          originalQuery: merged.originalQuery,
          userClarification: merged.userClarification,
          resolvedPathway: merged.resolvedPathway,
        }
      : undefined;

    // Extract sources for the meta event
    const sources = [
      ...new Set(
        chunks.map((c) => {
          const section = c.section_reference ? `, ${c.section_reference}` : "";
          return `${c.document_source}${section}`;
        })
      ),
    ];

    // No-chunks case: return JSON immediately
    // BUT: if system_prompt_override is set (interview/survey mode), skip this —
    // the LLM should respond using the override prompt, not the no-chunks fallback.
    const hasPromptOverride = isPublicQuery && typeof body.system_prompt_override === "string" && body.system_prompt_override.length > 0;
    if (chunks.length === 0 && !hasPromptOverride) {
      const latency = Date.now() - startTime;
      await logQuery(supabase, {
        id: answerQueryId,
        session_id,
        user_id,
        query_text: query,
        response_text: NO_CHUNKS_RESPONSE,
        chunks_used: [],
        sources_cited: [],
        retrieval_method: "no_results",
        detected_intent: classified.intent,
        detected_pathway: classified.pathway,
        detected_classification: classified.classification,
        detected_mm_category: classified.mm_category,
        response_latency_ms: latency,
        response_type: "answer",
        clarification_options: null,
        turn_number: merged.turnNumber,
        accumulated_context: merged.accumulatedContext,
      });

      return jsonResponse({
        type: "answer",
        answer: NO_CHUNKS_RESPONSE,
        sources: [],
        query_id: answerQueryId,
      });
    }

    // Build synthesis prompt
    let userMessage: string;
    if (hasPromptOverride) {
      // Interview/survey mode: just pass the user's response directly.
      // The system_prompt_override contains all the context needed.
      userMessage = effectiveQuery;
    } else if (triageContext) {
      const chunkContext = formatChunksForContext(chunks);
      userMessage = `REFERENCE MATERIAL:\n\n${chunkContext}\n\n---\n\nORIGINAL QUESTION: ${triageContext.originalQuery}\nUSER CLARIFIED: ${triageContext.userClarification}${triageContext.resolvedPathway ? `\nPATHWAY: ${triageContext.resolvedPathway}` : ""}\n\nAnswer the original question through the lens of what the user clarified. Be specific and targeted.`;
    } else {
      const chunkContext = formatChunksForContext(chunks);
      userMessage = `REFERENCE MATERIAL:\n\n${chunkContext}\n\n---\n\nUSER QUESTION: ${effectiveQuery}`;
    }

    // Call LLM with streaming enabled
    // In interview/survey mode, send the full conversation history as multi-turn
    // messages so the LLM sees all prior exchanges and doesn't repeat questions.
    let llmMessages: LLMMessage[];
    if (hasPromptOverride && Array.isArray(body.conversation_history) && body.conversation_history.length > 0) {
      llmMessages = body.conversation_history.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: m.content,
      }));
      // Add the current user message at the end
      llmMessages.push({ role: "user", content: effectiveQuery });
    } else {
      llmMessages = [{ role: "user", content: userMessage }];
    }

    let llmResponse: Response;
    try {
      llmResponse = await streamLLM(
        _currentLLMConfig!,
        NERA_SYSTEM_PROMPT,
        llmMessages,
        hasPromptOverride ? 4096 : 2048  // More tokens for insight card
      );
    } catch (streamErr) {
      const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
      console.error("LLM streaming error:", errMsg);
      return jsonResponse(
        {
          type: "answer",
          answer: "I'm sorry, I encountered an error generating a response. Please try again.",
          sources: [],
          _debug: errMsg,
        },
        200
      );
    }

    // Stream SSE response to client
    const encoder = new TextEncoder();

    const sseStream = new ReadableStream({
      async start(controller) {
        // Send meta event with sources and query_id
        controller.enqueue(
          encoder.encode(sseEvent("meta", { type: "answer", sources, query_id: answerQueryId }))
        );

        let fullText = "";

        try {
          for await (const delta of parseStreamDeltas(llmResponse, _currentLLMConfig!.provider)) {
            fullText += delta.text;
            controller.enqueue(encoder.encode(sseEvent("delta", { text: delta.text })));
          }
        } catch (streamErr) {
          const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
          console.error("Stream processing error:", errMsg);
          controller.enqueue(encoder.encode(sseEvent("error", { message: errMsg })));
        }

        // Log completed query
        const latency = Date.now() - startTime;
        const finalResponseText = fullText || "Stream error — no content";
        const loggedQueryId = await logQuery(supabase, {
          id: answerQueryId,
          session_id,
          user_id,
          query_text: query,
          response_text: finalResponseText,
          chunks_used: chunks.map((c) => c.id),
          sources_cited: sources,
          retrieval_method: retrievalMethod,
          detected_intent: classified.intent,
          detected_pathway: classified.pathway,
          detected_classification: classified.classification,
          detected_mm_category: classified.mm_category,
          response_latency_ms: latency,
          response_type: "answer",
          clarification_options: null,
          turn_number: merged.turnNumber,
          accumulated_context: merged.accumulatedContext,
        });

        const gapSignal = detectContentGapSignal({
          queryText: query,
          responseText: finalResponseText,
          retrievalMethod,
          classified,
          sources,
        });

        if (gapSignal && (loggedQueryId || answerQueryId)) {
          await logContentGapSignal(supabase, {
            query_id: loggedQueryId || answerQueryId,
            session_id,
            user_id,
            query_text: query,
            gap_type: gapSignal.gap_type,
            topic: gapSignal.topic,
            detected_intent: classified.intent,
            detected_pathway: classified.pathway,
            detected_classification: classified.classification,
            suggested_resource_type: gapSignal.suggested_resource_type,
            confidence_score: gapSignal.confidence,
            related_sources: sources,
            reason: gapSignal.reason,
          });
        }

        controller.enqueue(encoder.encode(sseEvent("done", {})));
        controller.close();
      },
    });

    return new Response(sseStream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg === "Missing bearer token" || errMsg === "Invalid bearer token") {
      return jsonResponse({ error: errMsg }, 401);
    }
    if (errMsg === "User profile not found" || errMsg === "Insufficient permissions") {
      return jsonResponse({ error: errMsg }, 403);
    }
    console.error("nera-query error:", errMsg);
    return jsonResponse(
      {
        type: "answer",
        answer:
          "I'm sorry, I encountered an unexpected error processing your question. Please try again.",
        sources: [],
        _debug: errMsg,
      },
      200 // Return 200 so the frontend displays the message rather than a generic error
    );
  }
});
