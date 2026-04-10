import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Send, CheckCircle2, AlertCircle, Mail, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface EnquiryIntakeProps {
  source?: string;
  opener?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const NERA_API_URL =
  import.meta.env.VITE_NERA_API_URL ||
  `${SUPABASE_URL}/functions/v1/nera-query`;

const INTAKE_SYSTEM_PROMPT = `You are Nera, conducting a brief intake interview on behalf of Carla Taylor at Carlorbiz. A visitor is interested in working with Carla but hasn't found an exact match in the decision tree. Your job is to gather enough context for Carla to have a meaningful follow-up conversation.

## Your objectives — in order

1. **Understand their situation**: what prompted them to come to Carlorbiz today?
2. **Understand their organisation**: what kind of organisation, what sector, rough scale
3. **Understand the challenge**: what problem are they actually trying to solve? (Not the solution they think they want — the underlying problem.)
4. **Understand the urgency**: is this exploratory or active? Any driving timeline?
5. **Understand what good looks like**: what outcome would make this worth the investment?

## How to conduct the interview

- **Ask ONE question at a time.** Wait for the answer before moving on.
- Warm but direct. Carla's brand voice: honest, unpretentious, senior.
- Australian English. "Organisation", "behaviour", "colour".
- If they give a short answer, probe gently for one follow-up — but don't interrogate. Two questions per topic maximum.
- Listen for the problem behind the problem. If someone says "we need a website", ask what they believe a website will solve.
- DO NOT try to sell. DO NOT pitch services. You are purely listening and noting.
- DO NOT quote prices or promise timelines — that's Carla's job when she follows up.
- Keep each of your messages to 1–3 sentences unless recapping.

## Wrapping up

After 5-7 exchanges, when you have enough context, end with:
*"Thanks — I've got what Carla needs to have a useful first conversation with you. Click 'Send to Carla' below when you're ready, and she'll be in touch within a couple of business days."*

## What you are NOT doing here

- You are not answering questions about Carlorbiz services in this mode. If they ask "how much does it cost?", respond: "That depends on what you're actually building. Once Carla understands your situation, she'll give you a proper scope. Can I ask what's driving the timing for you?"
- You are not recommending a specific service. That's premature.
- You are not promising outcomes. You're understanding them.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

type Phase = 'email-gate' | 'email-sent' | 'chat' | 'details' | 'submitting' | 'done' | 'error';

export function EnquiryIntake({
  source = 'services-decision-tree',
  opener = "Hi — I'm Nera. I'll ask a few questions to understand what you're working on, then hand you over to Carla with a proper brief. To start: what's prompted you to come to Carlorbiz today?",
}: EnquiryIntakeProps) {
  const { user, isLoading: authLoading } = useAuth();
  // Phase starts as 'chat' once we know user is authenticated; 'email-gate' otherwise.
  const [phase, setPhase] = useState<Phase>('email-gate');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email gate state
  const [gateEmail, setGateEmail] = useState('');
  const [sendingMagicLink, setSendingMagicLink] = useState(false);

  // Contact details (name required at end; email already known from auth)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [organisation, setOrganisation] = useState('');

  // Returning visitor context (populated from prior enquiries)
  const [priorEnquiry, setPriorEnquiry] = useState<{
    name: string;
    organisation: string | null;
    source: string;
    created_at: string;
    count: number;
  } | null>(null);

  const sessionIdRef = useRef<string>(
    `enquiry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-advance past email gate if user is already authenticated
  // AND look up prior enquiries so we can greet returning visitors by name.
  useEffect(() => {
    if (authLoading) return;
    if (!user || phase !== 'email-gate') return;

    let cancelled = false;
    (async () => {
      if (!supabase) {
        // No Supabase — fall through to standard opener
        if (cancelled) return;
        setPhase('chat');
        setMessages([{ role: 'assistant', content: opener, timestamp: new Date().toISOString() }]);
        return;
      }

      // Look up prior enquiries from this user
      const { data: priors } = await supabase
        .from('enquiries')
        .select('name, organisation, source, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (cancelled) return;

      if (priors && priors.length > 0) {
        const latest = priors[0] as { name: string; organisation: string | null; source: string; created_at: string };
        setPriorEnquiry({ ...latest, count: priors.length });
        // Pre-fill contact form fields for faster submit later
        setName(latest.name);
        if (latest.organisation) setOrganisation(latest.organisation);

        // Tailored opener for returning visitors
        const firstName = latest.name.split(' ')[0];
        const tailoredOpener = `Welcome back, ${firstName}. Good to see you again — I've got your details from last time. What brings you back today?`;
        setMessages([
          { role: 'assistant', content: tailoredOpener, timestamp: new Date().toISOString() },
        ]);
      } else {
        // First-time visitor (verified but no prior enquiries yet)
        setMessages([{ role: 'assistant', content: opener, timestamp: new Date().toISOString() }]);
      }

      setPhase('chat');
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, phase, opener]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isStreaming]);

  const visitorTurns = messages.filter((m) => m.role === 'user').length;
  const canHandoff = visitorTurns >= 2;

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateEmail.trim() || sendingMagicLink) return;
    if (!supabase) {
      setError('Authentication unavailable. Please email carla@carlorbiz.com.au directly.');
      return;
    }

    setSendingMagicLink(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/services?intake=continue`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: gateEmail.trim(),
        options: { emailRedirectTo: redirectTo },
      });

      if (otpError) {
        setError(`Couldn't send verification link (${otpError.message}).`);
        setSendingMagicLink(false);
        return;
      }

      // Store the pending intake context so we can resume after magic link click
      try {
        localStorage.setItem(
          'carlorbiz_pending_intake',
          JSON.stringify({ email: gateEmail.trim(), source, opener, ts: Date.now() })
        );
      } catch {
        // localStorage unavailable — OK, we'll just show fresh chat after verification
      }

      setPhase('email-sent');
      setSendingMagicLink(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSendingMagicLink(false);
    }
  };

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isStreaming || !supabase) return;

    const newUserMsg: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setIsStreaming(true);
    setError(null);

    try {
      // Get current auth session — EnquiryIntake requires authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setError('Your session expired. Please refresh and verify your email again.');
        setIsStreaming(false);
        setPhase('email-gate');
        return;
      }

      const res = await fetch(NERA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          query: userMessage,
          session_id: sessionIdRef.current,
          system_prompt_override: INTAKE_SYSTEM_PROMPT,
        }),
      });

      if (!res.ok) {
        setError(`Nera couldn't respond right now (${res.status}). Your conversation is still saved — click "Send to Carla" below and she'll take it from here.`);
        setIsStreaming(false);
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      let reply = '';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        reply = data.answer || '';
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
        ]);
      } else {
        // SSE stream
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

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
                if (currentEvent === 'delta' && parsed.text) {
                  reply += parsed.text;
                  setMessages((prev) => {
                    const next = [...prev];
                    next[next.length - 1] = { ...next[next.length - 1], content: reply };
                    return next;
                  });
                } else if (currentEvent === 'meta' && parsed.answer) {
                  reply = parsed.answer;
                  setMessages((prev) => {
                    const next = [...prev];
                    next[next.length - 1] = { ...next[next.length - 1], content: reply };
                    return next;
                  });
                }
              } catch {
                // skip malformed
              }
            }
          }
        }
      }

      setIsStreaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsStreaming(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handoff = () => {
    setPhase('details');
  };

  const submitEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user?.email) return;

    setPhase('submitting');
    setError(null);

    try {
      const summary = generateFallbackSummary(messages, name, organisation);

      const { error: insertError } = await supabase!.from('enquiries').insert({
        name: name.trim(),
        email: user.email,
        phone: phone.trim() || null,
        organisation: organisation.trim() || null,
        source,
        conversation: messages,
        summary,
        status: 'new',
        user_id: user.id,
      });

      if (insertError) {
        setError(`Couldn't save your enquiry (${insertError.message}). Please email carla@carlorbiz.com.au directly.`);
        setPhase('error');
        return;
      }

      // Clear pending intake state
      try { localStorage.removeItem('carlorbiz_pending_intake'); } catch { /* noop */ }

      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER PHASES
  // ──────────────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  // Phase: EMAIL GATE
  if (phase === 'email-gate') {
    return (
      <div className="bg-card border border-border rounded-lg p-6 md:p-8">
        <div className="flex items-start gap-3 mb-4">
          <Shield
            className="h-6 w-6 flex-shrink-0 mt-1"
            style={{ color: 'var(--color-brand-primary)' }}
          />
          <div>
            <h3 className="font-heading font-bold text-xl mb-1 text-foreground">
              Verify your email to begin
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We send a one-click verification link so Carla knows real people are on the other end. No password. No spam. It takes about 30 seconds.
            </p>
          </div>
        </div>

        <form onSubmit={sendMagicLink} className="space-y-3 mt-6">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Your email
            </label>
            <input
              type="email"
              value={gateEmail}
              onChange={(e) => setGateEmail(e.target.value)}
              required
              disabled={sendingMagicLink}
              placeholder="you@organisation.com"
              className="w-full border-2 border-border rounded-md px-4 py-3 focus:border-[var(--color-brand-accent)] outline-none transition-colors disabled:opacity-60"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={sendingMagicLink || !gateEmail.trim()}
            className="bg-[image:var(--gradient-accent)] text-white font-semibold px-6 py-3 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full"
          >
            {sendingMagicLink ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send verification link
              </>
            )}
          </button>
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </form>
      </div>
    );
  }

  // Phase: EMAIL SENT
  if (phase === 'email-sent') {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <Mail
          className="h-12 w-12 mx-auto mb-4"
          style={{ color: 'var(--color-brand-primary)' }}
        />
        <h3 className="font-heading font-bold text-2xl mb-3 cb-heading-gradient">
          Check your email
        </h3>
        <p className="text-base text-muted-foreground leading-relaxed max-w-md mx-auto mb-4">
          We&rsquo;ve sent a verification link to <strong className="text-foreground">{gateEmail}</strong>. Click it to come back here and continue the conversation with Nera.
        </p>
        <p className="text-xs text-muted-foreground">
          Link not arriving? Check your spam folder, or refresh this page to try again.
        </p>
      </div>
    );
  }

  // Phase: DONE
  if (phase === 'done') {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <CheckCircle2
          className="h-12 w-12 mx-auto mb-4"
          style={{ color: 'var(--color-brand-primary)' }}
        />
        <h3 className="font-heading font-bold text-2xl mb-3 cb-heading-gradient">
          Passed to Carla.
        </h3>
        <p className="text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
          Thanks {name.split(' ')[0]}. Carla will review what you&rsquo;ve shared and reach out within a couple of business days. Check your inbox at <strong>{user?.email}</strong>.
        </p>
      </div>
    );
  }

  // Phase: ERROR
  if (phase === 'error') {
    return (
      <div className="bg-destructive/5 border border-destructive/30 rounded-lg p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-heading font-semibold text-sm text-destructive mb-1">Couldn&rsquo;t submit</p>
          <p className="text-sm text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Phase: DETAILS
  if (phase === 'details') {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-heading font-bold text-xl mb-2 text-foreground">
          Last step — who is Carla following up with?
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          We&rsquo;ve got your email. Just need a name and anything else that&rsquo;ll help Carla come prepared.
        </p>
        <form onSubmit={submitEnquiry} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Your name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border-2 border-border rounded-md px-4 py-2.5 focus:border-[var(--color-brand-accent)] outline-none transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Organisation <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              className="w-full border-2 border-border rounded-md px-4 py-2.5 focus:border-[var(--color-brand-accent)] outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Phone <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border-2 border-border rounded-md px-4 py-2.5 focus:border-[var(--color-brand-accent)] outline-none transition-colors"
            />
          </div>
          <div className="bg-muted/40 rounded-md px-3 py-2 text-xs text-muted-foreground">
            Email (from verification): <strong className="text-foreground">{user?.email}</strong>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPhase('chat')}
              className="px-5 py-2.5 rounded-full border-2 border-border text-foreground font-semibold hover:border-[var(--color-brand-accent)] transition-colors"
            >
              Back to chat
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="bg-[image:var(--gradient-accent)] text-white font-semibold px-6 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send to Carla
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Phase: SUBMITTING
  if (phase === 'submitting') {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <Loader2
          className="h-8 w-8 animate-spin mx-auto mb-3"
          style={{ color: 'var(--color-brand-primary)' }}
        />
        <p className="text-sm text-muted-foreground">Sending your conversation to Carla...</p>
      </div>
    );
  }

  // Phase: CHAT (authenticated)
  return (
    <div className="bg-card border border-border rounded-lg flex flex-col">
      {/* Authenticated-as banner (with returning-visitor recognition) */}
      {priorEnquiry ? (
        <div
          className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-xs"
          style={{ backgroundColor: 'var(--color-brand-accent)0d' }}
        >
          <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--color-brand-primary)' }} />
          <span className="text-muted-foreground">
            Welcome back, <strong className="text-foreground">{priorEnquiry.name.split(' ')[0]}</strong>
            {priorEnquiry.count > 1 ? ` — ${priorEnquiry.count} prior enquiries` : ' — last visit was ' + formatRelativeTime(priorEnquiry.created_at)}
          </span>
        </div>
      ) : (
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" style={{ color: 'var(--color-brand-primary)' }} />
          <span>Verified: <strong className="text-foreground">{user?.email}</strong></span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[400px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 prose prose-sm max-w-none ${
                msg.role === 'user'
                  ? 'bg-[var(--color-brand-primary)] text-white [&_*]:text-white'
                  : 'bg-muted text-foreground'
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || '...'}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Just a moment — giving that some proper thought.</span>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input + handoff */}
      <div className="border-t border-border p-4 space-y-3">
        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your response..."
            disabled={isStreaming}
            className="flex-1 border-2 border-border rounded-md px-4 py-2.5 focus:border-[var(--color-brand-accent)] outline-none text-sm disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="bg-muted text-foreground font-semibold px-4 py-2.5 rounded-md hover:bg-[var(--color-brand-accent)]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border-2 border-border text-sm"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>

        {canHandoff && (
          <button
            type="button"
            onClick={handoff}
            disabled={isStreaming}
            className="w-full bg-[image:var(--gradient-accent)] text-white font-semibold px-4 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Ready for Carla to follow up? →
          </button>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'earlier today';
  if (days < 2) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'last month';
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)} ${months < 24 ? 'year' : 'years'} ago`;
}

function generateFallbackSummary(
  messages: ChatMessage[],
  name: string,
  organisation: string
): string {
  const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const orgLine = organisation ? `${name} (${organisation})` : name;
  const msgSample = userMessages.slice(0, 3).map((m) => `  — "${m.slice(0, 120)}${m.length > 120 ? '...' : ''}"`).join('\n');
  return `Enquiry from ${orgLine}.\n\nVisitor shared:\n${msgSample}\n\n(${userMessages.length} message${userMessages.length === 1 ? '' : 's'} in total. Full conversation stored in enquiries.conversation.)`;
}
