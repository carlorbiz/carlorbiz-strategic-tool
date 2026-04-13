import { supabase } from '@/lib/supabase';
import type {
  Commitment,
  CommitmentKind,
  ScopeExtensionCategory,
  ChangeType,
  TaxonomyStrictness,
} from '@/types/engagement';

// ── Commitments CRUD ────────────────────────────────────────────────────────

export async function createCommitment(
  engagementId: string,
  data: {
    kind: CommitmentKind;
    title: string;
    description?: string;
    success_signal?: string;
    parent_id?: string;
    order_index?: number;
  }
): Promise<Commitment> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: row, error } = await supabase
    .from('st_commitments')
    .insert({
      engagement_id: engagementId,
      kind: data.kind,
      title: data.title,
      description: data.description ?? null,
      success_signal: data.success_signal ?? null,
      parent_id: data.parent_id ?? null,
      order_index: data.order_index ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return row as Commitment;
}

export async function updateCommitment(
  id: string,
  data: Partial<Pick<Commitment, 'title' | 'description' | 'success_signal' | 'order_index' | 'parent_id'>>
): Promise<Commitment> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: row, error } = await supabase
    .from('st_commitments')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return row as Commitment;
}

export async function archiveCommitment(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_commitments')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function reorderCommitments(
  updates: { id: string; order_index: number }[]
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  // Supabase doesn't support bulk update, so we fire them in parallel
  const results = await Promise.all(
    updates.map(u =>
      supabase.from('st_commitments').update({ order_index: u.order_index }).eq('id', u.id)
    )
  );
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
}

// ── Count enforcement ───────────────────────────────────────────────────────

export async function countActiveTopCommitments(engagementId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('st_commitments')
    .select('*', { count: 'exact', head: true })
    .eq('engagement_id', engagementId)
    .eq('kind', 'top')
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

// ── Change log ──────────────────────────────────────────────────────────────

export interface ChangeLogEntry {
  id: string;
  engagement_id: string;
  commitment_id: string | null;
  change_type: ChangeType;
  reason_narrative: string | null;
  success_signal: string | null;
  ratification_status: string;
  author_id: string | null;
  created_at: string;
  // Joined
  commitment?: { title: string } | null;
}

export async function fetchChangeLog(engagementId: string): Promise<ChangeLogEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_commitment_change_log')
    .select('*, commitment:st_commitments(title)')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ChangeLogEntry[];
}

export async function logChange(
  engagementId: string,
  commitmentId: string | null,
  changeType: ChangeType,
  narrative?: string,
  successSignal?: string
): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('st_commitment_change_log')
    .insert({
      engagement_id: engagementId,
      commitment_id: commitmentId,
      change_type: changeType,
      reason_narrative: narrative ?? null,
      success_signal: successSignal ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ── Scope extensions ────────────────────────────────────────────────────────

export interface ScopeExtension {
  id: string;
  commitment_id: string;
  category: ScopeExtensionCategory;
  narrative: string;
  created_at: string;
}

export async function createScopeExtension(
  commitmentId: string,
  category: ScopeExtensionCategory,
  narrative: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  // Get the commitment's engagement_id for the change log
  const { data: commitment } = await supabase
    .from('st_commitments')
    .select('engagement_id')
    .eq('id', commitmentId)
    .single();

  if (!commitment) throw new Error('Commitment not found');

  // Log the change
  const logId = await logChange(
    commitment.engagement_id,
    commitmentId,
    'scope_extended',
    `[${category}] ${narrative}`
  );

  // Create the scope extension
  const { error } = await supabase
    .from('st_scope_extensions')
    .insert({
      commitment_id: commitmentId,
      category,
      narrative,
      change_log_id: logId,
    });
  if (error) throw error;
}

export async function fetchScopeExtensions(commitmentId: string): Promise<ScopeExtension[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_scope_extensions')
    .select('*')
    .eq('commitment_id', commitmentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScopeExtension[];
}

// ── Engagement settings updates ─────────────────────────────────────────────

export async function updateEngagementSettings(
  engagementId: string,
  data: {
    name?: string;
    client_name?: string;
    description?: string;
    taxonomy_strictness?: TaxonomyStrictness;
    top_count_warning?: number;
    top_count_hard_cap?: number;
    pulse_cadence_days?: number;
  }
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_engagements')
    .update(data)
    .eq('id', engagementId);
  if (error) throw error;
}

// ── Vocabulary map update ───────────────────────────────────────────────────

export async function updateVocabularyMap(
  aiConfigId: string,
  vocabularyMap: Record<string, string>
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_ai_config')
    .update({ vocabulary_map: vocabularyMap })
    .eq('id', aiConfigId);
  if (error) throw error;
}

// ── Stage CRUD ──────────────────────────────────────────────────────────────

export async function createStage(
  engagementId: string,
  data: {
    title: string;
    stage_type: string;
    description?: string;
    order_index?: number;
  }
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_engagement_stages')
    .insert({
      engagement_id: engagementId,
      title: data.title,
      stage_type: data.stage_type,
      description: data.description ?? null,
      order_index: data.order_index ?? 0,
    });
  if (error) throw error;
}

export async function updateStage(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    stage_type: string;
    status: string;
    order_index: number;
    nera_system_prompt: string;
    is_recurring: boolean;
    recurrence_pattern: string;
  }>
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_engagement_stages')
    .update(data)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteStage(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_engagement_stages')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
