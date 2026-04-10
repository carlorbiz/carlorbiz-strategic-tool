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

// ─── Non-streaming call ────────────────────────────────────────

export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens = 2048
): Promise<string> {
  switch (config.provider) {
    case "anthropic":
      return callAnthropic(config, systemPrompt, messages, maxTokens);
    case "google":
      return callGemini(config, systemPrompt, messages, maxTokens);
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

async function callGemini(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
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
