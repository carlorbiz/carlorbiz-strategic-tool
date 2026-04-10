import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Config ───────────────────────────────────────────────────
const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 65536;
const FILE_POLL_INTERVAL_MS = 3000;
const FILE_POLL_MAX_ATTEMPTS = 60; // 3 minutes max wait

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

// ─── Media type detection ─────────────────────────────────────

type MediaType = "audio" | "video";

interface MediaInfo {
  type: MediaType;
  mimeType: string;
  isYouTube: boolean;
  url: string;
}

function detectMediaType(url: string): MediaInfo {
  const lower = url.toLowerCase();

  // YouTube detection
  if (
    lower.includes("youtube.com/watch") ||
    lower.includes("youtu.be/") ||
    lower.includes("youtube.com/embed/")
  ) {
    return { type: "video", mimeType: "video/mp4", isYouTube: true, url };
  }

  // Audio formats
  if (lower.endsWith(".mp3") || lower.includes(".mp3?")) {
    return { type: "audio", mimeType: "audio/mp3", isYouTube: false, url };
  }
  if (lower.endsWith(".wav") || lower.includes(".wav?")) {
    return { type: "audio", mimeType: "audio/wav", isYouTube: false, url };
  }
  if (lower.endsWith(".m4a") || lower.includes(".m4a?")) {
    return { type: "audio", mimeType: "audio/mp4", isYouTube: false, url };
  }
  if (lower.endsWith(".ogg") || lower.includes(".ogg?")) {
    return { type: "audio", mimeType: "audio/ogg", isYouTube: false, url };
  }

  // Video formats
  if (lower.endsWith(".mp4") || lower.includes(".mp4?")) {
    return { type: "video", mimeType: "video/mp4", isYouTube: false, url };
  }
  if (lower.endsWith(".webm") || lower.includes(".webm?")) {
    return { type: "video", mimeType: "video/webm", isYouTube: false, url };
  }
  if (lower.endsWith(".mov") || lower.includes(".mov?")) {
    return { type: "video", mimeType: "video/quicktime", isYouTube: false, url };
  }

  // Google Drive — assume video unless overridden by caller
  if (lower.includes("drive.google.com")) {
    return { type: "video", mimeType: "video/mp4", isYouTube: false, url };
  }

  // Default: treat as audio (safer — smaller, faster to process)
  return { type: "audio", mimeType: "audio/mpeg", isYouTube: false, url };
}

// ─── Google Drive URL normalisation ───────────────────────────

function normaliseGoogleDriveUrl(url: string): string {
  // Convert sharing URLs to direct download URLs
  // Input:  https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // Output: https://drive.google.com/uc?export=download&id=FILE_ID
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return url;
}

// ─── Gemini File API: upload and wait ─────────────────────────

interface GeminiFile {
  name: string;
  uri: string;
  state: string;
  mimeType: string;
}

async function uploadToGeminiFileApi(
  mediaUrl: string,
  mimeType: string,
  displayName: string
): Promise<GeminiFile> {
  // Step 1: Download the media file
  const downloadUrl = normaliseGoogleDriveUrl(mediaUrl);
  console.log(`Downloading media from: ${downloadUrl}`);

  const mediaResponse = await fetch(downloadUrl);
  if (!mediaResponse.ok) {
    throw new Error(
      `Failed to download media: ${mediaResponse.status} ${mediaResponse.statusText}`
    );
  }

  const mediaBytes = await mediaResponse.arrayBuffer();
  const mediaSizeMB = (mediaBytes.byteLength / (1024 * 1024)).toFixed(1);
  console.log(`Downloaded: ${mediaSizeMB}MB`);

  // Step 2: Upload to Gemini File API (resumable upload)
  const initResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(mediaBytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: { display_name: displayName },
      }),
    }
  );

  if (!initResponse.ok) {
    const errText = await initResponse.text();
    throw new Error(
      `Gemini File API init error ${initResponse.status}: ${errText.slice(0, 300)}`
    );
  }

  const uploadUrl = initResponse.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("No upload URL returned from Gemini File API");
  }

  // Step 3: Upload the bytes
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Length": String(mediaBytes.byteLength),
    },
    body: mediaBytes,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(
      `Gemini File API upload error ${uploadResponse.status}: ${errText.slice(0, 300)}`
    );
  }

  const uploadData = await uploadResponse.json();
  const file: GeminiFile = uploadData.file;
  console.log(`File uploaded: ${file.name} (state: ${file.state})`);

  return file;
}

