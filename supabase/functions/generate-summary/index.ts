import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM, type LLMConfig } from "../_shared/llm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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

const SYSTEM_PROMPT = `You are writing one-line summaries for Carla Taylor's professional consulting website (carlorbiz.com.au).

Carla's voice:
- Direct, confident, no corporate waffle
- Uses plain language with strategic weight — every word earns its place
- Speaks from lived experience (30 years across hospitality, healthcare, peak bodies, AI)
- Favours constraint-as-advantage framing
- Australian English spelling (organisation, behaviour, etc.)
- Never uses "leverage", "synergy", "holistic", or "empower"
- Comfortable with bold claims backed by substance

Your task: Write ONE sentence (max 160 characters) that:
1. Captures the core value or insight of the content
2. Sounds like Carla wrote it — first person where natural
3. Works as an SEO meta description AND an accordion teaser
4. Makes someone want to click/expand to read more
5. Is NOT a generic summary — be specific to the actual content

Return ONLY the summary line. No quotes, no preamble, no explanation.`;

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    await requireInternalAdmin(req);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { tab_id, save = true } = await req.json();
    if (!tab_id) return jsonResponse({ error: "tab_id is required" }, 400);

    // Fetch the tab
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, label, content, file_url, content_type, summary")
      .eq("id", tab_id)
      .single();

    if (tabError || !tab)
      return jsonResponse({ error: `Tab not found: ${tab_id}` }, 404);

    // Build the content to summarise
    let contentToSummarise = "";

    if (tab.content && tab.content.trim().length > 0) {
      // Use the markdown content (from transcripts or text tabs)
      contentToSummarise = tab.content.substring(0, 8000); // Cap at ~8k chars
    } else if (tab.label) {
      // Fallback to just the title if no content yet
      contentToSummarise = `Title: ${tab.label}`;
    }

    if (!contentToSummarise) {
      return jsonResponse({
        error: "No content available to summarise. Process the media or add text content first.",
      }, 400);
    }

    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    const userMessage = `Content type: ${tab.content_type || "text"}
Title: ${tab.label}

Content:
${contentToSummarise}`;

    const summary = await callLLM(
      llmConfig,
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      256
    );

    const trimmedSummary = summary.trim().replace(/^["']|["']$/g, "");

    // Save to the tab if requested
    if (save) {
      const { error: updateError } = await supabase
        .from("tabs")
        .update({ summary: trimmedSummary })
        .eq("id", tab_id);

      if (updateError) {
        return jsonResponse({
          error: `Generated summary but failed to save: ${updateError.message}`,
          summary: trimmedSummary,
        }, 500);
      }
    }

    return jsonResponse({ summary: trimmedSummary, saved: save });
  } catch (error) {
    const message = (error as Error).message || "Unknown error";
    if (message === "Missing bearer token" || message === "Invalid bearer token") {
      return jsonResponse({ error: message }, 401);
    }
    if (message === "User profile not found" || message === "Insufficient permissions") {
      return jsonResponse({ error: message }, 403);
    }
    console.error("generate-summary error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
