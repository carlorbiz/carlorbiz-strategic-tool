// Super-admin engagement teardown (CC-94). Delete or reset a stuck / test
// engagement from the UI instead of hand-writing SQL. Pairs with the
// st-delete-engagement edge function, which enforces internal_admin in-function.

import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export type DeleteEngagementMode = 'delete' | 'reset';

export interface DeleteEngagementResult {
  ok: true;
  mode: DeleteEngagementMode;
  engagement_id: string;
  deleted_counts: Record<string, number>;
  storage_note?: string | null;
}

// Thrown when the live-campaign safety guard trips (HTTP 409). Carries the
// counts so the UI can offer a "delete anyway" (force) path.
export class LiveCampaignGuardError extends Error {
  respondents: number;
  liveTokens: number;
  constructor(message: string, respondents: number, liveTokens: number) {
    super(message);
    this.name = 'LiveCampaignGuardError';
    this.respondents = respondents;
    this.liveTokens = liveTokens;
  }
}

export async function deleteEngagement(params: {
  engagement_id: string;
  mode?: DeleteEngagementMode;
  force?: boolean;
}): Promise<DeleteEngagementResult> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not signed in');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/st-delete-engagement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      engagement_id: params.engagement_id,
      mode: params.mode ?? 'delete',
      force: params.force ?? false,
    }),
  });

  const body = await resp.json().catch(() => ({}));

  if (resp.status === 409 && body?.error === 'live_campaign_guard') {
    throw new LiveCampaignGuardError(
      body.message || 'This is a live campaign.',
      body.respondents ?? 0,
      body.live_tokens ?? 0,
    );
  }
  if (!resp.ok) {
    throw new Error(body?.error === 'teardown_failed'
      ? `Teardown failed: ${body.detail ?? 'unknown error'}`
      : body?.error || body?.message || `Request failed (${resp.status})`);
  }
  return body as DeleteEngagementResult;
}
