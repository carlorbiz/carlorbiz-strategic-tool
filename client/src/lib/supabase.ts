import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseAnonKey !== '';
};

// Fetch wrapper with timeout to prevent hung requests
const fetchWithTimeout = (url: RequestInfo | URL, options: RequestInit = {}) => {
  const controller = new AbortController();
  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : String(url);
  const isEdgeFunctionCall = urlString.includes('/functions/v1/');
  const timeoutMs = isEdgeFunctionCall ? 600000 : 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
};

// Only create the client if credentials are provided
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: fetchWithTimeout },
      auth: {
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: true,
        // Bypass Web Locks — they deadlock on Cloudflare Pages during page reloads
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
          return fn();
        },
      },
    })
  : null;
