import { supabase } from '@/lib/supabase';
import type { StSurvey } from '@/types/engagement';
import type { ParsedSheet } from '@/lib/extractSurvey';

// ── Sovereign path: create a survey record WITHOUT uploading the raw file ───
// The file is parsed client-side (extractSurvey.ts); only the parsed sheet
// structure (headers + rows — no different from what st-ingest-survey used
// to produce itself by downloading and parsing the stored file) ever
// travels. file_path stays NULL — the platform never holds the raw,
// respondent-level file. Mirrors documentApi.ts's createDocumentRecord.

export async function createSurveyRecord(
  engagementId: string,
  file: File,
  metadata: {
    name: string;
    period?: string;
    containsPii?: boolean;
  }
): Promise<StSurvey> {
  if (!supabase) throw new Error('Supabase not configured');

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  const { data: survey, error: insertError } = await supabase
    .from('st_surveys')
    .insert({
      engagement_id: engagementId,
      name: metadata.name,
      period: metadata.period ?? null,
      file_path: null,
      file_type: categoriseSurveyFileType(ext),
      status: 'uploaded',
      contains_pii: metadata.containsPii ?? false,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  return survey as StSurvey;
}

// ── Sovereign path: send the already-parsed sheet structure for ingestion ───
// One call, since a parsed survey (headers + rows for a handful of sheets)
// is nowhere near the segment-size problem long documents have — no
// per-segment retry loop needed here, just a single bounded request.

export async function ingestParsedSurvey(
  surveyId: string,
  sheets: ParsedSheet[],
): Promise<SurveyIngestionStarted> {
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
    body: JSON.stringify({ survey_id: surveyId, parsed_sheets: sheets }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Survey ingestion failed (${resp.status}): ${body}`);
  }
  return (await resp.json()) as SurveyIngestionStarted;
}

// ── Legacy path: upload a survey to st-surveys bucket + create st_surveys row ──
// Kept for any caller that still needs the raw file stored server-side
// (image/xlsx documents on the document side have an equivalent legacy
// path). The browser upload flow (SurveyUpload.tsx) no longer uses this for
// the formats extractSurvey.ts can parse (csv/json/xlsx/xls) — every survey
// format the uploader accepts is now sovereign-path.

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
//
// Since 2026-05-19, st-ingest-survey returns 202 Accepted immediately after
// parsing the file and inserting the response cells. The LLM analysis (per-
// question themes + overall summary + chunk extraction) runs in the
// background under EdgeRuntime.waitUntil. Callers should treat the resolved
// metadata as "parsing complete, analysis running" — NOT as "analysis done".
// Poll the survey row's status field until it changes from 'ingesting' to
// 'ingested' or 'failed'.

export interface SurveyIngestionStarted {
  survey_id: string;
  response_count: number;
  questions_total: number;
  status: 'analysing' | 'ingesting';
  message: string;
}

export async function triggerSurveyIngestion(
  surveyId: string,
): Promise<SurveyIngestionStarted> {
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
  return (await resp.json()) as SurveyIngestionStarted;
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
