import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These environment variables will be provided by the user in Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseAnonKey !== '';
};

// Fetch wrapper with timeout to prevent hung requests
// 30s is generous enough for saves but still prevents infinite hangs
const fetchWithTimeout = (url: RequestInfo | URL, options: RequestInit = {}) => {
  const controller = new AbortController();
  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : String(url);
  const isEdgeFunctionCall = urlString.includes('/functions/v1/');
  const timeoutMs = isEdgeFunctionCall ? 600000 : 30000; // 10 min for Edge Functions, 30s for REST
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
};

// Only create the client if credentials are provided
// This prevents the "supabase URL is required" error
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: fetchWithTimeout },
      auth: {
        autoRefreshToken: false, // Disabled — with lock bypass, concurrent auto-refreshes race and revoke each other's tokens
        persistSession: true,
        detectSessionInUrl: true,
        // Bypass Web Locks — they deadlock on Cloudflare Pages during page reloads
        // (orphaned locks from prior sessions block all auth operations).
        // This is safe because all Edge Functions use verify_jwt: false and validate
        // tokens server-side via supabase.auth.getUser(). The gateway no longer
        // rejects ES256 tokens, so token refresh races don't cause 401s.
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
          return fn();
        },
      },
    })
  : null;
