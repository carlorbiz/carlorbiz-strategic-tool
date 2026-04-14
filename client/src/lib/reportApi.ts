import { supabase } from '@/lib/supabase';
import type {
  ReportingTemplate,
  ComplianceReport,
  EngagementDeliverable,
} from '@/types/engagement';

// ── Reporting templates ────────────────────────────────────────────────────

export async function fetchTemplates(engagementId: string): Promise<ReportingTemplate[]> {
  if (!supabase) return [];
  // Fetch templates for this engagement + global templates (engagement_id IS NULL)
  const { data, error } = await supabase
    .from('st_reporting_templates')
    .select('*')
    .or(`engagement_id.eq.${engagementId},engagement_id.is.null`)
    .order('name');
  if (error) throw error;
  return (data ?? []) as ReportingTemplate[];
}

export async function createTemplate(
  template: Omit<ReportingTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<ReportingTemplate> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('st_reporting_templates')
    .insert(template)
    .select('*')
    .single();
  if (error) throw error;
  return data as ReportingTemplate;
}

export async function updateTemplate(
  id: string,
  updates: Partial<Pick<ReportingTemplate, 'name' | 'description' | 'template_markdown' | 'funder_type'>>
): Promise<ReportingTemplate> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('st_reporting_templates')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ReportingTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_reporting_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Compliance reports ─────────────────────────────────────────────────────

export async function fetchReports(
  engagementId: string,
  limit = 20
): Promise<ComplianceReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_compliance_reports')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ComplianceReport[];
}

export async function fetchReport(id: string): Promise<ComplianceReport | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('st_compliance_reports')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ComplianceReport;
}

export async function updateReport(
  id: string,
  updates: Partial<Pick<ComplianceReport, 'title' | 'content_markdown' | 'status' | 'delivery_metadata'>>
): Promise<ComplianceReport> {
  if (!supabase) throw new Error('Supabase not configured');
  const payload: Record<string, unknown> = { ...updates };
  if (updates.status === 'delivered') {
    payload.delivered_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('st_compliance_reports')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ComplianceReport;
}

export async function deleteReport(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('st_compliance_reports')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Report generation (calls edge function) ────────────────────────────────

export async function generateReport(params: {
  engagement_id: string;
  template_id: string;
  title?: string;
  period_start?: string;
  period_end?: string;
}): Promise<{
  report_id: string;
  title: string;
  citation_count: number;
  section_count: number;
}> {
  if (!supabase) throw new Error('Supabase not configured');

  const neraApiBase = import.meta.env.VITE_SUPABASE_URL;
  if (!neraApiBase) throw new Error('VITE_SUPABASE_URL not set');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const resp = await fetch(`${neraApiBase}/functions/v1/st-generate-report`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Report generation failed (${resp.status}): ${body}`);
  }

  return resp.json();
}

// ── Engagement deliverables ────────────────────────────────────────────────

export async function fetchDeliverables(
  engagementId: string
): Promise<EngagementDeliverable[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('st_engagement_deliverables')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EngagementDeliverable[];
}

export async function createDeliverable(
  deliverable: Omit<EngagementDeliverable, 'id' | 'created_at' | 'updated_at'>
): Promise<EngagementDeliverable> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('st_engagement_deliverables')
    .insert(deliverable)
    .select('*')
    .single();
  if (error) throw error;
  return data as EngagementDeliverable;
}

export async function updateDeliverable(
  id: string,
  updates: Partial<Pick<EngagementDeliverable, 'title' | 'content_markdown' | 'content_structured' | 'render_mode' | 'is_published'>>
): Promise<EngagementDeliverable> {
  if (!supabase) throw new Error('Supabase not configured');
  const payload: Record<string, unknown> = { ...updates };
  if (updates.is_published) {
    payload.published_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('st_engagement_deliverables')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as EngagementDeliverable;
}

// ── Stage synthesis (calls edge function) ──────────────────────────────────

export async function synthesiseStage(stageId: string): Promise<{
  insight_id: string;
  themes_count: number;
  narrative: string;
}> {
  if (!supabase) throw new Error('Supabase not configured');

  const neraApiBase = import.meta.env.VITE_SUPABASE_URL;
  if (!neraApiBase) throw new Error('VITE_SUPABASE_URL not set');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const resp = await fetch(`${neraApiBase}/functions/v1/st-synthesise-stage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stage_id: stageId }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Stage synthesis failed (${resp.status}): ${body}`);
  }

  return resp.json();
}
