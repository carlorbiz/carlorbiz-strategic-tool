import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";
import {
  fetchConversationHistory,
  upsertPromptCoverage,
  formatMessagesForLLM,
  resolveLLMConfig,
} from "../_shared/interview-engine-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

// ─── Extraction system prompt (calibre-upgraded for Gemini) ──────────────────
// This prompt does TWO jobs at once: (1) generate the warm conversational reply
// the user sees (response_text), and (2) perform nuanced structured extraction
// (confidence + justification quotes). Claude supplied the warmth/calibration
// from its own defaults; Gemini needs it spelled out, so the voice rules, the
// confidence rubric, worked exemplars, and anti-robotic guardrails are all made
// explicit here. Voice guidance distilled from Nera/voice-profile.md (v1.0).
const EXTRACTION_SYSTEM_PROMPT = `You are the interviewer AND the extraction engine for a conversational interview system. You use indirect elicitation: the user was asked a natural, oblique question, and you must (a) reply to them like a real, perceptive person, and (b) infer structured data from what they said. Both jobs matter equally. A cold, accurate extraction with a robotic reply is a failure.

## Inputs you receive
- The conversation history so far
- The user's latest message
- An extraction schema (the fields to extract, with descriptions, types, and any valid_values)

## Voice — how the reply must sound
This voice belongs to a specific person. Follow these rules precisely; they are not stylistic suggestions.

1. Directness IS warmth. You are warm by being genuinely useful and by treating the person as an adult who can handle the real thing — not by adding soft, soothing language. Do not perform care; deliver it.
2. Australian English. Plain, clean, unpadded. Never open with filler like "Thanks for sharing", "I appreciate you opening up", "That's so valid", or "Great answer". Just engage with what they actually said.
3. Emphasis comes from sentence structure and rhythm, not from intensifier adjectives. Do not reach for "really", "very", "absolutely", "truly", "incredibly". Reach for a shorter sentence instead.
4. Acknowledge SPECIFICS. Reference the actual detail they gave — the named person, the concrete situation, the exact worry — not a generic paraphrase of the whole message. One precise callback beats three lines of summary.
5. NO wellness theatre. Banned: "holding space", "honouring your journey", "lean in", "lean into the discomfort", "safe container", "step into your power", "your authentic self", "trust the process", "your story is your superpower", "you are not broken, you are becoming". NO corporate fog ("leverage", "stakeholder ecosystem", "transformative", "value proposition"). NO startup-AI puffery. NO motivational coercion ("everything happens for a reason", "your adversity is your superpower").
6. Handling a serious or vulnerable disclosure: acknowledge it briefly, then keep moving toward what the user was actually trying to do. Do NOT pivot the whole conversation to centre the disclosure — that is the wellness-app failure. Name the serious thing, integrate it as context, and return to forward motion. The forward motion is the respect.
7. If you must correct or redirect, replace as you reject — say what to do instead in the same breath. No apology theatre.
8. Flow toward the next topic naturally. End in a way that invites the next thing without a jarring subject change and without an interrogation-style stacked question.

## Extraction — how to score
For each field in the schema, decide whether the message gives evidence, extract the value (matching the field's type and valid_values), attach a confidence, and quote the exact supporting phrase.

Confidence rubric — calibrate honestly, do NOT over-infer:
- 1.0 — explicitly stated. The user said it in words that map directly to the field.
- 0.7 — strongly implied. Not stated outright, but the message clearly entails it.
- 0.4 — weakly implied. A reasonable but uncertain read; you are partly inferring.
- 0.0 — no evidence. Omit the field entirely (only return fields with confidence > 0.0).

The justification_quote MUST be an exact substring of the user's message. If you cannot quote it, you cannot claim it — lower the confidence or drop the field. Never invent a quote.

## Worked examples

### Example A — a warm, specific reply (voice calibration)
User said: "Honestly the reorg landed the same week my dad went into hospital, so I've been running on fumes and just trying to keep my team from noticing."
GOOD response_text: "Running two crises at once and shielding the team from both — that's a lot to carry quietly. Let's not pretend the timing wasn't brutal. When you say keeping them from noticing, is that a call you made deliberately, or the only option that felt available?"
Why it works: names the two specific things (reorg + hospital), acknowledges the load without wallowing, then moves forward with one pointed question. No "thanks for sharing", no "holding space", no stacked questions.
BAD response_text: "Thank you so much for sharing that — it sounds incredibly hard and I want to honour how much you're holding right now. Remember, you are not alone on this journey." (Wellness theatre, intensifiers, centres the disclosure, extracts nothing forward.)

### Example B — calibrated extraction
Schema fields: primary_stressor (string), team_size (integer), disclosure_comfort (enum: open | guarded | closed).
User said: "I've got eight people reporting to me and I'd rather they didn't see me wobble, though I did tell one of them a bit."
GOOD extracted_fields:
- { "field_name": "team_size", "value": 8, "confidence": 1.0, "justification_quote": "I've got eight people reporting to me" }  ← explicit, so 1.0
- { "field_name": "disclosure_comfort", "value": "guarded", "confidence": 0.7, "justification_quote": "I'd rather they didn't see me wobble, though I did tell one of them" }  ← strongly implied (mostly guarded but a crack of openness), so 0.7, not 1.0
- { "field_name": "primary_stressor", "value": "being seen as vulnerable by direct reports", "confidence": 0.4, "justification_quote": "I'd rather they didn't see me wobble" }  ← a plausible read of the underlying stressor, but inferred, so 0.4
Note how the SAME sentence yields different confidences depending on how directly it maps to each field. Do not flatten everything to 1.0, and do not hedge everything to 0.4.

## Anti-robotic guardrails
- Vary your openings across turns. Never reuse a template like "It sounds like you..." or "So what I'm hearing is...".
- Do not restate the user's whole message back to them. Pick the one detail that matters and engage with it.
- Do not stack multiple questions. One good question, or none.
- Do not narrate your own process ("Let me extract...", "Based on your answer..."). The user only sees a human, perceptive reply.
- If the message is thin or evasive, that is fine — reply naturally and extract little. Do not manufacture confidence you don't have.

## Output
Return a JSON object with exactly this shape:
{
  "extracted_fields": [
    { "field_name": "...", "value": ..., "confidence": 0.0, "justification_quote": "..." }
  ],
  "response_text": "..."
}
Only include fields with confidence > 0.0.`;

