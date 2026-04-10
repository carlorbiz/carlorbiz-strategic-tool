import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── RAG: simple full-text search ─────────────────────────────

interface KnowledgeChunk {
  id: string;
  chunk_text: string;
  document_source: string;
  section_reference: string | null;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "under", "again",
  "further", "then", "once", "here", "there", "when", "where", "why",
  "how", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "about", "up", "out", "if", "or",
  "and", "but", "because", "until", "while", "it", "its", "this",
  "that", "these", "those", "i", "me", "my", "we", "our", "you",
  "your", "he", "him", "his", "she", "her", "they", "them", "their",
  "what", "which", "who", "whom", "think", "really", "quite", "yeah",
  "yes", "no", "well", "like", "know", "going", "got", "get",
]);

async function retrieveContextChunks(
  supabase: ReturnType<typeof createClient>,
  message: string
): Promise<KnowledgeChunk[]> {
  const keywords = message
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (keywords.length === 0) return [];

  const searchTerms = keywords.slice(0, 5).join(" | ");

  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id, chunk_text, document_source, section_reference")
    .eq("is_active", true)
    .textSearch("fts", searchTerms, { type: "websearch" })
    .limit(6);

  return data || [];
}

function formatChunksForContext(chunks: KnowledgeChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const source = chunk.document_source;
      const section = chunk.section_reference
        ? ` — ${chunk.section_reference}`
        : "";
      return `[Chunk ${i + 1}] Source: ${source}${section}\n${chunk.chunk_text}`;
    })
    .join("\n\n---\n\n");
}

// ─── JSON extraction ──────────────────────────────────────────

function extractJsonBlock(text: string): Record<string, unknown> | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}

function stripJsonBlock(text: string): string {
  return text.replace(/```json[\s\S]*?```/g, "").trim();
}

// ─── Conversation message type ────────────────────────────────

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
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
    const body = await req.json();
    const {
      campaign_id,
      session_id,
      session_token,
      message,
      conversation_history,
    } = body;

    if (!campaign_id || !session_id || !session_token || !message) {
      return jsonResponse(
        { error: "campaign_id, session_id, session_token, and message are required" },
        400
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Load campaign system prompt ──
    const { data: campaign, error: campaignError } = await supabase
      .from("feedback_campaigns")
      .select("system_prompt, status")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return jsonResponse({ error: "Campaign not found" }, 404);
    }

    if (campaign.status !== "active") {
      return jsonResponse({ error: "Campaign is not active" }, 403);
    }

    // ── RAG: retrieve relevant content chunks ──
    const chunks = await retrieveContextChunks(supabase, message);

    // ── Build system prompt ──
    let systemPrompt = campaign.system_prompt;

    if (chunks.length > 0) {
      systemPrompt +=
        "\n\n## Reference Content (from the knowledge base)\n\n" +
        formatChunksForContext(chunks);
    }

    // First message: note that greeting was already shown
    const history: ConversationMessage[] = conversation_history || [];
    if (history.length === 0) {
      systemPrompt +=
        "\n\nIMPORTANT: The participant has already been shown your greeting message. Do not repeat the introduction — acknowledge their first message naturally and begin the conversation.";
    }

    // ── Build Claude messages array ──
    const claudeMessages: { role: "user" | "assistant"; content: string }[] = [];
    const recentHistory = history.slice(-20);
    for (const turn of recentHistory) {
      claudeMessages.push({ role: turn.role, content: turn.content });
    }
    claudeMessages.push({ role: "user", content: message });

    // ── Call Claude with streaming ──
    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 2048,
          stream: true,
          system: systemPrompt,
          messages: claudeMessages,
        }),
      }
    );

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", errText);
      return jsonResponse(
        { error: "Failed to generate response" },
        502
      );
    }

    // ── Stream SSE to client ──
    const encoder = new TextEncoder();
    const claudeReader = claudeResponse.body!.getReader();
    const decoder = new TextDecoder();

    const sseStream = new ReadableStream({
      async start(controller) {
        // Send meta event
        controller.enqueue(
          encoder.encode(sseEvent("meta", { type: "feedback" }))
        );

        let fullText = "";
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await claudeReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.type === "text_delta"
                ) {
                  const text = parsed.delta.text;
                  fullText += text;
                  controller.enqueue(
                    encoder.encode(sseEvent("delta", { text }))
                  );
                }
              } catch {
                // Skip malformed events
              }
            }
          }
        } catch (streamErr) {
          const errMsg =
            streamErr instanceof Error
              ? streamErr.message
              : String(streamErr);
          console.error("Stream processing error:", errMsg);
          controller.enqueue(
            encoder.encode(sseEvent("error", { message: errMsg }))
          );
        }

        // ── Post-stream: update session ──
        const jsonFeedback = extractJsonBlock(fullText);
        const cleanText = stripJsonBlock(fullText);

        // Build updated transcript
        const updatedTranscript: ConversationMessage[] = [...history];
        updatedTranscript.push({
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        });
        updatedTranscript.push({
          role: "assistant",
          content: cleanText,
          timestamp: new Date().toISOString(),
        });

        const sessionUpdate: Record<string, unknown> = {
          transcript: updatedTranscript,
          updated_at: new Date().toISOString(),
        };

        if (jsonFeedback) {
          sessionUpdate.structured_feedback =
            jsonFeedback.feedback || jsonFeedback;
          sessionUpdate.status = "completed";
          sessionUpdate.completed_at = new Date().toISOString();

          // Extract conversation quality fields
          const quality = jsonFeedback.conversation_quality as
            | Record<string, unknown>
            | undefined;
          if (quality) {
            sessionUpdate.engagement_level =
              quality.engagement_level || null;
            sessionUpdate.areas_covered =
              quality.areas_covered || [];
            sessionUpdate.notable_insights =
              quality.notable_insights || null;
          }

          // Extract willingness to follow up
          const feedback = jsonFeedback.feedback as
            | Record<string, unknown>
            | undefined;
          if (feedback) {
            sessionUpdate.willing_to_chat =
              feedback.willing_to_chat ?? null;
            sessionUpdate.preferred_contact =
              feedback.preferred_contact || null;
          }
        }

        await supabase
          .from("feedback_sessions")
          .update(sessionUpdate)
          .eq("id", session_id)
          .eq("session_token", session_token);

        controller.enqueue(
          encoder.encode(
            sseEvent("done", { has_json: !!jsonFeedback })
          )
        );
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
    const errMsg =
      error instanceof Error ? error.message : String(error);
    console.error("feedback-chat error:", errMsg);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
