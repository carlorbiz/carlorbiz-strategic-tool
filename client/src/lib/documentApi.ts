import { supabase } from '@/lib/supabase';
import type { StDocument } from '@/types/engagement';

// ── Upload a document to st-documents bucket + create st_documents row ──────

export interface UploadDocumentMetadata {
  title: string;
  description?: string;
  primaryCommitmentId?: string;
  containsPii?: boolean;
  // Research metadata (optional — used by research-vertical engagements)
  authors?: string;
  institution?: string;
  publicationYear?: number;
  journal?: string;
  doi?: string;
  externalLink?: string;
}

export async function uploadDocument(
  engagementId: string,
  file: File,
  metadata: UploadDocumentMetadata,
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
      authors: metadata.authors ?? null,
      institution: metadata.institution ?? null,
      publication_year: metadata.publicationYear ?? null,
      journal: metadata.journal ?? null,
      doi: metadata.doi ?? null,
      external_link: metadata.externalLink ?? null,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  return doc as StDocument;
}

// ── Sovereign path: create a document record WITHOUT uploading the file ─────
// The file is parsed client-side (extractText.ts); only extracted text ever
// travels. file_path stays NULL — the platform never holds the source
// document. external_link / description carry the client-held location.

export async function createDocumentRecord(
  engagementId: string,
  file: File,
  metadata: UploadDocumentMetadata,
): Promise<StDocument> {
  if (!supabase) throw new Error('Supabase not configured');

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const { data: doc, error: insertError } = await supabase
    .from('st_documents')
    .insert({
      engagement_id: engagementId,
      title: metadata.title,
      description: metadata.description ?? null,
      file_path: null,
      file_type: categoriseFileType(ext),
      file_size_bytes: file.size,
      primary_commitment_id: metadata.primaryCommitmentId ?? null,
      contains_pii: metadata.containsPii ?? false,
      status: 'uploaded',
      authors: metadata.authors ?? null,
      institution: metadata.institution ?? null,
      publication_year: metadata.publicationYear ?? null,
      journal: metadata.journal ?? null,
      doi: metadata.doi ?? null,
      external_link: metadata.externalLink ?? null,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  return doc as StDocument;
}

// ── Sovereign path: orchestrate segment-by-segment ingestion ────────────────
// One bounded edge call per ≤10k-char segment, sequential, with per-segment
// retry. Progress is reported after every segment, so a stall is visible in
// seconds — not a spinner that never resolves.

export interface IngestProgress {
  segmentsDone: number;
  segmentsTotal: number;
  chunksInserted: number;
}

export async function ingestExtractedText(
  documentId: string,
  segments: string[],
  onProgress?: (p: IngestProgress) => void,
): Promise<IngestProgress> {
  if (!supabase) throw new Error('Supabase not configured');
  const neraApiBase = import.meta.env.VITE_SUPABASE_URL;
  if (!neraApiBase) throw new Error('VITE_SUPABASE_URL not set');

  const progress: IngestProgress = {
    segmentsDone: 0,
    segmentsTotal: segments.length,
    chunksInserted: 0,
  };

  for (let i = 0; i < segments.length; i++) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      // Refresh the token each attempt — long documents can outlive a JWT.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      try {
        const resp = await fetch(`${neraApiBase}/functions/v1/st-ingest-document`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: documentId,
            segment_text: segments[i],
            segment_index: i,
            total_segments: segments.length,
          }),
        });
        if (!resp.ok) {
          const bodyText = await resp.text();
          throw new Error(`Segment ${i + 1}/${segments.length} failed (${resp.status}): ${bodyText}`);
        }
        const result = await resp.json();
        progress.segmentsDone = i + 1;
        progress.chunksInserted += result.chunks_inserted ?? 0;
        onProgress?.({ ...progress });
        lastError = null;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        // NOTE: retrying segment 0 restarts the document server-side
        // (idempotent purge), which is exactly what we want.
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }

    if (lastError) {
      await supabase
        .from('st_documents')
        .update({ status: 'failed', summary: `Ingestion failed: ${lastError.message.slice(0, 300)}` })
        .eq('id', documentId);
      throw lastError;
    }
  }

  return progress;
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
