import { useState, useCallback, useEffect, useRef } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import {
  getOrStartConversation,
  findResumableConversation,
  fetchConversation,
  fetchConversationCoverage,
  selectPrompt,
  sendMessage,
} from '@/lib/interviewEngineApi';
import { supabase } from '@/lib/supabase';
import type { IeConversation, IeMessage, ExtractedField } from '@/types/interview-engine';
import {
  AVENTINE_PRODUCT_ID,
  AVENTINE_GOAL,
  AVENTINE_CONTEXT,
  AVENTINE_WELCOME,
  AVENTINE_EXTRACTION_SCHEMA,
  AVENTINE_REQUIRED_DIMENSIONS,
} from '@/lib/aventineElicitation';

// ─── Aventine strategic-elicitation conversation hook (CC-75) ────────────────
// Forked from useConversationalUpdate. Differences: drives product_id
// 'aventine-strategic' (so the 14 seeded prompts are the pool), carries the
// Nera-Aventine voice via `context`, and runs as an open multi-turn elicitation
// that completes when all 20 coverage dimensions are met — not a single
// commitment-update capture. No commitment/confirmation logic.

// A dimension counts as "covered" once an answer gives it at least moderate
// confidence. Kept below select-prompt's own gap logic so the two agree.
const COVERAGE_CONFIDENCE = 0.5;
// Wrap up once nearly everything is covered — the last dimension or two often
// arrive implicitly, and chasing a literal 20/20 makes Nera feel like a form.
const COMPLETION_THRESHOLD = Math.max(1, AVENTINE_REQUIRED_DIMENSIONS.length - 2);

interface AventineState {
  conversationId: string | null;
  messages: IeMessage[];
  covered: string[];
  isLoading: boolean;
  isComplete: boolean;
  // True while the mount-time resume probe is in flight — lets the surface hold
  // the "Begin" screen back so a returning respondent doesn't flash it before
  // their in-progress conversation rehydrates.
  isResuming: boolean;
  error: string | null;
}

// Nera's purpose-setting welcome is shown as the first turn but never persisted
// to ie_messages (the edge function only writes real user/assistant turns). On
// resume we synthesise it locally so the rehydrated transcript reads coherently
// from the top — the first persisted row is the respondent's reply to it.
function makeWelcomeMessage(conversationId: string): IeMessage {
  return {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    role: 'assistant',
    content: AVENTINE_WELCOME,
    extracted_data: null,
    confidence_scores: null,
    justifications: null,
    prompt_id: null,
    created_at: new Date().toISOString(),
  };
}

// Build the covered-dimensions set from persisted coverage rows, using the SAME
// rule the live turn uses (confidence >= threshold AND a required dimension) so
// resumed state and freshly-extracted state are identical in shape.
function coveredFromConfidence(
  entries: { field_name: string; confidence: number }[]
): Set<string> {
  const covered = new Set<string>();
  for (const e of entries) {
    if (e.confidence >= COVERAGE_CONFIDENCE && AVENTINE_REQUIRED_DIMENSIONS.includes(e.field_name)) {
      covered.add(e.field_name);
    }
  }
  return covered;
}

async function resolveProfileId(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (error || !profile) {
    throw new Error('Your access is still being set up — please use the link from your email again in a moment.');
  }
  return profile.id as string;
}

