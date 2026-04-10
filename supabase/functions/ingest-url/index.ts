import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// ─── Config ───────────────────────────────────────────────────
const MAX_CHUNK_CHARS = 2000; // ~500 tokens
const CHUNK_OVERLAP_CHARS = 200; // ~50 tokens
const MAX_OUTPUT_TOKENS = 16000;

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

async function requireInternalAdmin(
  req: Request
): Promise<{ userId: string }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { userId: "service-role" };
  }

  // Decode JWT payload to extract user ID (sub claim).
  // No signature verification — verify_jwt is disabled at the gateway.
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
  if (profileError || !profile) throw new Error("User profile not found");
  if (profile.role !== "internal_admin")
    throw new Error("Insufficient permissions");

  return { userId };
}

// ─── SHA-256 hash ─────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── HTML content extraction ──────────────────────────────────

function extractMainContent(html: string): string {
  // Remove script, style, link, noscript tags and their content
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Remove nav, header, footer elements
  cleaned = cleaned
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Remove elements with navigation/banner/contentinfo roles
  cleaned = cleaned.replace(
    /<[^>]+role\s*=\s*["'](navigation|banner|contentinfo)["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
    ""
  );

  // Try to extract from content selectors in priority order
  const contentPatterns = [
    /<div[^>]+id\s*=\s*["']content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]+class\s*=\s*["'][^"']*page-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1] && match[1].trim().length > 100) {
      cleaned = match[1];
      break;
    }
  }

  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse whitespace but preserve paragraph breaks
  cleaned = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

// ─── Text chunking ────────────────────────────────────────────

interface TextChunk {
  text: string;
  index: number;
  heading: string | null;
}

function chunkText(
  text: string,
  maxChars: number,
  overlapChars: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";
  let currentHeading: string | null = null;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect headings (lines that look like titles)
    if (
      trimmed.length < 100 &&
      !trimmed.endsWith(".") &&
      trimmed === trimmed.replace(/[a-z]/g, "").length > trimmed.length * 0.3
        ? trimmed
        : null
    ) {
      // Heuristic: short, doesn't end with period = likely heading
      if (trimmed.length < 80 && !trimmed.endsWith(".")) {
        currentHeading = trimmed;
      }
    }

    if (currentChunk.length + trimmed.length + 2 > maxChars) {
      // Save current chunk
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          heading: currentHeading,
        });
      }
      // Start new chunk with overlap from end of previous
      const overlap = currentChunk.slice(-overlapChars);
      currentChunk = overlap + "\n\n" + trimmed;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    }
  }

  // Final chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
      heading: currentHeading,
    });
  }

  return chunks;
}

// ─── Claude extraction for structured chunks ──────────────────

