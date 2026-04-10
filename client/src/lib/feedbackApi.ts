import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const FEEDBACK_API_URL = `${SUPABASE_URL}/functions/v1/feedback-chat`;

export interface FeedbackCampaign {
  id: string;
  campaign_slug: string;
  title: string;
  description: string | null;
  welcome_message: string | null;
  branding_config: Record<string, unknown>;
  status: string;
}

export interface FeedbackSession {
  id: string;
  session_token: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FeedbackStreamCallbacks {
  onMeta: () => void;
  onDelta: (text: string) => void;
  onDone: (hasJson: boolean) => void;
  onError: (error: string) => void;
}

export async function loadCampaignBySlug(
  slug: string
): Promise<FeedbackCampaign | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('feedback_campaigns')
    .select(
      'id, campaign_slug, title, description, welcome_message, branding_config, status'
    )
    .eq('campaign_slug', slug)
    .single();

  if (error || !data) return null;
  return data as FeedbackCampaign;
}

export async function createFeedbackSession(
  campaignId: string
): Promise<FeedbackSession | null> {
  if (!supabase) return null;

  // Generate IDs client-side to avoid needing a SELECT after insert
  // (RLS only allows admin SELECT on feedback_sessions)
  const id = crypto.randomUUID();
  const session_token = crypto.randomUUID();

  const { error } = await supabase
    .from('feedback_sessions')
    .insert({ id, session_token, campaign_id: campaignId });

  if (error) return null;
  return { id, session_token };
}

export async function quickSubmitSession(
  sessionId: string,
  sessionToken: string
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('feedback_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('session_token', sessionToken);

  return !error;
}

export async function sendFeedbackMessage(
  request: {
    campaign_id: string;
    session_id: string;
    session_token: string;
    message: string;
    conversation_history: ConversationMessage[];
  },
  callbacks: FeedbackStreamCallbacks
): Promise<void> {
  try {
    const response = await fetch(FEEDBACK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      callbacks.onError(`API error: ${response.statusText}`);
      return;
    }

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
          try {
            const parsed = JSON.parse(line.slice(6));
            switch (currentEvent) {
              case 'meta':
                callbacks.onMeta();
                break;
              case 'delta':
                callbacks.onDelta(parsed.text);
                break;
              case 'done':
                callbacks.onDone(!!parsed.has_json);
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
