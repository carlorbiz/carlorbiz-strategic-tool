import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

// ─── Environment ──────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Config ───────────────────────────────────────────────────
const PAGES_PER_CHUNK = 8;
const MAX_RETRIES = 2;
const MAX_OUTPUT_TOKENS = 32000;

// Optional section markers for validation — pass via request body for document-specific checks.
// If not provided, validation is skipped (generic PDF processing mode).

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

async function requireInternalAdmin(req: Request): Promise<{ userId: string; email?: string | null }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Missing bearer token");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    throw new Error("Invalid bearer token");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, email")
    .eq("user_id", authData.user.id)
    .single();
  if (profileError || !profile) {
    throw new Error("User profile not found");
  }
  if (profile.role !== "internal_admin") {
    throw new Error("Insufficient permissions");
  }

  return { userId: authData.user.id, email: profile.email };
}

// ─── PDF conversion prompt ────────────────────────────────────

const CONVERT_PROMPT = `Convert this entire PDF document to clean Markdown. Preserve ALL substantive content precisely:

1. Use ## for major section headings (numbered clauses like "6. Leave Entitlements")
2. Use ### for sub-sections (like "6.1 Annual leave")
3. Preserve all tables using Markdown table syntax
4. Keep exact figures, rates, percentages, and dollar amounts — regulatory precision is critical
5. Preserve numbered and bulleted lists exactly as they appear
6. Keep clause numbering exactly as printed
7. Include ALL substantive content — preamble, body sections, schedules, appendices, signatures
8. Do NOT summarise, skip, or paraphrase any content
9. Use Australian English spelling throughout
10. STRIP OUT all repeating page headers, page footers, page numbers, and document metadata that appears on every page (e.g. "Page 1 of 5", author/company lines in headers/footers, copyright footers, watermarks). These are PDF artefacts, not content.

Return ONLY the Markdown. No commentary, no explanations, no markdown fences wrapping the output.`;

// ─── PDF page extraction ──────────────────────────────────────

async function extractPageRange(
  srcDoc: InstanceType<typeof PDFDocument>,
  startIdx: number,
  endIdx: number
): Promise<Uint8Array> {
  const pageIndices: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    pageIndices.push(i);
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((page: any) => newDoc.addPage(page));

  const newBytes = await newDoc.save();
  return new Uint8Array(newBytes);
}

// ─── Base64 encoding ──────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// ─── Convert a single chunk via Claude ────────────────────────

interface ChunkResult {
  index: number;
  pageRange: string;
  markdown: string;
  inputTokens: number;
  outputTokens: number;
}

async function convertChunk(
  chunkBytes: Uint8Array,
  chunkIndex: number,
  startPage: number,
  endPage: number,
  totalPages: number
): Promise<ChunkResult> {
  const base64 = toBase64(chunkBytes);
  const pageRange = `${startPage}-${endPage}`;

  const promptSuffix = `\n\nNote: This is pages ${pageRange} of ${totalPages} in the document. Convert all content on these pages completely. Do not add any introduction or preamble about the page range. Do not add a trailing note about continuation.`;

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: CONVERT_PROMPT + promptSuffix,
            },
          ],
        },
      ],
    }),
  });

  if (!claudeResponse.ok) {
    const errText = await claudeResponse.text();
    throw new Error(
      `Claude API error ${claudeResponse.status} for pages ${pageRange}: ${errText.slice(0, 200)}`
    );
  }

  const claudeData = await claudeResponse.json();
  const markdown = claudeData.content
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("");

  const usage = claudeData.usage ?? { input_tokens: 0, output_tokens: 0 };

  return {
    index: chunkIndex,
    pageRange,
    markdown,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}

// ─── Convert chunk with retry ─────────────────────────────────