async function extractChunksWithClaude(
  content: string,
  title: string,
  url: string,
  category: string,
  tags: string[]
): Promise<Record<string, unknown>[]> {
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
      system: `You are a knowledge extraction specialist. Extract discrete knowledge chunks from web page content.

Rules:
1. One fact, requirement, or concept per chunk
2. Each chunk must be completely self-contained and understandable without context
3. Preserve precision — exact figures, dates, rates, contacts, URLs must be accurate
4. The text content field MUST be named chunk_text
5. Use Australian English spelling throughout

Return a JSON array of objects with these fields:
- chunk_text: the extracted knowledge (complete, self-contained statement)
- section_reference: section or heading where this content appears
- chunk_summary: one sentence summary
- topic_tags: array of relevant lowercase tags
- content_type: one of "definition", "requirement", "procedure", "resource", "contact", or null

Return ONLY the JSON array. No markdown fences, no explanation.`,
      messages: [
        {
          role: "user",
          content: `Extract all knowledge chunks from this web page content.\n\nSource: ${title}\nURL: ${url}\nCategory: ${category}\nTags: ${tags.join(", ")}\n\n---\n\n${content}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Claude API error ${response.status}: ${errText.slice(0, 300)}`
    );
  }

  const data = await response.json();
  const text = data.content
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("");

  // Parse JSON with truncation recovery
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  if (!cleaned.endsWith("]")) {
    let searchFrom = cleaned.length;
    while (searchFrom > 0) {
      const pos = cleaned.lastIndexOf("}", searchFrom - 1);
      if (pos <= 0) break;
      const candidate = cleaned.slice(0, pos + 1) + "]";
      try {
        JSON.parse(candidate);
        cleaned = candidate;
        break;
      } catch {
        searchFrom = pos;
      }
    }
  }

  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [parsed];
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
    const { url_resource_id, tab_id, url: directUrl } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Direct tab mode: fetch URL content → save to tabs.content ──
    if (tab_id && directUrl) {
      console.log(`Direct URL ingest for tab ${tab_id}: ${directUrl}`);

      const pageResponse = await fetch(directUrl, {
        headers: {
          "User-Agent": "Nera-Knowledge-Hub/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!pageResponse.ok) {
        return jsonResponse(
          { error: `Failed to fetch URL: ${pageResponse.status} ${pageResponse.statusText}` },
          502
        );
      }

      const html = await pageResponse.text();
      console.log(`Fetched ${html.length} chars of HTML`);

      const mainContent = extractMainContent(html);
      console.log(`Extracted ${mainContent.length} chars of content`);

      if (mainContent.length < 50) {
        return jsonResponse(
          { error: "Extracted content too short — page may be JavaScript-rendered (e.g. Gamma). Try pasting the content manually into the content field instead." },
          422
        );
      }

      // Save extracted content to the tab
      const { error: updateError } = await supabase
        .from("tabs")
        .update({ content: mainContent })
        .eq("id", tab_id);

      if (updateError) {
        return jsonResponse(
          { error: `Content extracted but failed to save to tab: ${updateError.message}` },
          500
        );
      }

      console.log(`Saved ${mainContent.length} chars to tab ${tab_id}`);

      return jsonResponse({
        status: "success",
        content_chars: mainContent.length,
        url: directUrl,
        saved_to_tab: tab_id,
        message: "Content extracted and saved to tab. Run Extract Chunks to generate knowledge chunks.",
      });
    }

    // ── URL resource mode (original) ──
    if (!url_resource_id) {
      return jsonResponse({ error: "tab_id + url or url_resource_id is required" }, 400);
    }

    // 1. Fetch the url_resource record
    const { data: resource, error: resourceError } = await supabase
      .from("url_resources")
      .select("*")
      .eq("id", url_resource_id)
      .single();

    if (resourceError || !resource) {
      return jsonResponse(
        { error: `URL resource not found: ${url_resource_id}` },
        404
      );
    }

    console.log(`Ingesting URL: ${resource.url}`);

    // 2. Fetch the web page
    const pageResponse = await fetch(resource.url, {
      headers: {
        "User-Agent": "Nera-Knowledge-Hub/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!pageResponse.ok) {
      return jsonResponse(
        {
          error: `Failed to fetch URL: ${pageResponse.status} ${pageResponse.statusText}`,
        },
        502
      );
    }

    const html = await pageResponse.text();
    console.log(`Fetched ${html.length} chars of HTML`);

    // 3. Extract main content
    const mainContent = extractMainContent(html);
    console.log(`Extracted ${mainContent.length} chars of content`);

    if (mainContent.length < 50) {
      return jsonResponse(
        { error: "Extracted content too short — page may be empty or blocked" },
        422
      );
    }

    // 4. Check content hash for change detection
    const newHash = await sha256(mainContent);
    if (newHash === resource.content_hash) {
      await supabase
        .from("url_resources")
        .update({ last_fetched: new Date().toISOString() })
        .eq("id", url_resource_id);

      return jsonResponse({
        status: "unchanged",
        message: "Content has not changed since last fetch",
      });
    }

    // 5. Delete existing chunks for this URL resource
    const { error: deleteError } = await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("source_type", "url")
      .eq("source_id", url_resource_id);

    if (deleteError) {
      console.error("Error deleting old chunks:", deleteError);
    }

    // 6. Extract structured chunks via Claude
    const extractedChunks = await extractChunksWithClaude(
      mainContent,
      resource.title,
      resource.url,
      resource.category,
      resource.tags || []
    );

    // 7. Build chunk records
    const chunkRecords = extractedChunks
      .map((chunk, i) => {
        const chunkText =
          (chunk.chunk_text as string) || "";
        if (!chunkText || chunkText.trim().length < 10) return null;

        return {
          source_type: "url",
          source_id: url_resource_id,
          document_source: resource.title,
          section_reference: (chunk.section_reference as string) ?? null,
          chunk_text: chunkText,
          chunk_summary: (chunk.chunk_summary as string) ?? null,
          topic_tags: Array.isArray(chunk.topic_tags) ? chunk.topic_tags : [],
          content_type: (chunk.content_type as string) ?? null,
          metadata: {
            source_url: resource.url,
            source_title: resource.title,
            category: resource.category,
            tags: resource.tags,
            fetched_at: new Date().toISOString(),
          },
          is_active: true,
          extraction_version: "url-v1.0",
        };
      })
      .filter(Boolean);

    // 8. Insert chunks in batches of 20
    let inserted = 0;
    for (let i = 0; i < chunkRecords.length; i += 20) {
      const batch = chunkRecords.slice(i, i + 20);
      const { error: insertError } = await supabase
        .from("knowledge_chunks")
        .insert(batch);

      if (insertError) {
        console.error(`Insert error batch ${Math.floor(i / 20) + 1}:`, insertError);
      } else {
        inserted += batch.length;
      }
    }

    // 9. Update url_resources record
    await supabase
      .from("url_resources")
      .update({
        content_hash: newHash,
        last_fetched: new Date().toISOString(),
        chunk_count: inserted,
      })
      .eq("id", url_resource_id);

    console.log(
      `Ingestion complete: ${inserted} chunks from ${resource.url}`
    );

    return jsonResponse({
      status: "success",
      chunks_created: inserted,
      content_chars: mainContent.length,
      url: resource.url,
    });
  } catch (error) {
    const message = (error as Error).message || "Unknown error";
    if (
      message === "Missing bearer token" ||
      message === "Invalid bearer token"
    ) {
      return jsonResponse({ error: message }, 401);
    }
    if (
      message === "User profile not found" ||
      message === "Insufficient permissions"
    ) {
      return jsonResponse({ error: message }, 403);
    }
    console.error("ingest-url error:", error);
    return jsonResponse({ error: `Ingestion failed: ${message}` }, 500);
  }
});
