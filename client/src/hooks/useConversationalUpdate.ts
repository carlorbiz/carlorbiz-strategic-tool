import { useState, useCallback } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import {
  startConversation,
  selectPrompt,
  sendMessage,
  summariseSession,
} from '@/lib/interviewEngineApi';
import { supabase } from '@/lib/supabase';
import type { IeMessage, ExtractionField, ExtractedField } from '@/types/interview-engine';
import type { UpdateRagStatus } from '@/types/engagement';

// ── Strategic-tool extraction schema for conversational updates ──────────────

const UPDATE_EXTRACTION_SCHEMA: ExtractionField[] = [
  {
    field_name: 'commitment_identified',
    description: 'Which commitment (Priority or Initiative) this update relates to — match against the provided list',
    type: 'text',
  },
  {
    field_name: 'rag_status',
    description: 'Current status of the initiative',
    type: 'enum',
    valid_values: ['on_track', 'at_risk', 'blocked', 'done'],
  },
  {
    field_name: 'narrative',
    description: 'What happened, what changed, what is next — written as a concise update',
    type: 'text',
  },
  {
    field_name: 'scope_extension_detected',
    description: 'Whether the update describes something that extends the scope of the commitment beyond its original definition',
    type: 'boolean',
  },
  {
    field_name: 'blockers',
    description: 'Any blockers, risks, or delays mentioned',
    type: 'text',
  },
  {
    field_name: 'evidence_cited',
    description: 'Any documents, meetings, decisions, or data sources referenced',
    type: 'text',
  },
];

export interface UpdateConfirmation {
  commitment_id: string;
  commitment_title: string;
  rag_status: UpdateRagStatus;
  narrative: string;
  scope_extension_detected: boolean;
  blockers: string | null;
  evidence_cited: string | null;
}

interface ConversationalUpdateState {
  conversationId: string | null;
  messages: IeMessage[];
  isLoading: boolean;
  pendingConfirmation: UpdateConfirmation | null;
  isComplete: boolean;
  error: string | null;
}