export function useAventineElicitation() {
  const { engagement } = useEngagement();
  const [state, setState] = useState<AventineState>({
    conversationId: null,
    messages: [],
    covered: [],
    isLoading: false,
    isComplete: false,
    isResuming: true,
    error: null,
  });

  // Rehydrate the hook from an existing in-progress conversation: prior turns
  // into `messages`, persisted coverage into `covered`. New turns proceed as
  // normal from here — nothing is re-extracted or re-counted.
  const rehydrateFrom = useCallback(async (conversation: IeConversation) => {
    const [{ messages: priorMessages }, coverageRows] = await Promise.all([
      fetchConversation(conversation.id),
      fetchConversationCoverage(conversation.id),
    ]);

    const covered = coveredFromConfidence(
      coverageRows.map(r => ({ field_name: r.field_name, confidence: r.last_confidence ?? 0 })),
    );

    setState(s => ({
      ...s,
      conversationId: conversation.id,
      // Synthesised welcome first, then the persisted transcript in order.
      messages: [makeWelcomeMessage(conversation.id), ...priorMessages],
      covered: Array.from(covered),
      isComplete: covered.size >= COMPLETION_THRESHOLD,
      isLoading: false,
      isResuming: false,
      error: null,
    }));
  }, []);

  // On mount (once the engagement + auth are settled), probe for an existing
  // in-progress conversation and resume it. If there is none — a first-time
  // respondent — do nothing: the surface shows the "Begin" screen exactly as
  // before, and creation happens on their click via `start`. Any probe error
  // (e.g. profile not yet provisioned) is non-fatal; we fall back to Begin.
  const resumeAttempted = useRef(false);
  useEffect(() => {
    if (!engagement || !supabase) return;
    if (resumeAttempted.current) return;
    resumeAttempted.current = true;

    let cancelled = false;
    (async () => {
      try {
        const existing = await findResumableConversation(engagement.id, AVENTINE_PRODUCT_ID);
        if (cancelled) return;
        if (existing) {
          await rehydrateFrom(existing);
          return;
        }
      } catch {
        // Non-fatal — first-timers (or a not-yet-provisioned profile) just see Begin.
      }
      if (!cancelled) setState(s => ({ ...s, isResuming: false }));
    })();

    return () => { cancelled = true; };
  }, [engagement, rehydrateFrom]);

  const start = useCallback(async () => {
    if (!engagement || !supabase) return;
    if (state.conversationId) return; // already started
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      // Validate access (provisions the profile; gives a friendly error if the
      // magic link hasn't fully set them up yet) before we open the conversation.
      await resolveProfileId();

      // Resume-or-create: if a fresh reload already produced (or somehow left) an
      // in-progress conversation, pick it up instead of inserting a duplicate.
      const { conversation, resumed } = await getOrStartConversation(
        AVENTINE_GOAL,
        engagement.id,
        { client_name: engagement.client_name, campaign: AVENTINE_PRODUCT_ID },
        AVENTINE_PRODUCT_ID,
      );

      if (resumed) {
        await rehydrateFrom(conversation);
        return;
      }

      // Fresh start — open with a purpose-setting welcome in Nera's voice (Carla's
      // steer). The first real question arrives on the respondent's first reply —
      // selectPrompt runs inside sendReply as the steer Nera weaves in.
      const welcomeMessage = makeWelcomeMessage(conversation.id);

      setState(s => ({
        ...s,
        conversationId: conversation.id,
        messages: [welcomeMessage],
        isLoading: false,
        isResuming: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start the conversation';
      setState(s => ({ ...s, isLoading: false, error: msg }));
    }
  }, [engagement, state.conversationId, rehydrateFrom]);

  const sendReply = useCallback(async (text: string) => {
    if (!state.conversationId || !engagement) return;
    const conversationId = state.conversationId;

    const userMsg: IeMessage = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role: 'user',
      content: text,
      extracted_data: null,
      confidence_scores: null,
      justifications: null,
      prompt_id: null,
      created_at: new Date().toISOString(),
    };
    setState(s => ({ ...s, messages: [...s.messages, userMsg], isLoading: true, error: null }));

    try {
      const profileId = await resolveProfileId();

      // Pick the next seeded prompt for the largest remaining coverage gap and
      // hand it to Nera as a steer — she weaves it in, never reads it verbatim.
      let steer = '';
      try {
        const next = await selectPrompt(conversationId, profileId, engagement.id, AVENTINE_PRODUCT_ID);
        if (next?.prompt_text) {
          steer = `\n\nNEXT AREA TO STEER TOWARD (weave in naturally in your own words — do NOT read it verbatim): ${next.prompt_text}`;
        }
      } catch {
        // Non-fatal — Nera can steer from the coverage context alone.
      }

      const result = await sendMessage(
        conversationId,
        text,
        AVENTINE_EXTRACTION_SCHEMA,
        AVENTINE_CONTEXT + steer,
      );

      const assistantMsg: IeMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: 'assistant',
        content: result.response_text,
        extracted_data: Object.fromEntries(result.extracted_fields.map(f => [f.field_name, f.value])),
        confidence_scores: Object.fromEntries(result.extracted_fields.map(f => [f.field_name, f.confidence])),
        justifications: Object.fromEntries(result.extracted_fields.map(f => [f.field_name, f.justification_quote])),
        prompt_id: null,
        created_at: new Date().toISOString(),
      };

      setState(s => {
        const covered = new Set(s.covered);
        for (const f of result.extracted_fields as ExtractedField[]) {
          if (f.confidence >= COVERAGE_CONFIDENCE && AVENTINE_REQUIRED_DIMENSIONS.includes(f.field_name)) {
            covered.add(f.field_name);
          }
        }
        return {
          ...s,
          messages: [...s.messages, assistantMsg],
          covered: Array.from(covered),
          isComplete: covered.size >= COMPLETION_THRESHOLD,
          isLoading: false,
        };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Message failed to send';
      setState(s => ({ ...s, isLoading: false, error: msg }));
    }
  }, [state.conversationId, engagement]);

  const reset = useCallback(() => {
    resumeAttempted.current = false;
    setState({
      conversationId: null,
      messages: [],
      covered: [],
      isLoading: false,
      isComplete: false,
      isResuming: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    coveredCount: state.covered.length,
    totalDimensions: AVENTINE_REQUIRED_DIMENSIONS.length,
    start,
    sendReply,
    reset,
  };
}
