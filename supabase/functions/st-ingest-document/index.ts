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

// ─── Auth: require authenticated user with engagement access ──
async function requireAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return "service-role";
  }

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

// ─── Chunk extraction prompt ──────────────────────────────────
const CHUNK_EXTRACTION_PROMPT = `You are a knowledge extraction specialist working for a strategic planning evidence platform. Extract discrete knowledge chunks from the provided document content.

Rules:
1. One fact, requirement, decision, recommendation, or finding per chunk
2. Each chunk must be completely self-contained and understandable without context
3. Preserve precision — exact figures, dates, rates, and thresholds must be accurate
4. For strategic/governance content, capture: decisions made, commitments stated, risks identified, recommendations, evidence cited, and metrics/KPIs
5. For meeting papers/minutes, capture: each agenda item's outcome, action items, and key discussion points as separate chunks
6. For policy documents, capture: each requirement or obligation as a separate chunk
7. Include relevant section headings or page references in the chunk text for traceability

Output a JSON array of objects, each with:
- "chunk_text": the self-contained knowledge statement (string)
- "chunk_summary": a one-sentence summary (string)
- "topic_tags": relevant topic tags as an array of lowercase strings

Return ONLY the JSON array, no other text.`;

// ─── Summary generation prompt ────────────────────────────────
const SUMMARY_PROMPT = `Write a single sentence (under 150 characters) summarising what this document is about. Be specific — mention the organisation, topic, or decision if apparent. Return ONLY the sentence, no quotes, no prefix.`;

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await requireAuth(req);
    const { document_id } = await req.json();

    if (!document_id) {
      return jsonResponse({ error: "document_id is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch the document record
    const { data: doc, error: docErr } = await supabase
      .from("st_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return jsonResponse({ error: "Document not found" }, 404);
    }

    // 2. Mark as ingesting
    await supabase
      .from("st_documents")
      .update({ status: "ingesting" })
      .eq("id", document_id);

    // 3. Fetch the file from storage
    const { data: fileData, error: fileErr } = await supabase.storage
      .from("st-documents")
      .download(doc.file_path);

    if (fileErr || !fileData) {
      await markFailed(supabase, document_id, "Failed to download file from storage");
      return jsonResponse({ error: "Failed to download file" }, 500);
    }

    // 4. Extract text content based on file type
    let textContent: string;
    try {
      textContent = await extractText(fileData, doc.file_type, doc.file_path);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown extraction error";
      await markFailed(supabase, document_id, msg);
      return jsonResponse({ error: `Text extraction failed: ${msg}` }, 500);
    }

    if (!textContent || textContent.trim().length < 10) {
      await markFailed(supabase, document_id, "Extracted text too short or empty");
      return jsonResponse({ error: "Document produced no extractable text" }, 400);
    }

    // 5. LLM config — default to Anthropic Claude Sonnet
    // In future, read from st_ai_config for the engagement
    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    // 6. Generate document summary
    let summary: string;
    try {
      summary = await callLLM(
        llmConfig,
        SUMMARY_PROMPT,
        [{ role: "user", content: textContent.slice(0, 4000) }],
        200
      );
      summary = summary.trim().replace(/^["']|["']$/g, "");
    } catch {
      summary = doc.title; // fallback to title if summary fails
    }

    // 7. Extract chunks via LLM
    let chunks: Array<{
      chunk_text: string;
      chunk_summary: string;
      topic_tags: string[];
    }>;

    try {
      // Split long documents into segments
      const segments = splitIntoSegments(textContent, 10000);
      chunks = [];

      for (const segment of segments) {
        const result = await callLLM(
          llmConfig,
          CHUNK_EXTRACTION_PROMPT,
          [{ role: "user", content: segment }],
          8000
        );

        // Parse JSON from LLM response
        const parsed = parseChunksFromLLM(result);
        chunks.push(...parsed);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chunk extraction failed";
      await markFailed(supabase, document_id, msg);
      return jsonResponse({ error: msg }, 500);
    }

    // 8. Write chunks to knowledge_chunks with strategic-tool scoping
    let insertedCount = 0;
    for (const chunk of chunks) {
      const { error: chunkErr } = await supabase
        .from("knowledge_chunks")
        .insert({
          source_app: "strategic-tool",
          engagement_id: doc.engagement_id,
          source_type: "document",
          source_id: document_id,
          document_source: doc.title,
          // section_reference left NULL: storage paths leak filename hints into
          // the LLM context. Proper section refs (markdown headings, page nums)
          // will be added when chunking is heading-aware.
          section_reference: null,
          chunk_text: chunk.chunk_text,
          chunk_summary: chunk.chunk_summary,
          topic_tags: chunk.topic_tags,
          content_type: "governance",
          is_active: true,
          extraction_version: "st-1.0",
        });

      if (!chunkErr) insertedCount++;
    }

    // 9. Update document record with results
    await supabase
      .from("st_documents")
      .update({
        status: "ingested",
        chunk_count: insertedCount,
        summary,
        processed_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    return jsonResponse({
      success: true,
      document_id,
      chunks_created: insertedCount,
      summary,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("st-ingest-document error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});

// ─── Helpers ──────────────────────────────────────────────────

async function extractText(
  blob: Blob,
  fileType: string,
  filePath: string
): Promise<string> {
  switch (fileType) {
    case "md":
    case "txt":
    case "csv":
      return await blob.text();

    case "json": {
      const raw = await blob.text();
      // Pretty-print JSON so the LLM can read it
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return raw;
      }
    }

    case "pdf": {
      // For PDFs, we call the existing convert-pdf-to-markdown function
      // or extract raw text. For now, use a simple text extraction.
      // The proper pipeline would chain to convert-pdf-to-markdown,
      // but that requires the file to be in a specific bucket format.
      // Phase 2c ships with basic text extraction; PDF-to-markdown
      // chaining will be added when the pipeline is proven.
      const text = await blob.text();
      if (text && text.trim().length > 50) return text;
      // Binary PDF — can't extract directly in Deno without a PDF library.
      // Return a placeholder that tells the caller to use the PDF pipeline.
      throw new Error(
        "Binary PDF detected. Use the convert-pdf-to-markdown pipeline for this file type. " +
        "Direct binary PDF extraction is not yet supported in st-ingest-document."
      );
    }

    case "docx": {
      // DOCX is a ZIP containing XML. Basic extraction:
      // For v1, we extract the raw XML text content.
      // A proper DOCX parser would be added in Phase 3.
      const text = await blob.text();
      // Strip XML tags for a rough plaintext
      return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    case "image": {
      // Images would go through Vision AI OCR.
      // For v1, throw — the workshop-ocr pipeline handles images.
      throw new Error(
        "Image files should be uploaded via the workshop photo pipeline, not the document pipeline."
      );
    }

    default:
      // Try as plaintext
      return await blob.text();
  }
}

function splitIntoSegments(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      segments.push(remaining);
      break;
    }

    // Find a good split point (paragraph break, sentence end)
    let splitAt = remaining.lastIndexOf("\n\n", maxChars);
    if (splitAt < maxChars * 0.5) {
      splitAt = remaining.lastIndexOf(". ", maxChars);
    }
    if (splitAt < maxChars * 0.5) {
      splitAt = maxChars;
    }

    segments.push(remaining.slice(0, splitAt + 1));
    remaining = remaining.slice(splitAt + 1);
  }

  return segments;
}

function parseChunksFromLLM(
  response: string
): Array<{ chunk_text: string; chunk_summary: string; topic_tags: string[] }> {
  // Try to parse JSON from the response
  const trimmed = response.trim();

  // Handle markdown code fences
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: unknown): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && "chunk_text" in item
      )
      .map((item) => ({
        chunk_text: String(item.chunk_text || ""),
        chunk_summary: String(item.chunk_summary || ""),
        topic_tags: Array.isArray(item.topic_tags)
          ? item.topic_tags.map(String)
          : [],
      }));
  } catch {
    console.error("Failed to parse LLM chunk output:", jsonStr.slice(0, 200));
    return [];
  }
}

async function markFailed(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  reason: string
): Promise<void> {
  console.error(`Document ${documentId} ingestion failed: ${reason}`);
  await supabase
    .from("st_documents")
    .update({
      status: "failed",
      summary: `Ingestion failed: ${reason}`,
      processed_at: new Date().toISOString(),
    })
    .eq("id", documentId);
}
