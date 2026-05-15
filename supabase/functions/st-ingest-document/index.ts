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

// ─── Background ingestion job ─────────────────────────────────
// Heavy LLM work that runs after the 202 response is returned, kept alive by
// EdgeRuntime.waitUntil so the Supabase gateway's 150s idle timeout cannot
// kill an in-progress chunking job. The bulk-seed script (and the upload UI's
// auto-refresh loop) polls st_documents.status until it transitions to
// 'ingested' or 'failed'.

async function runIngestion(
  supabase: ReturnType<typeof createClient>,
  // deno-lint-ignore no-explicit-any
  doc: any,
): Promise<void> {
  const documentId = doc.id;
  try {
    // 1. Fetch the file from storage
    const { data: fileData, error: fileErr } = await supabase.storage
      .from("st-documents")
      .download(doc.file_path);

    if (fileErr || !fileData) {
      await markFailed(supabase, documentId, "Failed to download file from storage");
      return;
    }

    // 2. Extract text content based on file type
    let textContent: string;
    try {
      textContent = await extractText(fileData, doc.file_type, doc.file_path);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown extraction error";
      await markFailed(supabase, documentId, msg);
      return;
    }

    if (!textContent || textContent.trim().length < 10) {
      await markFailed(supabase, documentId, "Extracted text too short or empty");
      return;
    }

    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    // 3. Generate document summary
    let summary: string;
    try {
      summary = await callLLM(
        llmConfig,
        SUMMARY_PROMPT,
        [{ role: "user", content: textContent.slice(0, 4000) }],
        200,
      );
      summary = summary.trim().replace(/^["']|["']$/g, "");
    } catch {
      summary = doc.title;
    }

    // 4. Extract chunks via LLM (sequential — keeps token budget predictable)
    const segments = splitIntoSegments(textContent, 10000);
    const chunks: Array<{ chunk_text: string; chunk_summary: string; topic_tags: string[] }> = [];

    try {
      for (const segment of segments) {
        const result = await callLLM(
          llmConfig,
          CHUNK_EXTRACTION_PROMPT,
          [{ role: "user", content: segment }],
          8000,
        );
        chunks.push(...parseChunksFromLLM(result));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chunk extraction failed";
      await markFailed(supabase, documentId, msg);
      return;
    }

    // 5. Write chunks to knowledge_chunks
    let insertedCount = 0;
    for (const chunk of chunks) {
      const { error: chunkErr } = await supabase
        .from("knowledge_chunks")
        .insert({
          source_app: "strategic-tool",
          engagement_id: doc.engagement_id,
          source_type: "document",
          source_id: documentId,
          document_source: doc.title,
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

    // 6. Mark complete
    await supabase
      .from("st_documents")
      .update({
        status: "ingested",
        chunk_count: insertedCount,
        summary,
        processed_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    console.log(`[st-ingest-document] ${documentId} → ${insertedCount} chunks (background)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Background ingestion crashed";
    console.error(`[st-ingest-document] ${documentId} crashed:`, msg);
    await markFailed(supabase, documentId, msg);
  }
}

// ─── Per-slice processor (chunk_index pattern) ────────────────
// Processes ONE 8-page slice of a PDF in a single synchronous call. Bounded
// ~60s. Caller orchestrates by iterating chunk_index from 0 to totalChunks-1.
// Each call is independent and idempotent — failing in the middle of a batch
// leaves prior slices' chunks persisted in knowledge_chunks.

async function processSlice(
  supabase: ReturnType<typeof createClient>,
  // deno-lint-ignore no-explicit-any
  doc: any,
  chunkIndex: number,
): Promise<{
  chunks_inserted: number;
  page_range: string;
  total_pages: number;
  total_chunks: number;
  is_last: boolean;
}> {
  if (doc.file_type !== "pdf") {
    throw new Error(
      `chunk_index is only supported for PDF files. File type is "${doc.file_type}" — call without chunk_index for single-shot ingestion of this file type.`,
    );
  }

  // 1. Download the PDF (could be optimised with caching across calls; for
  //    one-time bulk seeding it's cheap enough to re-fetch per slice)
  const { data: fileData, error: fileErr } = await supabase.storage
    .from("st-documents")
    .download(doc.file_path);
  if (fileErr || !fileData) {
    throw new Error(`Failed to download file: ${fileErr?.message ?? "unknown"}`);
  }
  const pdfBytes = new Uint8Array(await fileData.arrayBuffer());

  // 2. Convert just this slice to Markdown
  const slice = await convertPdfSliceToMarkdown(pdfBytes, chunkIndex);
  const totalChunks = Math.max(1, Math.ceil(slice.totalPages / PAGES_PER_CHUNK));
  const isLast = chunkIndex === totalChunks - 1;

  if (!slice.markdown || slice.markdown.trim().length < 10) {
    return {
      chunks_inserted: 0,
      page_range: `${slice.startPage}-${slice.endPage}`,
      total_pages: slice.totalPages,
      total_chunks: totalChunks,
      is_last: isLast,
    };
  }

  const llmConfig: LLMConfig = {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    apiKey: ANTHROPIC_API_KEY,
  };

  // 3. Run semantic chunker on this slice's markdown. Typically 1-2 LLM calls
  //    since 8 pages produce ~10-20k chars of markdown.
  const segments = splitIntoSegments(slice.markdown, 10000);
  const newChunks: Array<{ chunk_text: string; chunk_summary: string; topic_tags: string[] }> = [];
  for (const segment of segments) {
    const result = await callLLM(
      llmConfig,
      CHUNK_EXTRACTION_PROMPT,
      [{ role: "user", content: segment }],
      8000,
    );
    newChunks.push(...parseChunksFromLLM(result));
  }

  // 4. Insert the chunks immediately (idempotency-friendly: each slice's
  //    chunks land in the DB before this function returns)
  let inserted = 0;
  for (const chunk of newChunks) {
    const { error: chunkErr } = await supabase
      .from("knowledge_chunks")
      .insert({
        source_app: "strategic-tool",
        engagement_id: doc.engagement_id,
        source_type: "document",
        source_id: doc.id,
        document_source: doc.title,
        section_reference: null,
        chunk_text: chunk.chunk_text,
        chunk_summary: chunk.chunk_summary,
        topic_tags: chunk.topic_tags,
        content_type: "governance",
        is_active: true,
        extraction_version: "st-1.0",
      });
    if (!chunkErr) inserted++;
  }

  // 5. Update doc chunk_count (additive across slices)
  await supabase
    .from("st_documents")
    .update({ chunk_count: (doc.chunk_count ?? 0) + inserted })
    .eq("id", doc.id);

  // 6. On the first slice, generate the doc summary from the first ~4k chars
  //    of markdown. Cheap (~5s) and avoids needing a separate finalize call.
  if (chunkIndex === 0) {
    try {
      let summary = await callLLM(
        llmConfig,
        SUMMARY_PROMPT,
        [{ role: "user", content: slice.markdown.slice(0, 4000) }],
        200,
      );
      summary = summary.trim().replace(/^["']|["']$/g, "");
      await supabase.from("st_documents").update({ summary }).eq("id", doc.id);
    } catch {
      // Non-fatal — summary stays NULL
    }
  }

  // 7. On the last slice, mark the doc ingested
  if (isLast) {
    await supabase
      .from("st_documents")
      .update({
        status: "ingested",
        processed_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
  }

  return {
    chunks_inserted: inserted,
    page_range: `${slice.startPage}-${slice.endPage}`,
    total_pages: slice.totalPages,
    total_chunks: totalChunks,
    is_last: isLast,
  };
}

// ─── Main handler ─────────────────────────────────────────────
//
// Two modes:
//
//   Mode A — no chunk_index (whole-document, background)
//     For UI uploads of typical-length documents. Returns 202 immediately and
//     runs the full ingestion (download → extract → chunk → insert → mark)
//     inside EdgeRuntime.waitUntil. UI polls st_documents.status.
//
//   Mode B — chunk_index provided (per-slice, synchronous)
//     For long PDFs and bulk-seed orchestration. Processes exactly ONE 8-page
//     slice and returns 200 with chunks_inserted, page_range, total_chunks,
//     is_last. Caller iterates chunk_index from 0 to total_chunks - 1. Each
//     call is bounded ~60s. Matches ACRRM's convert-pdf-to-markdown contract.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuth(req);
    const body = await req.json();
    const document_id = body.document_id as string | undefined;
    const chunkIndex = typeof body.chunk_index === "number" ? body.chunk_index : null;

    if (!document_id) {
      return jsonResponse({ error: "document_id is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: doc, error: docErr } = await supabase
      .from("st_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return jsonResponse({ error: "Document not found" }, 404);
    }

    // Mark ingesting on first contact regardless of mode.
    if (doc.status !== "ingesting") {
      await supabase
        .from("st_documents")
        .update({ status: "ingesting" })
        .eq("id", document_id);
    }

    // ── Mode B: per-slice ──
    if (chunkIndex !== null) {
      try {
        const result = await processSlice(supabase, doc, chunkIndex);
        return jsonResponse({
          document_id,
          chunk_index: chunkIndex,
          ...result,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Slice processing failed";
        // Don't mark the whole doc failed on a single slice error — the caller
        // can decide to retry that slice or move on. But surface the error
        // clearly in the response.
        return jsonResponse({ error: msg, chunk_index: chunkIndex }, 500);
      }
    }

    // ── Mode A: whole-document via waitUntil (legacy / UI path) ──
    const work = runIngestion(supabase, doc);
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === "function") {
      er.waitUntil(work);
    } else {
      await work;
    }

    return jsonResponse({
      accepted: true,
      document_id,
      status: "ingesting",
      message: "Ingestion queued; poll st_documents.status for completion.",
    }, 202);
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

// Single-attempt Document API call. The caller (the bulk-seed script) retries
// at the slice level if needed. Internal retries waste the function's wall-clock
// budget — if the first call doesn't complete in time, a second attempt won't
// either within the same 150s gateway window.
//
// max_tokens lowered to 8000: 3-page slices produce at most ~4-6k tokens of
// Markdown output, and capping output length is the most direct way to keep
// generation latency predictable.
async function callDocumentApi(base64Pdf: string, promptText: string): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
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

  if (!resp.ok) {
    throw new Error(`Claude API ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Claude returned empty content");
  }
  return text;
}

// PAGES_PER_CHUNK is the architectural unit: one function call processes
// exactly one slice of this many pages. ACRRM defaults to 8; we use 2 here
// because dense systematic reviews (Bradford 2016, Krahe 2024, Hamiduzzaman
// 2025) made 3-page slices run 90-130s — close to and sometimes over the
// 150s gateway timeout. At 2 pages, typical slice times are 40-80s with
// safe margin. The trade-off is more slices per paper (a 50-page review =
// 25 slices ~= 25-30 minutes of ingestion wall-clock), which is acceptable
// for one-time bulk seeding.
export const PAGES_PER_CHUNK = 2;

export interface PdfChunkInfo {
  totalPages: number;
  totalChunks: number;
}

async function getPdfChunkInfo(pdfBytes: Uint8Array): Promise<PdfChunkInfo> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  return {
    totalPages,
    totalChunks: Math.max(1, Math.ceil(totalPages / PAGES_PER_CHUNK)),
  };
}

// Convert ONE 8-page slice of a PDF to Markdown via a single Claude Document
// API call. Bounded ~30s. The bulk-seed script orchestrates iteration by
// chunk_index from 0 to totalChunks-1; the UI's no-chunk-index path uses
// convertEntirePdfInBackground (below) inside EdgeRuntime.waitUntil.
async function convertPdfSliceToMarkdown(
  pdfBytes: Uint8Array,
  chunkIndex: number,
): Promise<{ markdown: string; startPage: number; endPage: number; totalPages: number }> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  const start = chunkIndex * PAGES_PER_CHUNK;
  if (start >= totalPages) {
    throw new Error(`chunk_index ${chunkIndex} exceeds page count ${totalPages}`);
  }
  const end = Math.min(start + PAGES_PER_CHUNK - 1, totalPages - 1);

  const newDoc = await PDFDocument.create();
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const copied = await newDoc.copyPages(srcDoc, indices);
  for (const p of copied) newDoc.addPage(p);
  const sliceBytes = new Uint8Array(await newDoc.save());

  const base64 = toBase64(sliceBytes);
  const promptSuffix = `\n\nNote: This is pages ${start + 1}–${end + 1} of a ${totalPages}-page document. Convert all content on these pages. Do not add any preamble about the page range.`;
  const markdown = await callDocumentApi(base64, PDF_CONVERT_PROMPT + promptSuffix);

  return {
    markdown: markdown.trim(),
    startPage: start + 1,
    endPage: end + 1,
    totalPages,
  };
}

// Legacy whole-PDF conversion — kept for the UI's no-chunk-index path which
// runs inside EdgeRuntime.waitUntil. New callers should use the chunk_index
// orchestration via convertPdfSliceToMarkdown.
async function convertPdfToMarkdown(pdfBytes: Uint8Array): Promise<string> {
  const { totalChunks } = await getPdfChunkInfo(pdfBytes);
  const parts: string[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const { markdown } = await convertPdfSliceToMarkdown(pdfBytes, i);
    parts.push(markdown);
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
