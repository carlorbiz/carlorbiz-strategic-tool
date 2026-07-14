import { useState, useRef, useEffect } from 'react';
import { useParams } from 'wouter';
import { EngagementProvider } from '@/contexts/EngagementContext';
import { useAventineElicitation } from '@/hooks/useAventineElicitation';
import { supabase } from '@/lib/supabase';
import { exchangeCampaignAccess } from '@/lib/campaignApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, MessageCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

// ─── ?access= token exchange (96h reusable credential; prefetch-proof) ───────
// Respondents land here with ?access=<token>. If there is no current session,
// POST the token to st-campaign-exchange, set the returned session, and strip
// the token from the URL. The token is REUSABLE within 96h, so a corporate
// email-scanner prefetch cannot lock the real user out. If a session already
// exists, the param is ignored.
type AccessState =
  | { status: 'idle' }        // no access param OR already has a session — proceed
  | { status: 'exchanging' }  // exchange in flight
  | { status: 'error'; message: string };

function useCampaignAccessExchange(): AccessState {
  const [state, setState] = useState<AccessState>(() => {
    const hasParam = new URLSearchParams(window.location.search).has('access');
    return hasParam ? { status: 'exchanging' } : { status: 'idle' };
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access');
    if (!token) return; // nothing to do — idle

    let cancelled = false;

    const stripTokenFromUrl = () => {
      params.delete('access');
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    };

    (async () => {
      try {
        if (!supabase) throw new Error('Supabase not configured');

        // If a session already exists, ignore the param entirely.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          stripTokenFromUrl();
          if (!cancelled) setState({ status: 'idle' });
          return;
        }

        const { access_token, refresh_token } = await exchangeCampaignAccess(token);
        await supabase.auth.setSession({ access_token, refresh_token });
        stripTokenFromUrl();
        if (!cancelled) setState({ status: 'idle' });
      } catch (err) {
        stripTokenFromUrl(); // never leave the (now-suspect) token in the URL
        const message = err instanceof Error ? err.message : 'Access failed';
        if (!cancelled) setState({ status: 'error', message });
      }
    })();

    return () => { cancelled = true; };
    // Run once on mount — the token is read from the URL at that point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

// ─── Aventine strategic-elicitation surface (CC-75) ──────────────────────────
// The link each Aventine respondent receives lands here (/elicit/:engagementId),
// authenticated via magic link. One shared engagement; each person's own private
// conversation. De-identified in analysis — say so plainly, it's the point.

function ElicitationInner() {
  const {
    conversationId,
    messages,
    isLoading,
    isComplete,
    isResuming,
    error,
    coveredCount,
    totalDimensions,
    start,
    sendReply,
  } = useAventineElicitation();

  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    await sendReply(text);
  };

  // While the mount-time resume probe runs, hold the surface on a spinner so a
  // returning respondent lands straight in their conversation rather than
  // flashing the "Begin" screen first.
  if (!conversationId && isResuming) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/20">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Opening your conversation…</span>
        </div>
      </div>
    );
  }

  // Welcome
  if (!conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/20">
        <Card className="max-w-lg w-full">
          <CardContent className="py-10 px-8 space-y-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              A conversation with Nera
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Ahead of your strategy session, I'd like to understand how you see Aventine —
              what it's for, where it's going, and how it really runs. It's a conversation,
              not a form; there are no wrong answers.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your answers go into the wash with the whole team's — <span className="font-medium text-foreground">de-identified</span>.
              Nobody sees who said what; I surface where the team is aligned, where it isn't,
              and the blind spots. That's what makes it worth being honest.
            </p>
            <Button onClick={start} disabled={isLoading} size="lg" className="rounded-full px-8 gap-2">
              {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>) : 'Begin'}
            </Button>
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded p-2 text-left">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Complete
  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/20">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12 px-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
            <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              Thank you — that's everything I needed
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your input joins the rest of the team's. Carla will bring the synthesis —
              where you're aligned, where you're not, and what it means — to the session.
              You can close this now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active conversation
  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col px-4 py-6">
        <div className="flex items-center gap-2 pb-3 text-sm text-muted-foreground">
          <MessageCircle className="w-4 h-4" />
          <span>Nera · Aventine strategy conversation</span>
          <span className="ml-auto text-xs">{coveredCount}/{totalDimensions} areas</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 p-3 border rounded-lg bg-background">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 border'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted/50 border rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2 pt-3">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type your answer…"
            disabled={isLoading}
            autoFocus
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive pt-2">{error}</p>}
      </div>
    </div>
  );
}

export default function AventineElicitationPage() {
  const params = useParams<{ engagementId: string }>();
  const engagementId = params.engagementId;
  const access = useCampaignAccessExchange();

  if (!engagementId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">This link is missing its engagement — please use the link from your email.</p>
      </div>
    );
  }

  // While exchanging the ?access= credential for a session, show a spinner —
  // the conversation must not mount until auth is settled.
  if (access.status === 'exchanging') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/20">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Opening your conversation…</span>
        </div>
      </div>
    );
  }

  if (access.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/20">
        <Card className="max-w-lg w-full">
          <CardContent className="py-10 px-8 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              This access link has expired or is invalid
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Please request a new one from Carla, then open it from your email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <EngagementProvider engagementId={engagementId}>
      <ElicitationInner />
    </EngagementProvider>
  );
}
