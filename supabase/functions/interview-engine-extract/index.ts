import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";
import {
  fetchConversationHistory,
  upsertPromptCoverage,
  formatMessagesForLLM,
} from "../_shared/interview-engine-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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

async function requireAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");
  if (token === SUPABASE_SERVICE_ROLE_KEY) return "service-role";
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("malformed");
    const payload = JSON.parse(atob(parts[1]));
    if (payload.role === "service_role") return "service-role";
    if (!payload.sub) throw new Error("no sub");
    return payload.sub;
  } catch {
    throw new Error("Invalid bearer token");
  }
}

const EXTRACTION_SYSTEM_PROMPT = `You are a structured data extraction engine for a conversational interview system. You use indirect elicitation — the user was asked a natural conversational question, and you must infer structured data from their response.

Given:
- The conversation history
- The user's latest message
- An extraction schema (fields to extract with descriptions and types)

For each field in the schema, determine:
1. Whether the response provides evidence for that field
2. The extracted value (matching the field's type and valid_values if specified)
3. A confidence score (0.0-1.0): 1.0 = explicitly stated, 0.7 = strongly implied, 0.4 = weakly implied, 0.0 = no evidence
4. A justification quote (the exact phrase from the response that supports this extraction)

Also generate a warm, natural conversational response (as the interviewer) that:
- Acknowledges what the user said
- References specific details they mentioned
- Flows naturally toward the next topic

Return a JSON object:
{
  "extracted_fields": [
    { "field_name": "...", "value": ..., "confidence": 0.0-1.0, "justification_quote": "..." }
  ],
  "response_text": "..."
}

Only include fields where confidence > 0.0. Return ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const _userId = await requireAuth(req);
    const { conversation_id, message_content, extraction_schema, context } =
      await req.json();

    if (!conversation_id || !message_content) {
      return jsonResponse(
        { error: "conversation_id and message_content are required" },
        400
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch conversation to get user_id and product_id
    const { data: conversation, error: convErr } = await supabase
      .from("ie_conversations")
      .select("user_id, product_id")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conversation) {
      return jsonResponse({ error: "Conversation not found" }, 404);
    }

    // 2. Write the user message to ie_messages
    await supabase.from("ie_messages").insert({
      conversation_id,
      role: "user",
      content: message_content,
    });

    // 3. Fetch conversation history
    const messages = await fetchConversationHistory(supabase, conversation_id);
    const formattedHistory = formatMessagesForLLM(messages);

    // 4. Build the extraction input
    const schemaStr = extraction_schema
      ? JSON.stringify(extraction_schema, null, 2)
      : "No extraction schema provided — extract any structured data you can infer.";

    const contextStr = context
      ? `\n\nAdditional context:\n${typeof context === "string" ? context : JSON.stringify(context)}`
      : "";

    const extractionInput = `Extraction schema:\n${schemaStr}${contextStr}\n\nConversation history:\n${formattedHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nLatest user message:\n${message_content}`;

    // 5. Call LLM for extraction
    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    const result = await callLLM(
      llmConfig,
      EXTRACTION_SYSTEM_PROMPT,
      [{ role: "user", content: extractionInput }],
      4000
    );

    // 6. Parse the response
    let extractedFields: Array<{
      field_name: string;
      value: unknown;
      confidence: number;
      justification_quote: string;
    }> = [];
    let responseText = "";

    try {
      const trimmed = result.trim();
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;
      const parsed = JSON.parse(jsonStr);

      extractedFields = Array.isArray(parsed.extracted_fields)
        ? parsed.extracted_fields
        : [];
      responseText = parsed.response_text ?? "";
    } catch {
      // If parsing fails, use raw text as response
      responseText = result.trim();
    }

    // 7. Build structured data objects for the message record
    const extractedData: Record<string, unknown> = {};
    const confidenceScores: Record<string, number> = {};
    const justifications: Record<string, string> = {};

    for (const field of extractedFields) {
      extractedData[field.field_name] = field.value;
      confidenceScores[field.field_name] = field.confidence;
      justifications[field.field_name] = field.justification_quote;
    }

    // 8. Write the assistant response to ie_messages
    await supabase.from("ie_messages").insert({
      conversation_id,
      role: "assistant",
      content: responseText,
      extracted_data: extractedData,
      confidence_scores: confidenceScores,
      justifications,
    });

    // 9. Update prompt coverage
    for (const field of extractedFields) {
      if (field.confidence > 0) {
        await upsertPromptCoverage(
          supabase,
          conversation.user_id,
          conversation.product_id,
          field.field_name,
          field.confidence,
          conversation_id
        );
      }
    }

    return jsonResponse({
      success: true,
      extracted_fields: extractedFields,
      response_text: responseText,
      conversation_id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("interview-engine-extract error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
