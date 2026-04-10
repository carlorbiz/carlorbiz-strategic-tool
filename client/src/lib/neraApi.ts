import { NeraQueryRequest, NeraQueryResponse, ChatSource, TriageOption } from '@/types/chat';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const NERA_API_URL = import.meta.env.VITE_NERA_API_URL ||
  `${SUPABASE_URL || 'https://ksfdabyledggbeweeqta.supabase.co'}/functions/v1/nera-query`;

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

export interface NeraApiError {
  message: string;
  status?: number;
}

export interface StreamCallbacks {
  onMeta: (meta: {
    type: string;
    sources?: string[];
    query_id?: string;
    answer?: string;
    options?: TriageOption[];
  }) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function queryNera(
  query: string,
  sessionId: string,
  userId?: string
): Promise<{ data?: NeraQueryResponse; error?: NeraApiError }> {
  try {
    const request: NeraQueryRequest = {
      query,
      session_id: sessionId,
      user_id: userId,
    };

    const authHeaders = await getAuthHeaders();
    const response = await fetch(NERA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return {
        error: {
          message: `API error: ${response.statusText}`,
          status: response.status,
        },
      };
    }

    const data: NeraQueryResponse = await response.json();
    return { data };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    };
  }
}

export async function queryNeraStreaming(
  query: string,
  sessionId: string,
  callbacks: StreamCallbacks,
  userId?: string
): Promise<void> {
  try {
    const request: NeraQueryRequest = {
      query,
      session_id: sessionId,
      user_id: userId,
    };

    const authHeaders = await getAuthHeaders();
    const response = await fetch(NERA_API_URL, {
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
      const data: NeraQueryResponse = await response.json();
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
    callbacks.onError(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

export async function submitNeraFeedback(
  queryId: string,
  score: -1 | 1,
  userId?: string
): Promise<{ error?: NeraApiError }> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(NERA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        feedback: {
          query_id: queryId,
          score,
          user_id: userId,
        },
      }),
    });

    if (!response.ok) {
      return {
        error: {
          message: `Feedback error: ${response.statusText}`,
          status: response.status,
        },
      };
    }

    return {};
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    };
  }
}

// Transform Nera's source format to our ChatSource format
export function transformSources(sources: string[]): ChatSource[] {
  return sources.map(source => ({
    title: source,
  }));
}
