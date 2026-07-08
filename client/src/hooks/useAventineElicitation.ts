import { useState, useCallback } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import {
  startConversation,
  selectPrompt,
  sendMessage,
} from '@/lib/interviewEngineApi';
import { supabase } from '@/lib/supabase';
import type { IeMessage, ExtractedField } from '@/types/interview-engine';
import {
  AVENTINE_PRODUCT_ID,
  AVENTINE_GOAL,
  AVENTINE_CONTEXT,
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
  error: string | null;
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
    error: null,
  });

  const start = useCallback(async () => {
    if (!engagement || !supabase) return;
    if (state.conversationId) return; // already started
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const profileId = await resolveProfileId();

      const conversation = await startConversation(
        AVENTINE_GOAL,
        engagement.id,
        { client_name: engagement.client_name, campaign: AVENTINE_PRODUCT_ID },
        AVENTINE_PRODUCT_ID,
      );

      const opening = await selectPrompt(
        conversation.id,
        profileId,
        engagement.id,
        AVENTINE_PRODUCT_ID,
      );

      const openingMessage: IeMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: opening.prompt_text,
        extracted_data: null,
        confidence_scores: null,
        justifications: null,
        prompt_id: opening.prompt_id,
        created_at: new Date().toISOString(),
      };

      setState(s => ({
        ...s,
        conversationId: conversation.id,
        messages: [openingMessage],
        isLoading: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start the conversation';
      setState(s => ({ ...s, isLoading: false, error: msg }));
    }
  }, [engagement, state.conversationId]);

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
    setState({
      conversationId: null,
      messages: [],
      covered: [],
      isLoading: false,
      isComplete: false,
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
