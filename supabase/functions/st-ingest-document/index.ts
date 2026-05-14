import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
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
      // Binary PDFs: route through Claude's Document API in 8-page chunks
      // (pattern ported from acrrm-resources-pwa/supabase/functions/convert-pdf-to-markdown).
      // Each chunk returns Markdown which is concatenated and fed downstream
      // to the same semantic chunker used for plaintext.
      const pdfBytes = new Uint8Array(await blob.arrayBuffer());
      return await convertPdfToMarkdown(pdfBytes);
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

// ─── PDF → Markdown (Claude Document API, 8-page chunks) ──────
// Ported from acrrm-resources-pwa/supabase/functions/convert-pdf-to-markdown.
// Loads the PDF with pdf-lib, slices into 8-page sub-PDFs, base64-encodes each,
// and sends to Claude via the Document API. Returns the concatenated Markdown.

const PDF_CONVERT_PROMPT = `Convert this PDF document to clean Markdown. Preserve ALL substantive content precisely:

1. Use ## for major section headings and ### for sub-sections
2. Preserve all tables using Markdown table syntax
3. Keep exact figures, rates, percentages, sample sizes, p-values, and dollar amounts verbatim
4. Preserve numbered and bulleted lists exactly as they appear
5. Include ALL substantive content — abstract, body sections, tables, figures' captions, conclusions, references
6. Do NOT summarise, skip, or paraphrase any content
7. STRIP repeating page headers, footers, page numbers, journal banners, and PDF watermarks — these are artefacts, not content
8. Use Australian English spelling

Return ONLY the Markdown. No commentary, no explanations, no markdown fences wrapping the output.`;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function callDocumentApiWithRetry(
  base64Pdf: string,
  promptText: string,
  maxRetries = 2,
): Promise<string> {
  let lastErr: string = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 32000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Pdf,
                },
              },
              { type: "text", text: promptText },
            ],
          },
        ],
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const text = data?.content?.[0]?.text;
      if (typeof text === "string" && text.length > 0) return text;
      lastErr = "Claude returned empty content";
    } else {
      lastErr = `Claude API ${resp.status}: ${(await resp.text()).slice(0, 300)}`;
    }

    if (attempt < maxRetries) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error(`PDF→Markdown failed after ${maxRetries + 1} attempts: ${lastErr}`);
}

async function convertPdfToMarkdown(pdfBytes: Uint8Array): Promise<string> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  const chunkSize = 8;

  const parts: string[] = [];
  for (let start = 0; start < totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, totalPages - 1);
    const newDoc = await PDFDocument.create();
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const copied = await newDoc.copyPages(srcDoc, indices);
    for (const p of copied) newDoc.addPage(p);
    const chunkBytes = new Uint8Array(await newDoc.save());

    const base64 = toBase64(chunkBytes);
    const promptSuffix = `\n\nNote: This is pages ${start + 1}–${end + 1} of a ${totalPages}-page document. Convert all content on these pages. Do not add any preamble about the page range.`;
    const md = await callDocumentApiWithRetry(base64, PDF_CONVERT_PROMPT + promptSuffix);
    parts.push(md.trim());
  }

  return parts.join("\n\n");
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
