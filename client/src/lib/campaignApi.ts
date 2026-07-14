// Campaign provisioning (CC-75): attach many respondents to ONE shared
// engagement and mint a magic link for each. Pairs with the
// st-provision-campaign-user edge function. Admin-only (the function enforces
// internal_admin). The multi-respondent counterpart to sandboxApi.

import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface CampaignProvisionResult {
  user_id: string;
  email: string;
  magic_link: string | null;
  warning?: string;
}

export async function provisionCampaignRespondent(params: {
  email: string;
  engagement_id: string;
  role_id: string;
  full_name?: string;
  landing_path?: string;
}): Promise<CampaignProvisionResult> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not signed in');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/st-provision-campaign-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ ...params, redirect_to: window.location.origin }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.error || `Provisioning failed (${resp.status})`);
  }
  return body as CampaignProvisionResult;
}

export interface CampaignExchangeResult {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

// Exchange a reusable ?access=<token> credential for a real Supabase session.
// The token is the credential — no bearer auth is sent. Pairs with the
// st-campaign-exchange edge function (deployed --no-verify-jwt). Prefetch-proof:
// the token is reusable within its 96h window, so an email-scanner prefetch does
// not lock the respondent out.
export async function exchangeCampaignAccess(token: string): Promise<CampaignExchangeResult> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/st-campaign-exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ token }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.error || `Access exchange failed (${resp.status})`);
  }
  return body as CampaignExchangeResult;
}
