import { useState, useEffect } from 'react';
import { Loader2, Shield, ArrowRight, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { NeraLayer2Conversation } from '@/components/viewers/NeraLayer2Conversation';

/**
 * Email verification gate for Nera Layer 2 (branching conversations).
 *
 * Flow:
 * 1. Unauthenticated → show email gate with magic link
 * 2. Magic link clicked → auto-authenticate → show conversations
 * 3. Already authenticated (from prior EnquiryIntake etc.) → skip gate
 *
 * On successful email capture:
 * - Stores email in `enquiries` table (source: nera-layer2-gate)
 * - Fires n8n webhook for Kit subscriber tagging + Carla alert
 * - Transitions to NeraLayer2Conversation component
 */

type GatePhase = 'loading' | 'form' | 'sending' | 'sent' | 'authenticated';

export function NeraLayer2Gate() {
  const { user, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [followUpConsent, setFollowUpConsent] = useState(true);
  const [phase, setPhase] = useState<GatePhase>('loading');
  const [error, setError] = useState('');

  // Auto-advance if user is already authenticated
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      setEmail(user.email || '');
      setPhase('authenticated');
    } else {
      setPhase('form');
    }
  }, [user, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;

    setPhase('sending');
    setError('');

    try {
      if (!supabase) throw new Error('Not connected');

      // Send magic link
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/nera-demo`,
        },
      });

      if (authError) throw authError;

      // Log the lead to enquiries table
      try {
        await supabase
          .from('enquiries')
          .insert({
            email: email.trim(),
            source: 'nera-layer2-gate',
            follow_up_consent: followUpConsent,
            context: { page: 'services', section: 'see-it-working' },
          });
      } catch {
        // Non-blocking — lead capture shouldn't block the auth flow
      }

      // Fire n8n webhook for lead capture (non-blocking)
      const webhookUrl = import.meta.env.VITE_LAYER2_WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            source: 'nera-layer2-gate',
            follow_up_consent: followUpConsent,
            tag: 'nera-demo-lead',
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }

      setPhase('sent');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setPhase('form');
    }
  };

  // ─── Loading ────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  // ─── Authenticated → show conversations ─────────────────────

  if (phase === 'authenticated') {
    return <NeraLayer2Conversation userEmail={email || user?.email} />;
  }

  // ─── Magic link sent ────────────────────────────────────────

  if (phase === 'sent') {
    return (
      <div className="rounded-xl border-2 border-[#2D7E32]/20 bg-[#2D7E32]/5 p-6 text-center space-y-3">
        <Mail className="h-10 w-10 mx-auto text-[#2D7E32]" />
        <p className="font-heading font-bold text-lg text-[#2D7E32]">Check your email</p>
        <p className="text-sm text-gray-600">
          We&rsquo;ve sent a verification link to <strong>{email}</strong>. Click it to access the
          full branching interview experience.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          The link will bring you right back here, ready to choose your scenario.
        </p>
      </div>
    );
  }

  // ─── Email gate form ────────────────────────────────────────

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      {/* Security framing */}
      <div className="flex items-start gap-3">
        <Shield className="h-5 w-5 flex-shrink-0 mt-0.5 text-[#2D7E32]" />
        <div className="space-y-2">
          <p className="font-heading font-bold text-base text-foreground">
            Verify to access the full experience
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The adaptive interview uses significantly more AI processing than the demo above. We
            verify you&rsquo;re a real person before opening it up &mdash; that&rsquo;s the same
            security-first approach we build into every client platform. Your content stays
            protected; access stays controlled.
          </p>
        </div>
      </div>

      {/* The three scenarios they'll access */}
      <div className="grid sm:grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="font-heading font-bold text-xs text-[#2D7E32]">Strategic Direction</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            &ldquo;We&rsquo;re at a crossroads&rdquo;
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="font-heading font-bold text-xs text-[#2D7E32]">People &amp; Culture</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            &ldquo;Something&rsquo;s not working&rdquo;
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="font-heading font-bold text-xs text-[#2D7E32]">Impact &amp; Evidence</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            &ldquo;I can&rsquo;t show what we achieve&rdquo;
          </p>
        </div>
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your work email"
            required
            disabled={phase === 'sending'}
            className="flex-1 border-2 border-border rounded-md px-4 py-2.5 text-sm focus:border-[#2D7E32] outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={phase === 'sending' || !email.trim()}
            className="bg-[#2D7E32] text-white font-semibold px-5 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            {phase === 'sending' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Verify <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Opt-in checkbox */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={followUpConsent}
            onChange={(e) => setFollowUpConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2D7E32] focus:ring-[#2D7E32]"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I&rsquo;m happy for Carla to follow up to hear what I thought of the experience. (You
            can opt out at any time.)
          </span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </div>
  );
}
