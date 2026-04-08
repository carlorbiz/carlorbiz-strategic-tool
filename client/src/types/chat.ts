export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  chatFunction?: 'question' | 'swot_categorisation' | 'narrative_summary';
}

export interface NeraChatSession {
  sessionId: string;
  workshopSessionId?: string;
  messages: ChatMessage[];
  status: 'active' | 'completed';
  createdAt: number;
}

export interface SSEEvent {
  event: 'meta' | 'delta' | 'done' | 'error';
  data: {
    text?: string;
    type?: string;
    session_id?: string;
    message?: string;
  };
}
