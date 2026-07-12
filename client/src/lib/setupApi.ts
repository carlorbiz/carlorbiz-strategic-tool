// Engagement Setup Wizard (CC-94): client API for the st-setup-engagement
// edge function plus direct RLS-gated access to st_engagement_setup.
// Admin-only (the function enforces internal_admin). Follows the same
// call pattern as campaignApi.ts.

import { supabase } from '@/lib/supabase';
import type { Engagement } from '@/types/engagement';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Display copy of the getting-started questions seeded into the onboarding
// stage by the st-setup-engagement edge function. The function's
// DEFAULT_QUESTIONS constant is the one that lands in the database — keep
// the two in sync by hand (deliberate duplication: the client bundle and
// the Deno function don't share a module graph).
export const DEFAULT_QUESTIONS: { id: string; question: string }[] = [
  { id: 'purpose', question: 'What does this organisation exist to do, in its own words?' },
  { id: 'goals', question: 'What are the 3-5 things it is trying to achieve over the next few years?' },
  { id: 'working_well', question: "What's working well right now?" },
  { id: 'concerns', question: 'What keeps leadership up at night?' },
  { id: 'changes', question: 'What big changes are underway or coming (funding, structure, technology, sector)?' },
  { id: 'stakeholders', question: 'Who are the key people and groups whose input matters?' },
  { id: 'missing_documents', question: "What information or documents exist that we haven't uploaded yet?" },
  { id: 'anything_else', question: 'Anything else Nera should know before we start?' },
];

// One proposed pillar from st-extract-pillars, matching the columns of
// st_organisational_pillars the wizard writes on lock-in.
export interface PillarProposal {
  title: string;
  description: string;
  success_signal: string;
  pillar_level: 'organisational' | 'departmental' | 'programmatic';
}

// Vocabulary labels st-extract-pillars suggests ONLY when the plan itself
// uses distinctive terms (plural forms). Absent keys mean "keep house default".
export interface VocabularySuggestions {
  priorities_label?: string;
  initiatives_label?: string;
  lenses_label?: string;
}

// Shape of st_engagement_setup.pillar_proposals. The strategic-plan document
// id lives INSIDE this jsonb (no schema change): Step 2 stashes
// source_document_id on first upload; st-extract-pillars fills the rest.
export interface PillarProposalsPayload {
  source_document_id?: string | null;
  proposals?: PillarProposal[];
  vocabulary_suggestions?: VocabularySuggestions | null;
  extracted_at?: string | null;
}

export interface EngagementSetup {
  id: string;
  engagement_id: string;
  current_step: number;
  pillar_proposals: PillarProposalsPayload | null;
  questionnaire_answers: unknown | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEngagementResult {
  engagement_id: string;
  slug: string | null;
  setup_id: string;
}

async function callFunction<T>(fn: string, payload: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not signed in');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.error || `Setup request failed (${resp.status})`);
  }
  return body as T;
}

const callSetupFunction = <T,>(payload: Record<string, unknown>): Promise<T> =>
  callFunction<T>('st-setup-engagement', payload);

export async function createEngagementSetup(params: {
  name: string;
  client_name?: string;
  sector?: string;
  description?: string;
}): Promise<CreateEngagementResult> {
  return callSetupFunction<CreateEngagementResult>({ action: 'create', ...params });
}

export async function getEngagementSetup(engagementId: string): Promise<{
  engagement: Engagement;
  setup: EngagementSetup | null;
}> {
  return callSetupFunction<{ engagement: Engagement; setup: EngagementSetup | null }>({
    action: 'get',
    engagement_id: engagementId,
  });
}

// Persist the wizard step directly — RLS lets internal admins (and anyone
// with an engagement role) update the row.
export async function updateSetupStep(engagementId: string, step: number): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_engagement_setup')
    .update({ current_step: step })
    .eq('engagement_id', engagementId);
  if (error) throw error;
}

// Patch arbitrary wizard fields (pillar_proposals, questionnaire_answers,
// completed_at) directly under the same UPDATE RLS.
export async function updateSetupFields(
  engagementId: string,
  fields: Partial<
    Pick<EngagementSetup, 'current_step' | 'pillar_proposals' | 'questionnaire_answers' | 'completed_at'>
  >,
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_engagement_setup')
    .update(fields)
    .eq('engagement_id', engagementId);
  if (error) throw error;
}

// Ask Nera to propose pillars from the strategic-plan document. The function
// writes the payload to st_engagement_setup.pillar_proposals and returns it;
// on any LLM/parse failure it returns an error and saves nothing.
export async function extractPillars(
  engagementId: string,
  documentId: string,
): Promise<PillarProposalsPayload> {
  const result = await callFunction<{ pillar_proposals: PillarProposalsPayload }>(
    'st-extract-pillars',
    { engagement_id: engagementId, document_id: documentId },
  );
  return result.pillar_proposals;
}
