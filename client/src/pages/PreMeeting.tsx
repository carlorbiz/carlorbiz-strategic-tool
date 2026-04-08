import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useParams } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { queryNeraStreaming } from '@/lib/neraApi';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Send, User, Bot, Loader2 } from 'lucide-react';

const PREMEETING_API_URL =
  import.meta.env.VITE_NERA_PREMEETING_API_URL ||
  `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/nera-premeeting`;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function PreMeeting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, isAuthenticated, signInWithMagicLink } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [neraSessionId] = useState(() => {
    const stored = sessionStorage.getItem(`nera-premeeting-${sessionId}`);
    if (stored) return stored;
    const id = `pm-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(`nera-premeeting-${sessionId}`, id);
    return id;
  });

  // Email gate for unauthenticated users
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Load previous conversation from Supabase if returning user
  useEffect(() => {
    if (!isAuthenticated || !supabase || !sessionId) return;

    const loadPrevious = async () => {
      const { data } = await supabase!
        .from('stakeholder_inputs')
        .select('conversation_history')
        .eq('session_id', sessionId)
        .eq('user_id', user?.user_id)
        .eq('input_type', 'nera_conversation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data?.conversation_history) {
        const restored = data.conversation_history.map((m: any, i: number) => ({
          id: `restored-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(),
        }));
        setMessages(restored);
      }
    };

    loadPrevious();
  }, [isAuthenticated, sessionId, user?.user_id]);

  // Add welcome message on first load
  useEffect(() => {
    if (messages.length === 0 && isAuthenticated) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            "Welcome to the pre-meeting strategic planning conversation. I'm Nera, and I'll be guiding you through some questions to capture your insights before the workshop.\n\nYour input will directly inform the Board's strategic planning session. Everything you share here is confidential and will be synthesised with other stakeholder contributions.\n\nLet's start — **what do you see as the most significant challenge facing the organisation in the next 3–5 years?**",
          timestamp: new Date(),
        },
      ]);
    }
  }, [isAuthenticated, messages.length]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
    ]);

    try {
      await queryNeraStreaming(
        PREMEETING_API_URL,
        userMsg.content,
        neraSessionId,
        {
          onMeta: () => {},
          onDelta: (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + text } : m,
              ),
            );
          },
          onDone: () => {
            setIsStreaming(false);
            // Persist conversation to Supabase
            persistConversation();
          },
          onError: (error) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `I'm sorry, I encountered an issue: ${error}. Please try again.` }
                  : m,
              ),
            );
            setIsStreaming(false);
          },
        },
        {
          user_id: user?.user_id,
          workshop_session_id: sessionId,
          context: 'pre-meeting stakeholder engagement',
        },
      );
    } catch {
      setIsStreaming(false);
    }
  }, [input, isStreaming, neraSessionId, sessionId, user?.user_id]);

  const persistConversation = async () => {
    if (!supabase || !sessionId) return;
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    await supabase.from('stakeholder_inputs').upsert(
      {
        session_id: sessionId,
        user_id: user?.user_id || null,
        participant_name: user?.full_name || null,
        participant_email: user?.email || null,
        input_type: 'nera_conversation',
        nera_session_id: neraSessionId,
        conversation_history: history,
        content: { message_count: history.length },
      },
      { onConflict: 'nera_session_id' },
    );
  };

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setEmailError('');
    sessionStorage.setItem('auth_return_path', `/pre-meeting/${sessionId}`);
    const result = await signInWithMagicLink(email);
    if (result.error) {
      setEmailError(result.error);
    } else {
      setEmailSent(true);
    }
  };

  // Email gate for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center">
          <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">
            Pre-Meeting Stakeholder Input
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Sign in with your email to begin the Nera-conversation. Your input will be saved and
            you can return at any time to continue.
          </p>

          {emailSent ? (
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-primary font-medium">Check your email</p>
              <p className="text-sm text-muted-foreground mt-1">
                We've sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
              />
              {emailError && <p className="text-destructive text-sm">{emailError}</p>}
              <button
                onClick={handleMagicLink}
                className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Send Magic Link
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 shrink-0">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors no-underline"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-heading font-semibold text-foreground text-sm">
                Pre-Meeting Engagement
              </h1>
              <p className="text-xs text-muted-foreground">Nera-conversation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">{user?.full_name || user?.email}</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.role === 'assistant' && !msg.content && isStreaming && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Share your thoughts..."
            rows={1}
            className="flex-1 px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
