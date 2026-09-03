// CC-231 — Strategy Engine × Intelligence Engine bolt-on.
//
// Live, read-only client for the Nera Intelligence Engine catalogue
// (knowledge-lake-source main.py: /api/catalogue/*). The Strategy Engine stores
// ONLY tool_slugs per engagement (st_engagements.tools_in_play); everything the
// engine knows about those tools is fetched here at request time and never
// persisted into an st_* table. The engine never learns which engagement asked
// (requests carry tool names only).
//
// Auth: catalogue reads are public unless the engine sets ENGINE_READ_KEY, in
// which case cross-origin reads need X-Engine-Key. We deliberately do NOT ship
// that key in the browser bundle (a VITE_* var is public, not a secret). When
// the engine is key-gated, set VITE_CATALOGUE_VIA_PROXY=true and the GET reads
// below go through the st-catalogue edge function (which holds the key
// server-side and verifies the caller's Supabase JWT — anonymous demo sessions
// included). Default off: nothing changes until the flag is set.
// See docs/cc231-engine-read-key.md.

import { supabase } from '@/lib/supabase';

const DEFAULT_ENGINE_URL = 'https://nera-api-284843592671.australia-southeast2.run.app';
export const ENGINE_URL: string =
  (import.meta.env.VITE_NERA_ENGINE_URL as string | undefined)?.replace(/\/+$/, '') || DEFAULT_ENGINE_URL;

export const CATALOGUE_VIA_PROXY: boolean = import.meta.env.VITE_CATALOGUE_VIA_PROXY === 'true';
const CATALOGUE_PREFIX = '/api/catalogue/';

export interface CatalogueVendor {
  tool_name: string;
  tool_slug: string;
  vendor: string | null;
  category: string | null;
  pages_tracked: number;
  pages_live: number;
  pages_thin: number;
  pages_error: number;
  last_harvest: string | null;
  chunk_count: number;
}

export interface CatalogueVendorPage {
  page_url: string;
  doc_type: string | null;
  status: string;
  http_status: number | null;
  title: string | null;
  char_count: number | null;
  fetched_at: string | null;
  gcs_path: string | null;
  error_message: string | null;
}

export interface CatalogueVendorChunk {
  chunk_id: string;
  summary: string | null;
  content_type: string | null;
  topic_tags: string[];
  doc_title: string | null;
  source_url: string | null;
}

export interface CatalogueVendorDetail {
  tool_slug: string;
  pages: CatalogueVendorPage[];
  chunks: CatalogueVendorChunk[];
  chunk_count: number;
}

export interface CatalogueContextChunk {
  tool_slug: string;
  chunk_id: string;
  text: string;
  summary: string | null;
  content_type: string | null;
  doc_title: string | null;
  source_url: string | null;
  captured_at: string | null;
}

export interface CatalogueContext {
  tools: string[];
  covered: string[];
  uncovered: string[];
  chunks: CatalogueContextChunk[];
  count: number;
}

/** Proxy hop: `${VITE_SUPABASE_URL}/functions/v1/st-catalogue/<subpath>` with the session JWT. */
async function proxyRequest(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' || !path.startsWith(CATALOGUE_PREFIX)) {
    throw new Error(`Intelligence Engine proxy only serves GET /api/catalogue/* (got ${method} ${path})`);
  }
  if (!supabase) throw new Error('Supabase not configured');
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
  if (!base) throw new Error('VITE_SUPABASE_URL not set');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const subpath = path.slice(CATALOGUE_PREFIX.length); // keeps the query string
  return fetch(`${base}/functions/v1/st-catalogue/${subpath}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
}

async function engineFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = CATALOGUE_VIA_PROXY
    ? await proxyRequest(path, init)
    : await fetch(`${ENGINE_URL}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.detail ?? ''; } catch { /* ignore */ }
    throw new Error(`Intelligence Engine ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json() as Promise<T>;
}

/** All tools the engine holds a catalogue for (one row per tool). */
export async function fetchCatalogueVendors(): Promise<CatalogueVendor[]> {
  const data = await engineFetch<{ vendors: CatalogueVendor[]; count: number }>('/api/catalogue/vendors');
  return data.vendors ?? [];
}

/** One tool: page-level harvest state + recent chunk summaries. */
export async function fetchCatalogueVendorDetail(toolSlug: string, chunkLimit = 30): Promise<CatalogueVendorDetail> {
  return engineFetch<CatalogueVendorDetail>(
    `/api/catalogue/vendors/${encodeURIComponent(toolSlug)}?chunk_limit=${chunkLimit}`,
  );
}

/**
 * Grounding read: chunk TEXT + source links for a set of tools (report generation).
 * Server-side read in practice (st-generate-report calls the engine directly with
 * the secret); NOT available through the browser proxy — throws when
 * VITE_CATALOGUE_VIA_PROXY is on.
 */
export async function fetchCatalogueContext(tools: string[], limitPerTool = 12, maxChars = 1400): Promise<CatalogueContext> {
  return engineFetch<CatalogueContext>('/api/catalogue/context', {
    method: 'POST',
    body: JSON.stringify({ tools, limit_per_tool: limitPerTool, max_chars: maxChars }),
  });
}

/** Human freshness label for a harvest timestamp. */
export function freshnessLabel(iso: string | null | undefined): string {
  if (!iso) return 'never harvested';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'harvested today';
  if (days === 1) return 'harvested yesterday';
  if (days < 30) return `harvested ${days} days ago`;
  const months = Math.floor(days / 30);
  return `harvested ${months} month${months === 1 ? '' : 's'} ago`;
}
