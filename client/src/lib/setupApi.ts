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

export interface EngagementSetup {
  id: string;
  engagement_id: string;
  current_step: number;
  pillar_proposals: unknown | null;
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

async function callSetupFunction<T>(payload: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not signed in');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/st-setup-engagement`, {
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
