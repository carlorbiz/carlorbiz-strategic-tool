import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Lock, ArrowRight, MessageSquare, Calendar, Send } from 'lucide-react';

interface InterviewModeConfig {
  systemPrompt: string;
  opener: string;
  suggestedPrompts?: string[];
}

interface NeraInlineViewerProps {
  intro?: string | null;
  /** If provided, runs in interview mode with a custom system prompt and opening message */
  interviewMode?: InterviewModeConfig;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Suggested prompts should lead to direct, closed-end answers — not open-ended
// follow-up questions. Each one should map to a specific piece of content on the site.
const SUGGESTED_PROMPTS = [
  'Explain the four stages of the DAIS methodology',
  'What does Transformation Staging actually involve?',
  'What is a knowledge platform?',
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const NERA_API_URL =
  import.meta.env.VITE_NERA_API_URL ||
  `${SUPABASE_URL || 'https://ksfdabyledggbeweeqta.supabase.co'}/functions/v1/nera-query`;

// Client-side rate limit: max 3 queries per browser session, resets after 10 minutes.
// Protects against casual abuse of the public demo. Real protection happens
// server-side via the EnquiryIntake magic-link flow for anyone who wants
// more depth.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_KEY = 'carlorbiz_nera_public_usage';

const SESSION_ID_KEY = 'carlorbiz_nera_session_id';

interface RateLimitState {
  count: number;
  windowStart: number;
}

function getRateLimitState(): RateLimitState {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { count: 0, windowStart: Date.now() };
    const parsed = JSON.parse(raw) as RateLimitState;
    // Reset window if expired
    if (Date.now() - parsed.windowStart > RATE_LIMIT_WINDOW_MS) {
      return { count: 0, windowStart: Date.now() };
    }
    return parsed;
  } catch {
    return { count: 0, windowStart: Date.now() };
  }
}

function incrementRateLimit(): RateLimitState {
  const state = getRateLimitState();
  const newState = { count: state.count + 1, windowStart: state.windowStart };
  try { localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newState)); } catch { /* noop */ }
  return newState;
}

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const newId = `public-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, newId);
    return newId;
  } catch {
    return `public-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

function NeraSoftGate({ isInterviewMode }: { isInterviewMode?: boolean }) {
  if (isInterviewMode) {
    // Interview/survey mode: no gate, just end the conversation
    return null;
  }

  return (
    <div className="mt-6 rounded-xl border-2 border-[var(--color-brand-accent)] bg-gradient-to-br from-[var(--color-brand-accent)]/5 to-transparent p-6 space-y-5">
      <div className="space-y-3">
        <p className="font-heading font-bold text-lg text-foreground">
          That was a fixed-path conversation.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The full version doesn&rsquo;t follow a script &mdash; Nera reads your response, decides which thread to follow, and goes where the insight is. Every conversation is different. Every insight card reflects you.
        </p>
        <p className="text-sm font-medium text-foreground">
          Three scenarios to explore: strategic direction, team dynamics, or impact and evidence.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <a
          href="/contact"
          className="group flex items-center gap-3 rounded-lg border border-[var(--color-brand-primary)]/20 bg-white p-4 hover:border-[var(--color-brand-primary)] hover:shadow-md transition-all"
        >
          <MessageSquare className="h-5 w-5 text-[var(--color-brand-primary)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm text-[var(--color-brand-dark)]">Start a conversation with Carla</p>
            <p className="text-xs text-muted-foreground">Tell me what you&rsquo;re working on</p>
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--color-brand-primary)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </a>
        <a
          href="/services#what-will-it-cost"
          className="group flex items-center gap-3 rounded-lg border border-[var(--color-brand-accent)]/30 bg-white p-4 hover:border-[var(--color-brand-accent)] hover:shadow-md transition-all"
        >
          <Calendar className="h-5 w-5 text-[var(--color-brand-accent)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm text-[var(--color-brand-dark)]">Explore pricing</p>
            <p className="text-xs text-muted-foreground">Walk through your options with Nera</p>
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--color-brand-accent)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </a>
      </div>
    </div>
  );
}

