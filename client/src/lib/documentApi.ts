import { supabase } from '@/lib/supabase';
import type { StDocument } from '@/types/engagement';

// ── Upload a document to st-documents bucket + create st_documents row ──────

export async function uploadDocument(
  engagementId: string,
  file: File,
  metadata: {
    title: string;
    description?: string;
    primaryCommitmentId?: string;
    containsPii?: boolean;
  }
): Promise<StDocument> {
  if (!supabase) throw new Error('Supabase not configured');

  // 1. Upload file to storage bucket
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const timestamp = Date.now();
  const storagePath = `${engagementId}/${timestamp}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('st-documents')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  // 2. Detect file type category
  const fileType = categoriseFileType(ext);

  // 3. Insert st_documents row
  const { data: doc, error: insertError } = await supabase
    .from('st_documents')
    .insert({
      engagement_id: engagementId,
      title: metadata.title,
      description: metadata.description ?? null,
      file_path: storagePath,
      file_type: fileType,
      file_size_bytes: file.size,
      primary_commitment_id: metadata.primaryCommitmentId ?? null,
      contains_pii: metadata.containsPii ?? false,
      status: 'uploaded',
    })
    .select()
    .single();
  if (insertError) throw insertError;

  return doc as StDocument;
}

// ── Trigger ingestion (calls the st-ingest-document edge function) ──────────

export async function triggerIngestion(documentId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const neraApiBase = import.meta.env.VITE_SUPABASE_URL;
  if (!neraApiBase) throw new Error('VITE_SUPABASE_URL not set');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const resp = await fetch(`${neraApiBase}/functions/v1/st-ingest-document`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ document_id: documentId }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Ingestion failed (${resp.status}): ${body}`);
  }
}

// ── Fetch documents for an engagement ───────────────────────────────────────

export async function fetchDocuments(
  engagementId: string,
  options?: { limit?: number; status?: string }
): Promise<StDocument[]> {
  if (!supabase) return [];
  let query = supabase
    .from('st_documents')
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
  return (data ?? []) as StDocument[];
}

// ── Link a document to commitments ──────────────────────────────────────────

export async function linkDocumentToCommitments(
  documentId: string,
  commitmentIds: string[],
  linkType: 'primary' | 'tagged' | 'cited' = 'tagged'
): Promise<void> {
  if (!supabase || commitmentIds.length === 0) return;

  const rows = commitmentIds.map(cid => ({
    document_id: documentId,
    commitment_id: cid,
    link_type: linkType,
  }));

  const { error } = await supabase
    .from('st_commitment_document_links')
    .upsert(rows, { onConflict: 'commitment_id,document_id' });
  if (error) throw error;
}

// ── Helper: categorise file extension ───────────────────────────────────────

function categoriseFileType(ext: string): string {
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'doc':
    case 'docx': return 'docx';
    case 'md':
    case 'markdown': return 'md';
    case 'txt': return 'txt';
    case 'xlsx':
    case 'xls': return 'xlsx';
    case 'csv': return 'csv';
    case 'json': return 'json';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif': return 'image';
    default: return ext;
  }
}
