import type { NeraQueryRequest, StreamCallbacks } from '@shared/types';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Not signed in');
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Supabase anon key missing');
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

/**
 * Stream a Nera conversation query via SSE.
 * Used for both the pre-meeting stakeholder engagement and the workshop AI chatbot.
 */
export async function queryNeraStreaming(
  apiUrl: string,
  query: string,
  sessionId: string,
  callbacks: StreamCallbacks,
  extra?: Partial<NeraQueryRequest>,
): Promise<void> {
  try {
    const request: NeraQueryRequest = {
      query,
      session_id: sessionId,
      ...extra,
    };

    const authHeaders = await getAuthHeaders();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      callbacks.onError(`API error: ${response.statusText}`);
      return;
    }

    const contentType = response.headers.get('content-type') || '';

    // JSON response (clarifications, errors, or non-streaming fallback)
    if (contentType.includes('application/json')) {
      const data = await response.json();
      callbacks.onMeta({
        type: data.type,
        sources: data.sources,
        query_id: data.query_id,
        answer: data.answer,
        options: data.options,
      });
      callbacks.onDone();
      return;
    }

    // SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            switch (currentEvent) {
              case 'meta':
                callbacks.onMeta(parsed);
                break;
              case 'delta':
                callbacks.onDelta(parsed.text);
                break;
              case 'done':
                callbacks.onDone();
                break;
              case 'error':
                callbacks.onError(parsed.message || 'Stream error');
                break;
            }
          } catch {
            // Skip malformed SSE events
          }
        }
      }
    }
  } catch (error) {
    callbacks.onError(error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

/**
 * Non-streaming Nera query (for simple requests).
 */
export async function queryNera(
  apiUrl: string,
  query: string,
  sessionId: string,
  extra?: Partial<NeraQueryRequest>,
): Promise<{ data?: any; error?: { message: string } }> {
  try {
    const request: NeraQueryRequest = {
      query,
      session_id: sessionId,
      ...extra,
    };

    const authHeaders = await getAuthHeaders();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return { error: { message: `API error: ${response.statusText}` } };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Unknown error' } };
  }
}
