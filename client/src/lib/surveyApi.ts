import { supabase } from '@/lib/supabase';
import type { StSurvey } from '@/types/engagement';

// ── Upload a survey to st-surveys bucket + create st_surveys row ─────────────

export async function uploadSurvey(
  engagementId: string,
  file: File,
  metadata: {
    name: string;
    period?: string;
    containsPii?: boolean;
  }
): Promise<StSurvey> {
  if (!supabase) throw new Error('Supabase not configured');

  // 1. Upload file to storage bucket
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const timestamp = Date.now();
  const storagePath = `${engagementId}/${timestamp}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('st-surveys')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  // 2. Detect file type
  const fileType = categoriseSurveyFileType(ext);

  // 3. Insert st_surveys row
  const { data: survey, error: insertError } = await supabase
    .from('st_surveys')
    .insert({
      engagement_id: engagementId,
      name: metadata.name,
      period: metadata.period ?? null,
      file_path: storagePath,
      file_type: fileType,
      status: 'uploaded',
      contains_pii: metadata.containsPii ?? false,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  return survey as StSurvey;
}

// ── Trigger ingestion (calls st-ingest-survey edge function) ─────────────────

export async function triggerSurveyIngestion(surveyId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const neraApiBase = import.meta.env.VITE_SUPABASE_URL;
  if (!neraApiBase) throw new Error('VITE_SUPABASE_URL not set');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const resp = await fetch(`${neraApiBase}/functions/v1/st-ingest-survey`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ survey_id: surveyId }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Survey ingestion failed (${resp.status}): ${body}`);
  }
}

// ── Fetch surveys for an engagement ──────────────────────────────────────────

export async function fetchSurveys(
  engagementId: string,
  options?: { limit?: number; status?: string }
): Promise<StSurvey[]> {
  if (!supabase) return [];
  let query = supabase
    .from('st_surveys')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StSurvey[];
}

// ── Helper ───────────────────────────────────────────────────────────────────

function categoriseSurveyFileType(ext: string): string {
  switch (ext) {
    case 'xlsx':
    case 'xls': return 'xlsx';
    case 'csv': return 'csv';
    case 'json': return 'json';
    default: return ext;
  }
}