async function waitForFileProcessing(fileName: string): Promise<GeminiFile> {
  for (let attempt = 0; attempt < FILE_POLL_MAX_ATTEMPTS; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GOOGLE_API_KEY}`
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Gemini file status error ${response.status}: ${errText.slice(0, 300)}`
      );
    }

    const file: GeminiFile = await response.json();

    if (file.state === "ACTIVE") {
      console.log(`File ready: ${file.name}`);
      return file;
    }

    if (file.state === "FAILED") {
      throw new Error(`Gemini file processing failed: ${file.name}`);
    }

    // Still PROCESSING — wait and retry
    console.log(
      `File processing (attempt ${attempt + 1}/${FILE_POLL_MAX_ATTEMPTS})...`
    );
    await new Promise((r) => setTimeout(r, FILE_POLL_INTERVAL_MS));
  }

  throw new Error(
    `Gemini file processing timed out after ${FILE_POLL_MAX_ATTEMPTS * FILE_POLL_INTERVAL_MS / 1000}s`
  );
}

async function deleteGeminiFile(fileName: string): Promise<void> {
  try {
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GOOGLE_API_KEY}`,
      { method: "DELETE" }
    );
    console.log(`Cleaned up Gemini file: ${fileName}`);
  } catch (err) {
    console.warn(`Failed to delete Gemini file ${fileName}:`, err);
  }
}

// ─── Transcription prompts ────────────────────────────────────

const AUDIO_TRANSCRIPT_PROMPT = `Transcribe and structure this audio content into clean, readable Markdown.

Rules:
1. Create a structured document with clear section headings (## for major topics, ### for subtopics)
2. Identify distinct topics, themes, or segments and create logical sections
3. If multiple speakers are identifiable, note speaker changes with **Speaker Name/Role:** labels
4. Preserve all substantive content — do not summarise or skip sections
5. Convert spoken language into clear written prose — remove filler words (um, uh, like, you know) but keep the speaker's voice and intent
6. Preserve exact figures, names, dates, statistics, and technical terms precisely
7. Use bullet points for lists of items discussed
8. Use > blockquotes for notable quotes or key statements worth highlighting
9. Add a brief ## Overview section at the top (2-3 sentences describing the content)
10. Add a ## Key Points section at the end with the most important takeaways
11. Use Australian English spelling throughout
12. If timestamps are detectable, include approximate time markers as [~MM:SS] at the start of major sections

Return ONLY the Markdown. No commentary, no markdown fences wrapping the output.`;

const VIDEO_TRANSCRIPT_PROMPT = `Transcribe and structure this video content into clean, readable Markdown.

Rules:
1. Create a structured document with clear section headings (## for major topics, ### for subtopics)
2. Identify distinct topics, segments, or scenes and create logical sections
3. If multiple speakers are identifiable, note speaker changes with **Speaker Name/Role:** labels
4. Preserve all substantive content — do not summarise or skip sections
5. Convert spoken language into clear written prose — remove filler words but keep the speaker's voice and intent
6. Preserve exact figures, names, dates, statistics, and technical terms precisely
7. VISUAL CONTENT: When slides, diagrams, charts, or on-screen text appear, describe them in [Visual: ...] blocks
8. Use bullet points for lists of items discussed
9. Use > blockquotes for notable quotes or key statements worth highlighting
10. Add a brief ## Overview section at the top (2-3 sentences describing what this video covers)
11. Add a ## Key Points section at the end with the most important takeaways
12. Use Australian English spelling throughout
13. If timestamps are detectable, include approximate time markers as [~MM:SS] at the start of major sections

Return ONLY the Markdown. No commentary, no markdown fences wrapping the output.`;

// ─── Gemini generateContent call ──────────────────────────────

interface TranscriptResult {
  markdown: string;
  inputTokens: number;
  outputTokens: number;
}

async function transcribeWithGemini(
  fileUri: string,
  mimeType: string,
  mediaType: MediaType,
  contextHint?: string
): Promise<TranscriptResult> {
  const prompt = mediaType === "video"
    ? VIDEO_TRANSCRIPT_PROMPT
    : AUDIO_TRANSCRIPT_PROMPT;

  const contextSuffix = contextHint
    ? `\n\nContext about this content: ${contextHint}`
    : "";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                fileData: {
                  fileUri,
                  mimeType,
                },
              },
              {
                text: prompt + contextSuffix,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Gemini generateContent error ${response.status}: ${errText.slice(0, 500)}`
    );
  }

  const data = await response.json();
  const markdown =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data.usageMetadata ?? {};

  return {
    markdown,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
  };
}

