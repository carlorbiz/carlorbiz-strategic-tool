import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

// ─── Environment ──────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

// ─── PDF conversion prompt ────────────────────────────────────

const CONVERT_PROMPT = `Convert this entire PDF document to clean Markdown for an Australian GP training handbook. Preserve ALL substantive content precisely:

1. Use ## for major section headings (numbered clauses like "6. Leave Entitlements")
2. Use ### for sub-sections (like "6.1 Annual leave")
3. Preserve all tables using Markdown table syntax
4. Keep exact figures, rates, percentages, and dollar amounts — regulatory precision is critical
5. Preserve numbered and bulleted lists exactly as they appear
6. Keep clause numbering exactly as printed
7. Include ALL substantive content — preamble, body sections, schedules, appendices, signatures
8. Do NOT summarise, skip, or paraphrase any content
9. Use Australian English spelling throughout
10. STRIP OUT all repeating page headers, page footers, page numbers, and document metadata that appears on every page (e.g. "Page 1 of 5", author/company lines in headers/footers, copyright footers, "CARLORBIZ" watermarks). These are PDF artefacts, not content.

Return ONLY the Markdown. No commentary, no explanations, no markdown fences wrapping the output.`;

// ─── PDF page extraction ──────────────────────────────────────

async function extractPageRange(
  pdfBytes: Uint8Array,
  startPage: number,
  endPage: number
): Promise<{ bytes: Uint8Array; totalPages: number }> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();

  // Clamp to valid range (1-indexed input → 0-indexed internal)
  const startIdx = Math.max(0, startPage - 1);
  const endIdx = Math.min(totalPages - 1, endPage - 1);

  if (startIdx > endIdx || startIdx >= totalPages) {
    throw new Error(
      `Invalid page range: ${startPage}-${endPage} (document has ${totalPages} pages)`
    );
  }

  // Build array of page indices to copy
  const pageIndices: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    pageIndices.push(i);
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  const newBytes = await newDoc.save();
  return { bytes: new Uint8Array(newBytes), totalPages };
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
    const { tab_id, pdf_url, save, start_page, end_page, pages_per_chunk, chunk_index } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve the PDF URL — either from tab_id or directly provided
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
        return jsonResponse({ error: `Tab "${tab.slug}" has no file_url — upload a PDF first` }, 400);
      }

      resolvedUrl = tab.file_url;
      tabSlug = tab.slug;
    }

    if (!resolvedUrl) {
      return jsonResponse({ error: "tab_id or pdf_url is required" }, 400);
    }

    // Step 1: Download the PDF
    console.log(`Downloading PDF: ${resolvedUrl}`);
    const pdfResponse = await fetch(resolvedUrl);

    if (!pdfResponse.ok) {
      return jsonResponse({
        error: `Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`,
      }, 502);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    let pdfBytes = new Uint8Array(pdfBuffer);
    const fullPdfSizeKB = Math.round(pdfBytes.length / 1024);

    // Step 2: Extract page range if specified
    let totalPages: number | null = null;
    let pageRange: string | null = null;

    if (start_page && end_page) {
      console.log(`Extracting pages ${start_page}-${end_page}...`);
      const result = await extractPageRange(pdfBytes, start_page, end_page);
      pdfBytes = result.bytes;
      totalPages = result.totalPages;
      pageRange = `${start_page}-${Math.min(end_page, totalPages)}`;
      console.log(`Extracted ${pageRange} of ${totalPages} pages (${Math.round(pdfBytes.length / 1024)}KB)`);
    }

    // Step 3: Chunk the PDF for conversion (default 8 pages)
    const chunkSize = Math.max(2, Math.min(20, Number(pages_per_chunk) || 8));
    const srcDoc = await PDFDocument.load(pdfBytes);
    const fullPageCount = srcDoc.getPageCount();
    const chunksTotal = Math.max(1, Math.ceil(fullPageCount / chunkSize));
    console.log(`PDF has ${fullPageCount} pages. Chunk size: ${chunkSize}.`);

    const chunks: { bytes: Uint8Array; startPage: number; endPage: number }[] = [];
    if (typeof chunk_index === "number") {
      const idx = Math.max(0, Math.floor(chunk_index));
      const start = idx * chunkSize;
      if (start >= fullPageCount) {
        return jsonResponse({ error: `Invalid chunk_index ${idx} for ${fullPageCount} pages` }, 400);
      }
      const end = Math.min(start + chunkSize - 1, fullPageCount - 1);
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(
        srcDoc,
        Array.from({ length: end - start + 1 }, (_, i) => start + i)
      );
      copiedPages.forEach((page) => newDoc.addPage(page));
      const newBytes = await newDoc.save();
      chunks.push({
        bytes: new Uint8Array(newBytes),
        startPage: start + 1,
        endPage: end + 1,
      });
      pageRange = `${start + 1}-${end + 1}`;
    } else {
      for (let start = 0; start < fullPageCount; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, fullPageCount - 1);
        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(srcDoc, Array.from({ length: end - start + 1 }, (_, i) => start + i));
        copiedPages.forEach((page) => newDoc.addPage(page));
        const newBytes = await newDoc.save();
        chunks.push({
          bytes: new Uint8Array(newBytes),
          startPage: start + 1,
          endPage: end + 1,
        });
      }
    }

    // Step 4: Convert chunks sequentially (lower peak compute)
    const markdownParts: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const base64 = toBase64(chunk.bytes);
      const pdfSizeKB = Math.round(chunk.bytes.length / 1024);
      const chunkRange = `${chunk.startPage}-${chunk.endPage}`;
      console.log(`Sending chunk ${i + 1}/${chunks.length} (${chunkRange}, ${pdfSizeKB}KB) to Claude...`);

      const promptSuffix = `\n\nNote: This is pages ${chunkRange} of a larger document. Convert all content on these pages. Do not add any introduction or preamble about the page range.`;

      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
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
        return jsonResponse({
          error: `Claude API error ${claudeResponse.status}: ${errText.slice(0, 300)}`,
        }, 502);
      }

      const claudeData = await claudeResponse.json();
      inputTokens += Number(claudeData?.usage?.input_tokens || 0);
      outputTokens += Number(claudeData?.usage?.output_tokens || 0);
      const chunkMarkdown = claudeData.content
        .filter((block: { type: string }) => block.type === "text")
        .map((block: { text: string }) => block.text)
        .join("");
      markdownParts.push(chunkMarkdown);
    }

    const markdown = markdownParts.join("\n\n");
    console.log(`Conversion complete: ${markdown.length} chars, ${inputTokens} in / ${outputTokens} out`);

    // Step 4: Optionally save the markdown to the tab's content field
    let saved = false;
    if (save && tabId) {
      const { error: updateError } = await supabase
        .from("tabs")
        .update({ content: markdown })
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
      markdown,
      chars: markdown.length,
      full_pdf_size_kb: fullPdfSizeKB,
      total_pages: fullPageCount,
      page_range: pageRange ?? `1-${fullPageCount}`,
      chunks_processed: chunks.length,
      chunks_total: chunksTotal,
      tokens: {
        input: inputTokens,
        output: outputTokens,
      },
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
    console.error("convert-pdf-to-markdown error:", error);
    return jsonResponse({ error: `Conversion failed: ${message}` }, 500);
  }
});
