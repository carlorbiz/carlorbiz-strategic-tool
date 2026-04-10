export interface ChatSource {
  title: string;
  url?: string;
  snippet?: string;
}

export interface TriageOption {
  label: string;   // Display text, e.g. "AGPT (Australian General Practice Training)"
  value: string;   // Value sent back as the query, e.g. "agpt"
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
  feedbackScore?: -1 | 0 | 1;
  responseType?: 'answer' | 'clarification';
  options?: TriageOption[];
  queryId?: string;
}

export interface ChatSession {
  id: string;
  userId?: string;
  startedAt: Date;
  messages: ChatMessage[];
}

export interface NeraQueryRequest {
  query: string;
  user_id?: string;
  session_id: string;
}

export interface NeraQueryResponse {
  type: 'answer' | 'clarification';
  answer: string;
  sources: string[];
  options?: TriageOption[];
  query_id?: string;
}

export interface ChatContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  sessionId: string;
  sendMessage: (text: string) => Promise<void>;
  selectOption: (option: TriageOption) => Promise<void>;
  submitFeedback: (messageId: string, score: -1 | 1) => Promise<void>;
  clearHistory: () => void;
}