export function NeraInlineViewer({ intro, interviewMode }: NeraInlineViewerProps) {
  const [input, setInput] = useState('');
  // Interview mode: pre-populate with opener message
  const [messages, setMessages] = useState<ChatMessage[]>(
    interviewMode?.opener ? [{ role: 'assistant', content: interviewMode.opener }] : []
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingQueries, setRemainingQueries] = useState(RATE_LIMIT_MAX);
  // Interview mode gets its own session ID to keep conversations separate
  const [sessionId] = useState<string>(
    interviewMode ? `interview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : getOrCreateSessionId()
  );
  const threadEndRef = useRef<HTMLDivElement>(null);
  const threadContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSuggestions = interviewMode?.suggestedPrompts ?? SUGGESTED_PROMPTS;
  const hasAsked = messages.some((m) => m.role === 'user');
  const limitReached = error === 'limit-reached' || remainingQueries === 0;

  // Hydrate rate limit state from localStorage on mount
  useEffect(() => {
    const state = getRateLimitState();
    setRemainingQueries(Math.max(0, RATE_LIMIT_MAX - state.count));
  }, []);

  // Auto-scroll within the thread container only — never scroll the page itself.
  // This keeps the accordion and Nera's response visible while streaming.
  useEffect(() => {
    const container = threadContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Focus input after streaming completes
  useEffect(() => {
    if (!isStreaming && hasAsked && !limitReached) {
      inputRef.current?.focus();
    }
  }, [isStreaming, hasAsked, limitReached]);

  const submit = useCallback(async (query: string) => {
    if (!query.trim() || isStreaming) return;

    // Rate limit check
    const state = getRateLimitState();
    if (state.count >= RATE_LIMIT_MAX) {
      setError('limit-reached');
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: query.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setError(null);

    // Add a placeholder assistant message that we will stream into
    const assistantIndex = messages.length + 1; // index after user message is appended
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch(NERA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          query,
          session_id: sessionId,
          public: true,
          ...(interviewMode?.systemPrompt ? {
            system_prompt_override: interviewMode.systemPrompt,
            // Send full conversation history so the LLM sees all prior exchanges
            // and doesn't repeat questions. Format as chat messages.
            conversation_history: messages
              .filter(m => m.content) // skip empty placeholders
              .map(m => ({ role: m.role, content: m.content })),
          } : {}),
        }),
      });

      if (!res.ok) {
        setError(`Sorry, I couldn't answer that right now (${res.status}).`);
        // Remove the empty assistant placeholder
        setMessages((prev) => prev.filter((_, i) => i !== assistantIndex));
        setIsStreaming(false);
        return;
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m, i) =>
            i === assistantIndex ? { ...m, content: data.answer || '' } : m
          )
        );
        setIsStreaming(false);
        const newState = incrementRateLimit();
        setRemainingQueries(Math.max(0, RATE_LIMIT_MAX - newState.count));
        return;
      }

      // SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let accumulated = '';

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
              if (currentEvent === 'delta' && parsed.text) {
                accumulated += parsed.text;
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === assistantIndex ? { ...m, content: accumulated } : m
                  )
                );
              } else if (currentEvent === 'meta' && parsed.answer) {
                accumulated = parsed.answer;
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === assistantIndex ? { ...m, content: accumulated } : m
                  )
                );
              } else if (currentEvent === 'error') {
                setError(parsed.message || 'Stream error');
              }
            } catch {
              // skip malformed
            }
          }
        }
      }

      setIsStreaming(false);

      // Successful query -> increment counter
      const newState = incrementRateLimit();
      setRemainingQueries(Math.max(0, RATE_LIMIT_MAX - newState.count));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Remove empty assistant placeholder on error
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      setIsStreaming(false);
    }
  }, [isStreaming, messages.length, sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
    submit(prompt);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      {/* Intro text */}
      {intro && (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
        </div>
      )}

      {/* Gold divider between intro and interaction area */}
      {intro && (
        <div className="h-px bg-gradient-to-r from-transparent via-[#D5B13A]/40 to-transparent my-6" />
      )}

      {/* Suggested prompts — only before first question */}
      {!hasAsked && !interviewMode && (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Carlorbiz services, methodology, or pricing..."
              disabled={isStreaming}
              className="flex-1 border-2 border-border rounded-md px-4 py-3 focus:border-[var(--color-brand-accent)] outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="bg-[image:var(--gradient-accent)] text-white font-semibold px-6 py-3 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Ask Nera
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {activeSuggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSuggestion(prompt)}
                disabled={isStreaming}
                className="bg-muted hover:bg-[var(--color-brand-accent)]/10 border border-border rounded-full px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Conversation thread */}
      {messages.length > 0 && (
        <div ref={threadContainerRef} className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[var(--color-brand-primary)] text-white rounded-br-sm'
                    : 'bg-muted border border-border rounded-bl-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                ) : msg.content ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {/* "Nera is thinking..." indicator during streaming */}
          {isStreaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{interviewMode && messages.filter(m => m.role === 'user').length >= 3
                  ? 'Compiling insights from our conversation...'
                  : interviewMode
                    ? 'Considering your response...'
                    : 'Nera is thinking...'
                }</span>
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>
      )}

      {/* Error display (non-limit errors) */}
      {error && error !== 'limit-reached' && (
        <div className="mt-4 bg-destructive/10 border border-destructive/30 rounded-md p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Interview mode: input with suggested responses shown after opener */}
      {interviewMode && !hasAsked && !limitReached && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {activeSuggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSuggestion(prompt)}
                disabled={isStreaming}
                className="bg-muted hover:bg-[var(--color-brand-accent)]/10 border border-border rounded-full px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Or type your own response..."
              disabled={isStreaming}
              className="flex-1 border-2 border-border rounded-md px-4 py-2.5 text-sm focus:border-[var(--color-brand-accent)] outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="bg-[image:var(--gradient-accent)] text-white px-4 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Follow-up input — shown after first question, when not at limit */}
      {hasAsked && !limitReached && (
        <div className="mt-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={interviewMode ? "Type your response..." : "Ask a follow-up..."}
              disabled={isStreaming}
              className="flex-1 border-2 border-border rounded-md px-4 py-2.5 text-sm focus:border-[var(--color-brand-accent)] outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="bg-[image:var(--gradient-accent)] text-white px-4 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Send"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {remainingQueries} {remainingQueries === 1 ? 'question' : 'questions'} remaining
          </p>
        </div>
      )}

      {/* Soft gate when limit is reached */}
      {limitReached && <NeraSoftGate isInterviewMode={!!interviewMode} />}
    </div>
  );
}