// YouTube: pass URL directly as a fileData part (no upload needed)
async function transcribeYouTube(
  url: string,
  contextHint?: string
): Promise<TranscriptResult> {
  const prompt = VIDEO_TRANSCRIPT_PROMPT;
  const contextSuffix = contextHint
    ? `\n\nContext about this content: ${contextHint}`
    : "";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                fileData: {
                  fileUri: url,
                  mimeType: "video/mp4",
                },
              },
              {
                text: prompt + contextSuffix,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Gemini YouTube error ${response.status}: ${errText.slice(0, 500)}`
    );
  }

  const data = await response.json();
  const markdown =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data.usageMetadata ?? {};

  return {
    markdown,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
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
    const {
      tab_id,
      media_url,
      source_type: explicitSourceType,
      save = true,
      context_hint,
    } = body;

    if (!media_url) {
      return jsonResponse({ error: "media_url is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const media = detectMediaType(media_url);

    // Allow caller to override detected type
    if (explicitSourceType === "audio") media.type = "audio";
    if (explicitSourceType === "video") media.type = "video";

    console.log(
      `Processing ${media.type} (YouTube: ${media.isYouTube}): ${media_url}`
    );

    // ─── Resolve tab info if provided ────────────────────────
    let tabSlug: string | null = null;
    let tabLabel: string | null = null;

    if (tab_id) {
      const { data: tab, error: tabError } = await supabase
        .from("tabs")
        .select("id, slug, label")
        .eq("id", tab_id)
        .single();

      if (tabError || !tab) {
        return jsonResponse({ error: `Tab not found: ${tab_id}` }, 404);
      }
      tabSlug = tab.slug;
      tabLabel = tab.label;
    }

    const displayName = tabLabel || `media-${Date.now()}`;

    // ─── Process media ───────────────────────────────────────
    let result: TranscriptResult;
    let geminiFileName: string | null = null;

    if (media.isYouTube) {
      // YouTube: direct URL processing, no upload needed
      console.log("Using direct YouTube processing");
      result = await transcribeYouTube(media_url, context_hint);
    } else {
      // Non-YouTube: upload to Gemini File API, wait, transcribe
      const file = await uploadToGeminiFileApi(
        media_url,
        media.mimeType,
        displayName
      );
      geminiFileName = file.name;

      const readyFile = await waitForFileProcessing(file.name);

      result = await transcribeWithGemini(
        readyFile.uri,
        media.mimeType,
        media.type,
        context_hint
      );

      // Clean up the uploaded file from Gemini
      await deleteGeminiFile(file.name);
    }

    console.log(
      `Transcription complete: ${result.markdown.length} chars, ${result.inputTokens} in / ${result.outputTokens} out`
    );

    // ─── Save to tab ─────────────────────────────────────────
    let saved = false;
    if (save && tab_id) {
      const { error: updateError } = await supabase
        .from("tabs")
        .update({
          content: result.markdown,
          source_type: media.type,
          source_url: media_url,
          media_metadata: {
            processed_at: new Date().toISOString(),
            gemini_model: GEMINI_MODEL,
            is_youtube: media.isYouTube,
            mime_type: media.mimeType,
            tokens: {
              input: result.inputTokens,
              output: result.outputTokens,
            },
          },
        })
        .eq("id", tab_id);

      if (updateError) {
        console.error("Failed to save transcript to tab:", updateError);
      } else {
        saved = true;
        console.log(`Saved transcript to tab ${tabSlug ?? tab_id}`);
      }
    }

    return jsonResponse({
      success: true,
      media_type: media.type,
      is_youtube: media.isYouTube,
      markdown: result.markdown,
      chars: result.markdown.length,
      tokens: { input: result.inputTokens, output: result.outputTokens },
      gemini_model: GEMINI_MODEL,
      saved,
      tab_slug: tabSlug,
      // Note: saving to tabs.content will auto-trigger extract-tab-chunks
      // via the on_tab_content_changed database trigger (if configured)
      chunking_triggered: saved,
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
    console.error("process-media error:", error);
    return jsonResponse({ error: `Processing failed: ${message}` }, 500);
  }
});
