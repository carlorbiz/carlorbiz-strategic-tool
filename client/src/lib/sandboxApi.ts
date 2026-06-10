// Tier-2 prospect sandbox: extended-access requests + (admin) provisioning.
// Pairs with migration 0013 (st_sandbox_requests, st_clone_engagement_for_user)
// and the st-provision-sandbox edge function.

import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface SandboxRequestInput {
  email: string;
  full_name?: string;
  organisation?: string;
  message?: string;
  demo_engagement_id?: string;
}

export interface SandboxRequest {
  id: string;
  email: string;
  full_name: string | null;
  organisation: string | null;
  message: string | null;
  demo_engagement_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  provisioned_engagement_id: string | null;
  note: string | null;
  requested_at: string;
  handled_at: string | null;
}

// Public: a prospect (often anonymous) asks for extended access. Write-only by
// RLS — we don't .select() back because they have no read access to the table.
export async function submitSandboxRequest(input: SandboxRequestInput): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('st_sandbox_requests').insert({
    email: input.email.trim().toLowerCase(),
    full_name: input.full_name?.trim() || null,
    organisation: input.organisation?.trim() || null,
    message: input.message?.trim() || null,
    demo_engagement_id: input.demo_engagement_id || null,
  });
  if (error) throw error;
}

// Admin: list requests (RLS restricts SELECT to internal_admin).
export async function fetchSandboxRequests(): Promise<SandboxRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_sandbox_requests')
    .select('*')
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SandboxRequest[];
}

export interface ProvisionResult {
  engagement_id: string;
  magic_link: string | null;
  email: string;
  warning?: string;
}

// Admin: approve a request — creates the prospect account, clones the demo,
// returns a magic link. Calls the st-provision-sandbox edge function.
export async function provisionSandbox(params: {
  email: string;
  demo_engagement_id: string;
  full_name?: string;
  organisation?: string;
  request_id?: string;
}): Promise<ProvisionResult> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not signed in');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/st-provision-sandbox`, {
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
  return body as ProvisionResult;
}

export async function rejectSandboxRequest(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_sandbox_requests')
    .update({ status: 'rejected', handled_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
