import { supabase } from '@/lib/supabase';
import type {
  Engagement,
  EngagementStage,
  Commitment,
  UserEngagementRole,
  StAiConfig,
  StDocument,
  InitiativeUpdate,
  DriftReport,
} from '@/types/engagement';

// ── Engagements ─────────────────────────────────────────────────────────────

export async function fetchEngagements(): Promise<Engagement[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_engagements')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Engagement[];
}

export async function fetchEngagement(idOrCode: string): Promise<Engagement | null> {
  if (!supabase) return null;

  // If it looks like a UUID, query by id; otherwise query by short_code
  const isUuid = idOrCode.length > 8 && idOrCode.includes('-');
  const column = isUuid ? 'id' : 'short_code';

  const { data, error } = await supabase
    .from('st_engagements')
    .select('*')
    .eq(column, idOrCode)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data as Engagement;
}

// ── Engagement stages ───────────────────────────────────────────────────────

export async function fetchStages(engagementId: string): Promise<EngagementStage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_engagement_stages')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as EngagementStage[];
}

// ── Commitments ─────────────────────────────────────────────────────────────

export async function fetchCommitments(engagementId: string): Promise<Commitment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_commitments')
    .select('*')
    .eq('engagement_id', engagementId)
    .eq('status', 'active')
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as Commitment[];
}

// ── User engagement roles ───────────────────────────────────────────────────

export async function fetchUserRoles(
  userId: string,
  engagementId?: string
): Promise<UserEngagementRole[]> {
  if (!supabase) return [];
  let query = supabase
    .from('st_user_engagement_roles')
    .select('*, role:st_engagement_roles(*)')
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (engagementId) {
    query = query.eq('engagement_id', engagementId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as UserEngagementRole[];
}

// ── AI config (vocabulary, prompts, drift-watch config) ─────────────────────

export async function fetchAiConfig(engagementId: string): Promise<StAiConfig | null> {
  if (!supabase) return null;

  // Try engagement-specific config first, fall back to global default
  const { data, error } = await supabase
    .from('st_ai_config')
    .select('*')
    .eq('engagement_id', engagementId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as StAiConfig;

  // Fall back to global config (engagement_id IS NULL)
  const { data: global, error: globalError } = await supabase
    .from('st_ai_config')
    .select('*')
    .is('engagement_id', null)
    .limit(1)
    .maybeSingle();

  if (globalError) throw globalError;
  return global as StAiConfig | null;
}

// ── Documents ───────────────────────────────────────────────────────────────

export async function fetchDocuments(
  engagementId: string,
  limit = 20
): Promise<StDocument[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_documents')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as StDocument[];
}

// ── Initiative updates ──────────────────────────────────────────────────────

export async function fetchRecentUpdates(
  engagementId: string,
  limit = 20
): Promise<InitiativeUpdate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_initiative_updates')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InitiativeUpdate[];
}

// ── Drift reports ───────────────────────────────────────────────────────────

export async function fetchLatestDriftReport(
  engagementId: string
): Promise<DriftReport | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('st_drift_reports')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DriftReport | null;
}

export async function triggerDriftWatch(engagementId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const neraApiBase = import.meta.env.VITE_SUPABASE_URL;
  if (!neraApiBase) throw new Error('VITE_SUPABASE_URL not set');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const resp = await fetch(`${neraApiBase}/functions/v1/st-drift-watch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ engagement_id: engagementId }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Drift watch failed (${resp.status}): ${body}`);
  }
}
