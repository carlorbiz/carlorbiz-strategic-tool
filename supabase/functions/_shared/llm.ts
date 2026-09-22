/**
 * Multi-LLM abstraction layer for Nera edge functions.
 *
 * Supports Anthropic (Claude), Google (Gemini), and OpenAI.
 * Provider and model are determined by the ai_config table.
 *
 * Usage:
 *   import { callLLM, streamLLM } from "../_shared/llm.ts";
 */

export interface LLMConfig {
  provider: "anthropic" | "google" | "openai";
  model: string;
  apiKey: string;
}

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Optional per-call tuning. `responseSchema` is currently honoured by the Gemini
 * path only: it switches Gemini into native structured-output mode
 * (responseMimeType application/json + a responseSchema in generationConfig) so
 * JSON comes back reliably instead of relying on a "return ONLY the JSON" prompt
 * trick. The anthropic/openai paths ignore it and are unchanged.
 */
export interface LLMCallOptions {
  // deno-lint-ignore no-explicit-any
  responseSchema?: Record<string, any>;
}

// ─── Non-streaming call ────────────────────────────────────────

export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens = 2048,
  options: LLMCallOptions = {}
): Promise<string> {
  switch (config.provider) {
    case "anthropic":
      return callAnthropic(config, systemPrompt, messages, maxTokens);
    case "google":
      return callGemini(config, systemPrompt, messages, maxTokens, options);
    case "openai":
      return callOpenAI(config, systemPrompt, messages, maxTokens);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

// ─── Streaming call (returns raw Response for SSE re-emission) ─

export async function streamLLM(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens = 2048
): Promise<Response> {
  switch (config.provider) {
    case "anthropic":
      return streamAnthropic(config, systemPrompt, messages, maxTokens);
    case "google":
      return streamGemini(config, systemPrompt, messages, maxTokens);
    case "openai":
      return streamOpenAI(config, systemPrompt, messages, maxTokens);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Parse a streaming LLM response into text deltas.
 * Yields { text: string } objects for each chunk of generated text.
 *
 * Diagnostic: every event type is counted and logged at end-of-stream so we can
 * see what the provider actually emitted when text comes back empty.
 */
export async function* parseStreamDeltas(
  response: Response,
  provider: "anthropic" | "google" | "openai"
): AsyncGenerator<{ text: string }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const eventCounts: Record<string, number> = {};
  let textDeltaCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
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

          // Diagnostic: count event types we see
          const eventType = (parsed.type as string) || "unknown";
          eventCounts[eventType] = (eventCounts[eventType] ?? 0) + 1;

          // Surface explicit error events as exceptions so the caller can react
          if (provider === "anthropic" && parsed.type === "error") {
            const errPayload = parsed.error as { type?: string; message?: string } | undefined;
            throw new Error(
              `Anthropic stream error: ${errPayload?.type || "unknown"} — ${errPayload?.message || JSON.stringify(parsed)}`
            );
          }

          // Surface Anthropic message_delta with stop_reason for diagnostics
          if (provider === "anthropic" && parsed.type === "message_delta") {
            const delta = parsed.delta as { stop_reason?: string } | undefined;
            if (delta?.stop_reason && delta.stop_reason !== "end_turn") {
              console.warn(`[parseStreamDeltas] Anthropic stop_reason=${delta.stop_reason}`);
            }
          }

          const text = extractDeltaText(parsed, provider);
          if (text) {
            textDeltaCount++;
            yield { text };
          }
        } catch (e) {
          // Re-throw error events; swallow JSON parse errors only
          if (e instanceof Error && e.message.startsWith("Anthropic stream error:")) {
            throw e;
          }
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
    // End-of-stream diagnostic — only logs when we got zero text (the bug case)
    if (textDeltaCount === 0) {
      console.error(
        `[parseStreamDeltas] Zero text deltas. Provider=${provider}. Event counts: ${JSON.stringify(eventCounts)}`
      );
    }
  }
}

function extractDeltaText(
  parsed: Record<string, unknown>,
  provider: string
): string | null {
  switch (provider) {
    case "anthropic":
      if (
        parsed.type === "content_block_delta" &&
        (parsed.delta as Record<string, unknown>)?.type === "text_delta"
      ) {
        return (parsed.delta as Record<string, string>).text;
      }
      return null;
    case "openai":
      return (
        ((parsed.choices as Array<Record<string, unknown>>)?.[0]
          ?.delta as Record<string, string>)?.content || null
      );
    case "google":
      return (
        ((parsed.candidates as Array<Record<string, unknown>>)?.[0]
          ?.content as Record<string, Array<Record<string, string>>>)
          ?.parts?.[0]?.text || null
      );
    default:
      return null;
  }
}

// ─── Provider implementations ──────────────────────────────────

async function callAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  return data.content
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("");
}

async function streamAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number
): Promise<Response> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic streaming error ${response.status}: ${errText.slice(0, 500)}`);
  }

  return response;
}

// Gemini 2.5/3 "thinking" models spend part of maxOutputTokens on an internal
// reasoning pass before any visible text is emitted — that reasoning draws
// from the SAME token budget as the answer (see extractGeminiText below).
// Nothing in this codebase asks for visible or budgeted reasoning, so every
// caller is better off with it switched off. thinkingBudget: 0 disables it
// on Flash-tier models; Pro-tier models enforce a small non-zero minimum
// instead of rejecting the field, so this is safe to send unconditionally.
// (Root cause of DEFECT 4 — short document summaries under the Google
// provider — could not be confirmed with a live call in this session; see
// the maxOutputTokens headroom and finishReason check below for the
// defensible fix that holds even if the true cause is something else, e.g.
// a stop sequence match.)
const GEMINI_THINKING_CONFIG = { thinkingBudget: 0 };

// Thinking tokens, when a model can't fully disable them, are still drawn
// from maxOutputTokens. A caller that asks for a short answer (e.g. a
// 200-token document summary) can have its entire budget consumed by
// reasoning before the model gets to the visible answer, which is returned
// truncated with no error — exactly the "two or three words" symptom.
// Padding the wire-level budget gives reasoning room without changing what
// callers ask for, and the finishReason check below surfaces the case
// loudly instead of silently handing back a truncated string.
const GEMINI_THINKING_HEADROOM_TOKENS = 1024;

function extractGeminiText(data: Record<string, unknown>, requestedMaxTokens: number): string {
  // deno-lint-ignore no-explicit-any
  const candidate = (data.candidates as any[])?.[0];
  const parts = candidate?.content?.parts as Array<{ text?: string }> | undefined;
  const text = (parts ?? [])
    .map((p) => p.text)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .join("");

  if (candidate?.finishReason === "MAX_TOKENS" && text.trim().length < 20) {
    console.error(
      `[callGemini] finishReason=MAX_TOKENS with only ${text.length} chars of visible text ` +
        `(requested maxOutputTokens=${requestedMaxTokens}). Likely cause: thinking/reasoning ` +
        "tokens consumed the output budget before the model reached the answer.",
    );
  }

  return text;
}

async function callGemini(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  options: LLMCallOptions = {}
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // deno-lint-ignore no-explicit-any
  const generationConfig: Record<string, any> = {
    maxOutputTokens: maxTokens + GEMINI_THINKING_HEADROOM_TOKENS,
    thinkingConfig: GEMINI_THINKING_CONFIG,
  };
  // Native structured output: far more reliable than a "return ONLY JSON" prompt.
  if (options.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.responseSchema;
  }

  // Key goes in the x-goog-api-key header, never the query string (URLs land
  // in upstream and proxy logs).
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  return extractGeminiText(data, maxTokens);
}

async function streamGemini(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number
): Promise<Response> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini streaming error ${response.status}: ${errText.slice(0, 500)}`);
  }

  return response;
}

async function callOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number
): Promise<string> {
  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: openaiMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function streamOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number
): Promise<Response> {
  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      stream: true,
      messages: openaiMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI streaming error ${response.status}: ${errText.slice(0, 500)}`);
  }

  return response;
}