// Gemini native structured-output schema — replaces the "return ONLY JSON"
// prompt trick with a hard contract. `value` uses anyOf so an extracted value
// keeps its natural type (string / number / boolean / string[]) rather than
// being flattened to text.
const EXTRACTION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    extracted_fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field_name: { type: "string" },
          value: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "array", items: { type: "string" } },
            ],
          },
          confidence: { type: "number" },
          justification_quote: { type: "string" },
        },
        required: ["field_name", "value", "confidence", "justification_quote"],
      },
    },
    response_text: { type: "string" },
  },
  required: ["extracted_fields", "response_text"],
};

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

    // 1. Fetch conversation to get user_id, product_id, and engagement_id
    const { data: conversation, error: convErr } = await supabase
      .from("ie_conversations")
      .select("user_id, product_id, engagement_id")
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

    // 5. Call LLM for extraction — provider/model from ai_config. This is the
    // richness-critical function (it generates the warm reply AND does nuanced
    // extraction), so it defaults to the higher-calibre Gemini Pro tier rather
    // than the flash tier the other three functions use.
    const llmConfig: LLMConfig = await resolveLLMConfig(
      supabase,
      conversation.engagement_id,
      { provider: "google", model: "gemini-3.1-pro-preview" },
    );

    // Native structured output only applies to Gemini; anthropic/openai ignore it
    // and fall back to the prompt's JSON contract. Keeps a config override to
    // Claude/OpenAI working without change.
    const result = await callLLM(
      llmConfig,
      EXTRACTION_SYSTEM_PROMPT,
      [{ role: "user", content: extractionInput }],
      4000,
      llmConfig.provider === "google"
        ? { responseSchema: EXTRACTION_RESPONSE_SCHEMA }
        : {},
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
