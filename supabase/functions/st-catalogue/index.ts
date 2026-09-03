// =============================================================================
// Carlorbiz Strategic Tool — Intelligence Engine catalogue proxy (CC-231)
// supabase/functions/st-catalogue/index.ts
//
// Once the Nera Intelligence Engine is key-gated (ENGINE_READ_KEY set on the
// nera-api Cloud Run service), the browser can no longer read
// /api/catalogue/* directly and must never ship the key (a VITE_* var is
// public). This function is the server-side hop:
//
//   browser ──(user JWT)──▶ st-catalogue ──(X-Engine-Key)──▶ nera-api
//
// Scope is deliberately narrow — a GET-only, allowlisted mirror of exactly the
// catalogue reads client/src/lib/toolCatalogueApi.ts performs:
//
//   GET /st-catalogue/vendors                       → /api/catalogue/vendors
//   GET /st-catalogue/vendors/<tool_slug>?chunk_limit=N
//                                                   → /api/catalogue/vendors/<tool_slug>?chunk_limit=N
//
// POST /api/catalogue/context (chunk TEXT for report grounding) is NOT proxied:
// st-generate-report reads it server-side with the same secret, so the browser
// never needs it. Anything outside the allowlist is 404 — this is not an open
// proxy. The engine receives tool names only; no engagement identity crosses.
//
// Auth: same requireAuth pattern as st-generate-report — a verified user JWT
// (anonymous demo sessions from signInAnonymously() are real users and pass)
// or the service-role key. Deploy with --no-verify-jwt per the in-repo
// convention; the token is verified in-function via auth.getUser().
//
// Secrets: NERA_ENGINE_READ_KEY is read from env, sent as X-Engine-Key, and
// never logged or echoed. NERA_ENGINE_URL is optional (defaults to prod).
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NERA_ENGINE_URL = (Deno.env.get("NERA_ENGINE_URL") ??
  "https://nera-api-284843592671.australia-southeast2.run.app").replace(/\/+$/, "");
const NERA_ENGINE_READ_KEY = Deno.env.get("NERA_ENGINE_READ_KEY") ?? "";

const UPSTREAM_TIMEOUT_MS = 30_000;
const FUNCTION_NAME = "st-catalogue";

// ─── CORS ─────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Auth ─────────────────────────────────────────────────────
async function requireAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  if (token === SUPABASE_SERVICE_ROLE_KEY) return "service-role";

  // Verify the JWT against the auth server (signature + expiry), never
  // decode-only. Anonymous demo users carry a real signed JWT and pass here.
  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid bearer token");
  return data.user.id as string;
}

// ─── Allowlist ────────────────────────────────────────────────
// Sub-path (after /st-catalogue/) → upstream path under /api/catalogue/ plus
// the query params permitted for that route. Anything else is rejected.
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

type QueryValidator = (raw: string) => string | null; // normalised value, or null = reject

interface Route {
  upstreamPath: string; // relative to /api/catalogue
  allowedQuery: Record<string, QueryValidator>;
}

function intInRange(min: number, max: number): QueryValidator {
  return (raw) => {
    if (!/^\d{1,4}$/.test(raw)) return null;
    const n = Number(raw);
    return n >= min && n <= max ? String(n) : null;
  };
}

function resolveRoute(subpath: string): Route | null {
  const parts = subpath.split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "vendors") {
    return { upstreamPath: "/vendors", allowedQuery: {} };
  }
  if (parts.length === 2 && parts[0] === "vendors") {
    let slug: string;
    try {
      slug = decodeURIComponent(parts[1]);
    } catch {
      return null;
    }
    if (!SLUG_RE.test(slug)) return null;
    return {
      upstreamPath: `/vendors/${encodeURIComponent(slug)}`,
      allowedQuery: { chunk_limit: intInRange(1, 200) },
    };
  }
  return null;
}

/** Strip the function prefix regardless of how the gateway presented the path. */
function extractSubpath(pathname: string): string {
  const marker = `/${FUNCTION_NAME}`;
  const idx = pathname.indexOf(marker);
  if (idx === -1) return "";
  return pathname.slice(idx + marker.length).replace(/^\/+/, "");
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    await requireAuth(req);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 401);
  }

  const url = new URL(req.url);
  const route = resolveRoute(extractSubpath(url.pathname));
  if (!route) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  // Only forward allowlisted, validated query params.
  const upstream = new URL(`${NERA_ENGINE_URL}/api/catalogue${route.upstreamPath}`);
  for (const [key, validate] of Object.entries(route.allowedQuery)) {
    const raw = url.searchParams.get(key);
    if (raw === null) continue;
    const ok = validate(raw);
    if (ok === null) {
      return jsonResponse({ error: `Invalid query parameter: ${key}` }, 400);
    }
    upstream.searchParams.set(key, ok);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(NERA_ENGINE_READ_KEY ? { "X-Engine-Key": NERA_ENGINE_READ_KEY } : {}),
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    // Pass status + JSON body straight through (FastAPI errors are {detail}).
    const text = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      if (!res.ok) {
        console.warn(`[${FUNCTION_NAME}] engine ${res.status} on ${route.upstreamPath}`);
      }
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-JSON upstream body (gateway HTML, empty 5xx): normalise to {detail}.
    console.warn(`[${FUNCTION_NAME}] engine non-JSON ${res.status} on ${route.upstreamPath}`);
    return jsonResponse(
      { detail: text.slice(0, 500) || `Intelligence Engine returned ${res.status}` },
      res.ok ? 502 : res.status,
    );
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as Error)?.name === "AbortError";
    console.warn(
      `[${FUNCTION_NAME}] engine read ${aborted ? "timed out" : "failed"} on ${route.upstreamPath}`,
    );
    return jsonResponse(
      { detail: aborted ? "Intelligence Engine timed out" : "Intelligence Engine unreachable" },
      aborted ? 504 : 502,
    );
  }
});
