// Strategic-tool Nera client — talks to the engagement-scoped st-nera-query
// edge function. Keep separate from neraApi.ts (which is the website chatbot).

import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const ST_NERA_API_URL = `${SUPABASE_URL}/functions/v1/st-nera-query`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Not signed in');
  if (!SUPABASE_ANON_KEY) throw new Error('Supabase anon key missing');
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

export interface StStreamCallbacks {
  onMeta: (meta: { type: string; sources?: string[]; query_id?: string }) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function queryStNeraStreaming(
  engagementId: string,
  query: string,
  sessionId: string,
  callbacks: StStreamCallbacks,
): Promise<void> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(ST_NERA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        engagement_id: engagementId,
        query,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      callbacks.onError(`API error (${response.status}): ${body || response.statusText}`);
      return;
    }

    const contentType = response.headers.get('content-type') || '';

    // JSON fallback (e.g. when the function short-circuits on error)
    if (contentType.includes('application/json')) {
      const data = await response.json();
      callbacks.onMeta({
        type: data.type ?? 'answer',
        sources: data.sources ?? [],
        query_id: data.query_id,
      });
      if (typeof data.answer === 'string' && data.answer.length > 0) {
        callbacks.onDelta(data.answer);
      }
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
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : 'Unknown error');
  }
}

export async function submitStNeraFeedback(
  queryId: string,
  score: -1 | 1,
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  await fetch(ST_NERA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ feedback: { query_id: queryId, score } }),
  });
}

export function transformStSources(sources: string[]) {
  return sources.map((s) => ({ title: s }));
}
