/**
 * Shared LLM abstraction for Supabase Edge Functions.
 * Supports Anthropic (direct) and OpenRouter as fallback.
 * Matches the carlorbiz-website pattern.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: any }>;
}

export interface LLMOptions {
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function invokeLLM(options: LLMOptions): Promise<LLMResponse> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (anthropicKey) {
    return invokeAnthropic(anthropicKey, options);
  } else if (openRouterKey) {
    return invokeOpenRouter(openRouterKey, options);
  } else if (geminiKey) {
    return invokeGemini(geminiKey, options);
  }

  throw new Error('No LLM API key configured. Set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY.');
}

async function invokeAnthropic(apiKey: string, options: LLMOptions): Promise<LLMResponse> {
  const systemMessage = options.messages.find((m) => m.role === 'system');
  const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
      system: typeof systemMessage?.content === 'string' ? systemMessage.content : undefined,
      messages: nonSystemMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    content: data.content?.[0]?.text || '',
    model: data.model,
    usage: data.usage,
  };
}

async function invokeOpenRouter(apiKey: string, options: LLMOptions): Promise<LLMResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'anthropic/claude-sonnet-4-20250514',
      messages: options.messages,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model,
    usage: data.usage
      ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens }
      : undefined,
  };
}

async function invokeGemini(apiKey: string, options: LLMOptions): Promise<LLMResponse> {
  const model = 'gemini-2.5-flash';
  const systemInstruction = options.messages.find((m) => m.role === 'system');
  const contents = options.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemInstruction
          ? { parts: [{ text: typeof systemInstruction.content === 'string' ? systemInstruction.content : '' }] }
          : undefined,
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens || 2048,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model,
    usage: data.usageMetadata
      ? {
          input_tokens: data.usageMetadata.promptTokenCount,
          output_tokens: data.usageMetadata.candidatesTokenCount,
        }
      : undefined,
  };
}