export function useConversationalUpdate() {
  const { engagement, commitments } = useEngagement();
  const [state, setState] = useState<ConversationalUpdateState>({
    conversationId: null,
    messages: [],
    isLoading: false,
    pendingConfirmation: null,
    isComplete: false,
    error: null,
  });

  // Build commitment context for the extraction prompt
  const commitmentContext = commitments
    .filter(c => c.status === 'active')
    .map(c => {
      const parent = c.parent_id
        ? commitments.find(p => p.id === c.parent_id)
        : null;
      return `- "${c.title}" (${c.kind}${parent ? `, under "${parent.title}"` : ''}) [id: ${c.id}]`;
    })
    .join('\n');

  const startUpdate = useCallback(async () => {
    if (!engagement || !supabase) return;

    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Start conversation
      const conversation = await startConversation('update', engagement.id, {
        engagement_name: engagement.name,
        client_name: engagement.client_name,
      });

      // Get opening prompt
      const prompt = await selectPrompt(
        conversation.id,
        user.id,
        engagement.id
      );

      // Add the assistant's opening prompt as a message
      const openingMessage: IeMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: prompt.prompt_text,
        extracted_data: null,
        confidence_scores: null,
        justifications: null,
        prompt_id: prompt.prompt_id,
        created_at: new Date().toISOString(),
      };

      setState(s => ({
        ...s,
        conversationId: conversation.id,
        messages: [openingMessage],
        isLoading: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start';
      setState(s => ({ ...s, isLoading: false, error: msg }));
    }
  }, [engagement, commitmentContext]);

  const sendReply = useCallback(async (text: string) => {
    if (!state.conversationId) return;

    // Add user message to local state immediately
    const userMsg: IeMessage = {
      id: crypto.randomUUID(),
      conversation_id: state.conversationId,
      role: 'user',
      content: text,
      extracted_data: null,
      confidence_scores: null,
      justifications: null,
      prompt_id: null,
      created_at: new Date().toISOString(),
    };

    setState(s => ({
      ...s,
      messages: [...s.messages, userMsg],
      isLoading: true,
      error: null,
    }));

    try {
      // Call extract with the update schema + commitment context
      const result = await sendMessage(
        state.conversationId,
        text,
        UPDATE_EXTRACTION_SCHEMA,
        `Active commitments for this engagement:\n${commitmentContext}`
      );

      // Add assistant response
      const assistantMsg: IeMessage = {
        id: crypto.randomUUID(),
        conversation_id: state.conversationId,
        role: 'assistant',
        content: result.response_text,
        extracted_data: Object.fromEntries(
          result.extracted_fields.map(f => [f.field_name, f.value])
        ),
        confidence_scores: Object.fromEntries(
          result.extracted_fields.map(f => [f.field_name, f.confidence])
        ),
        justifications: Object.fromEntries(
          result.extracted_fields.map(f => [f.field_name, f.justification_quote])
        ),
        prompt_id: null,
        created_at: new Date().toISOString(),
      };

      // Check if we have enough for a confirmation
      const confirmation = buildConfirmation(result.extracted_fields);

      setState(s => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        isLoading: false,
        pendingConfirmation: confirmation,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      setState(s => ({ ...s, isLoading: false, error: msg }));
    }
  }, [state.conversationId, commitmentContext]);

  const buildConfirmation = (fields: ExtractedField[]): UpdateConfirmation | null => {
    const commitmentField = fields.find(f => f.field_name === 'commitment_identified');
    const statusField = fields.find(f => f.field_name === 'rag_status');
    const narrativeField = fields.find(f => f.field_name === 'narrative');

    // Need at least commitment + status + narrative with decent confidence
    if (
      !commitmentField || commitmentField.confidence < 0.4 ||
      !statusField || statusField.confidence < 0.4 ||
      !narrativeField || narrativeField.confidence < 0.3
    ) {
      return null; // Not enough data yet — continue the conversation
    }

    // Match commitment title to an actual commitment
    const matchedCommitment = commitments.find(c =>
      c.title.toLowerCase().includes(String(commitmentField.value).toLowerCase()) ||
      String(commitmentField.value).toLowerCase().includes(c.title.toLowerCase())
    );

    const scopeField = fields.find(f => f.field_name === 'scope_extension_detected');
    const blockersField = fields.find(f => f.field_name === 'blockers');
    const evidenceField = fields.find(f => f.field_name === 'evidence_cited');

    return {
      commitment_id: matchedCommitment?.id ?? '',
      commitment_title: matchedCommitment?.title ?? String(commitmentField.value),
      rag_status: (statusField.value as UpdateRagStatus) ?? 'on_track',
      narrative: String(narrativeField.value),
      scope_extension_detected: scopeField?.value === true,
      blockers: blockersField?.value ? String(blockersField.value) : null,
      evidence_cited: evidenceField?.value ? String(evidenceField.value) : null,
    };
  };

  const confirmUpdate = useCallback(async () => {
    if (!state.pendingConfirmation || !state.conversationId || !engagement || !supabase) return;

    setState(s => ({ ...s, isLoading: true }));
    try {
      const conf = state.pendingConfirmation;

      // Write to st_initiative_updates
      await supabase.from('st_initiative_updates').insert({
        commitment_id: conf.commitment_id || null,
        engagement_id: engagement.id,
        rag_status: conf.rag_status,
        narrative: conf.narrative,
        sources: [
          ...(conf.evidence_cited ? [{ type: 'cited', value: conf.evidence_cited }] : []),
          { type: 'conversation', value: state.conversationId },
        ],
      });

      // Summarise the session
      await summariseSession(state.conversationId);

      setState(s => ({
        ...s,
        isLoading: false,
        isComplete: true,
        pendingConfirmation: null,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Confirm failed';
      setState(s => ({ ...s, isLoading: false, error: msg }));
    }
  }, [state.pendingConfirmation, state.conversationId, engagement]);

  const dismissConfirmation = useCallback(() => {
    setState(s => ({ ...s, pendingConfirmation: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      conversationId: null,
      messages: [],
      isLoading: false,
      pendingConfirmation: null,
      isComplete: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    startUpdate,
    sendReply,
    confirmUpdate,
    dismissConfirmation,
    reset,
  };
}