async function convertChunkWithRetry(
  chunkBytes: Uint8Array,
  chunkIndex: number,
  startPage: number,
  endPage: number,
  totalPages: number
): Promise<ChunkResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry ${attempt}/${MAX_RETRIES} for chunk ${chunkIndex} (pages ${startPage}-${endPage})`);
        // Brief delay before retry
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
      return await convertChunk(chunkBytes, chunkIndex, startPage, endPage, totalPages);
    } catch (err) {
      lastError = err as Error;
      console.error(`Chunk ${chunkIndex} attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }

  throw new Error(
    `Chunk ${chunkIndex} (pages ${startPage}-${endPage}) failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

// ─── Validation ───────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  missingSections: string[];
  foundSections: string[];
}

function validateMarkdown(markdown: string, requiredSections: string[]): ValidationResult {
  if (requiredSections.length === 0) {
    return { valid: true, missingSections: [], foundSections: [] };
  }

  const normalised = markdown.toLowerCase();
  const missing: string[] = [];
  const found: string[] = [];

  requiredSections.forEach((section) => {
    if (normalised.includes(section.toLowerCase())) {
      found.push(section);
    } else {
      missing.push(section);
    }
  });

  return {
    valid: missing.length === 0,
    missingSections: missing,
    foundSections: found,
  };
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
    const body = await req.json();
    const { tab_id, pdf_url, save, pages_per_chunk, required_sections } = body;
    const chunkSize = pages_per_chunk ?? PAGES_PER_CHUNK;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── Resolve PDF URL ────────────────────────────────────
    let resolvedUrl: string | null = pdf_url ?? null;
    let tabSlug: string | null = null;
    let tabId: string | null = tab_id ?? null;

    if (tab_id && !pdf_url) {
      const { data: tab, error: tabError } = await supabase
        .from("tabs")
        .select("id, slug, label, file_url")
        .eq("id", tab_id)
        .single();

      if (tabError || !tab) {
        return jsonResponse({ error: `Tab not found: ${tab_id}` }, 404);
      }
      if (!tab.file_url) {
        return jsonResponse(
          { error: `Tab "${tab.slug}" has no file_url` },
          400
        );
      }
      resolvedUrl = tab.file_url;
      tabSlug = tab.slug;
    }

    if (!resolvedUrl) {
      return jsonResponse({ error: "tab_id or pdf_url is required" }, 400);
    }

    // ─── Step 1: Download PDF ───────────────────────────────
    console.log(`Downloading PDF: ${resolvedUrl}`);
    const pdfResponse = await fetch(resolvedUrl);
    if (!pdfResponse.ok) {
      return jsonResponse(
        { error: `Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}` },
        502
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);
    const pdfSizeKB = Math.round(pdfBytes.length / 1024);
    console.log(`PDF downloaded: ${pdfSizeKB}KB`);

    // ─── Step 2: Split into chunks ──────────────────────────
    const srcDoc = await PDFDocument.load(pdfBytes);
    const totalPages = srcDoc.getPageCount();
    console.log(`PDF has ${totalPages} pages, splitting into ${chunkSize}-page chunks`);

    const chunks: { bytes: Uint8Array; startPage: number; endPage: number }[] = [];
    for (let start = 0; start < totalPages; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, totalPages - 1);
      const chunkBytes = await extractPageRange(srcDoc, start, end);
      chunks.push({
        bytes: chunkBytes,
        startPage: start + 1, // 1-indexed for display
        endPage: end + 1,
      });
    }
    console.log(`Split into ${chunks.length} chunks`);

    // ─── Step 3: Process ALL chunks in parallel with retry ──
    const chunkPromises = chunks.map((chunk, index) =>
      convertChunkWithRetry(
        chunk.bytes,
        index,
        chunk.startPage,
        chunk.endPage,
        totalPages
      )
    );

    const results = await Promise.all(chunkPromises);

    // Sort by index (should already be in order, but be safe)
    results.sort((a, b) => a.index - b.index);

    // ─── Step 4: Concatenate ────────────────────────────────
    const fullMarkdown = results.map((r) => r.markdown).join("\n\n");
    const totalInputTokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = results.reduce((sum, r) => sum + r.outputTokens, 0);

    console.log(
      `All ${results.length} chunks complete: ${fullMarkdown.length} chars, ${totalInputTokens} in / ${totalOutputTokens} out`
    );

    // ─── Step 5: Validate completeness (if sections provided) ──
    const sectionsToValidate: string[] = Array.isArray(required_sections) ? required_sections : [];
    const validation = validateMarkdown(fullMarkdown, sectionsToValidate);

    if (!validation.valid) {
      console.error(
        `VALIDATION FAILED — missing sections: ${validation.missingSections.join(", ")}`
      );
      // Still return the markdown but flag the error
      return jsonResponse({
        success: false,
        error: `Incomplete conversion — missing sections: ${validation.missingSections.join(", ")}`,
        markdown: fullMarkdown,
        chars: fullMarkdown.length,
        total_pages: totalPages,
        chunks_processed: results.length,
        chunk_details: results.map((r) => ({
          pages: r.pageRange,
          chars: r.markdown.length,
          tokens: { input: r.inputTokens, output: r.outputTokens },
        })),
        validation,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
        pdf_size_kb: pdfSizeKB,
        saved: false,
      });
    }

    if (sectionsToValidate.length > 0) {
      console.log(
        `Validation PASSED: ${validation.foundSections.length}/${sectionsToValidate.length} sections found`
      );
    }

    // ─── Step 6: Optionally save ────────────────────────────
    let saved = false;
    if (save && tabId) {
      const { error: updateError } = await supabase
        .from("tabs")
        .update({ content: fullMarkdown })
        .eq("id", tabId);

      if (updateError) {
        console.error("Failed to save markdown to tab:", updateError);
      } else {
        saved = true;
        console.log(`Saved markdown to tab ${tabSlug ?? tabId}`);
      }
    }

    return jsonResponse({
      success: true,
      markdown: fullMarkdown,
      chars: fullMarkdown.length,
      total_pages: totalPages,
      chunks_processed: results.length,
      chunk_details: results.map((r) => ({
        pages: r.pageRange,
        chars: r.markdown.length,
        tokens: { input: r.inputTokens, output: r.outputTokens },
      })),
      validation,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
      pdf_size_kb: pdfSizeKB,
      saved,
      tab_slug: tabSlug,
    });
  } catch (error) {
    const message = (error as Error).message || "Unknown error";
    if (message === "Missing bearer token" || message === "Invalid bearer token") {
      return jsonResponse({ error: message }, 401);
    }
    if (message === "User profile not found" || message === "Insufficient permissions") {
      return jsonResponse({ error: message }, 403);
    }
    console.error("process-pdf error:", error);
    return jsonResponse({ error: `Processing failed: ${message}` }, 500);
  }
});
