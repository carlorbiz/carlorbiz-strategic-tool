// =============================================================================
// Carlorbiz Strategic Tool — Provision a campaign respondent (admin only)
// supabase/functions/st-provision-campaign-user/index.ts
//
// CC-75. The multi-stakeholder-campaign counterpart to st-provision-sandbox.
// Where the sandbox mints a FRESH cloned engagement per prospect, a campaign
// ATTACHES many respondents to ONE shared engagement (each keeps a private,
// de-identified Nera conversation). This function:
//   1. Verifies the caller is an internal_admin.
//   2. Finds or creates a Supabase Auth user for the respondent's email.
//   3. Ensures a user_profiles row (id = user_id = auth uid).
//   4. Attaches them to the shared engagement via st_user_engagement_roles
//      (idempotent — no duplicate active grant).
//   5. Mints a 48-hour REUSABLE opaque access token and returns a link to the
//      elicitation surface carrying it as ?access=<token>.
//
// Why a reusable token, not a magic link: single-use Supabase magic links are
// consumed by corporate email scanners that prefetch links, so the real user
// hits "One-time token not found". Our token survives prefetch because it is
// reusable within its 48h window (a scanner hit does not lock the user out).
// We store only the SHA-256 hash; the plaintext appears only in the link.
//
// Returns { user_id, email, magic_link } for the admin to send on. (The
// `magic_link` field name is kept for response-shape compatibility; it now
// carries the ?access= link.)
//
// Deploy WITHOUT gateway JWT verification (project convention — tokens are
// validated in-function): supabase functions deploy st-provision-campaign-user --no-verify-jwt
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeUid(req: Request): string {
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw new Error("Missing bearer token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid bearer token");
  const payload = JSON.parse(atob(parts[1]));
  if (!payload.sub) throw new Error("Invalid bearer token");
  return payload.sub as string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ACCESS_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// Hex-encode an ArrayBuffer.
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// SHA-256 hex of a UTF-8 string.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

// A high-entropy opaque token: 32 random bytes, hex-encoded (256 bits).
function mintAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

// deno-lint-ignore no-explicit-any
async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data?.users) return null;
  const lower = email.toLowerCase();
  // deno-lint-ignore no-explicit-any
  const match = data.users.find((u: any) => (u.email || "").toLowerCase() === lower);
  return match?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Authn + admin authz.
  let callerUid: string;
  try {
    callerUid = decodeUid(req);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unauthorised" }, 401);
  }
  const { data: callerProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", callerUid)
    .maybeSingle();
  if (callerProfile?.role !== "internal_admin") {
    return jsonResponse({ error: "Admin access required" }, 403);
  }

  // 2. Input.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const engagementId = String(body.engagement_id ?? "").trim();
  const roleId = String(body.role_id ?? "").trim();
  const fullName = body.full_name ? String(body.full_name).trim() : null;
  const landingPath = body.landing_path ? String(body.landing_path) : `/elicit/${engagementId}`;
  const redirectBase = (body.redirect_to ? String(body.redirect_to) : SITE_URL)
    .replace(/\/+$/, "");

  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "A valid email is required" }, 400);
  }
  if (!engagementId || !roleId) {
    return jsonResponse({ error: "engagement_id and role_id are required" }, 400);
  }

  // Guard: the role must belong to the target engagement.
  const { data: role } = await supabase
    .from("st_engagement_roles")
    .select("id, engagement_id")
    .eq("id", roleId)
    .maybeSingle();
  if (!role || role.engagement_id !== engagementId) {
    return jsonResponse({ error: "role_id does not belong to engagement_id" }, 400);
  }

  // 3. Find or create the respondent's auth user.
  let uid: string | null = null;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  });
  if (created?.user) {
    uid = created.user.id;
  } else {
    uid = await findUserIdByEmail(supabase, email);
    if (!uid) {
      return jsonResponse(
        { error: "Could not create or find the respondent's account", detail: createErr?.message ?? null },
        500,
      );
    }
  }

  // 4. Ensure a profile row (id = user_id = auth uid).
  const { error: profileErr } = await supabase
    .from("user_profiles")
    .upsert(
      { id: uid, user_id: uid, email, full_name: fullName, role: "external_stakeholder" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (profileErr) {
    return jsonResponse({ error: "Failed to prepare respondent profile", detail: profileErr.message }, 500);
  }

  // 5. Attach to the shared engagement (idempotent — one active grant).
  const { data: existing } = await supabase
    .from("st_user_engagement_roles")
    .select("id")
    .eq("user_id", uid)
    .eq("engagement_id", engagementId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!existing) {
    const { error: attachErr } = await supabase
      .from("st_user_engagement_roles")
      .insert({ user_id: uid, engagement_id: engagementId, role_id: roleId });
    if (attachErr) {
      return jsonResponse({ error: "Failed to attach respondent to engagement", detail: attachErr.message }, 500);
    }
  }

  // 6. Mint a 48-hour REUSABLE access token (prefetch-proof) and build the link.
  //    Store only the SHA-256 hash; the plaintext appears only in the returned link.
  const plaintextToken = mintAccessToken();
  const tokenHash = await sha256Hex(plaintextToken);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString();

  const { error: tokenErr } = await supabase
    .from("st_campaign_access_tokens")
    .insert({
      token_hash: tokenHash,
      user_id: uid,
      engagement_id: engagementId,
      expires_at: expiresAt,
    });
  if (tokenErr) {
    return jsonResponse(
      { user_id: uid, email, magic_link: null, warning: `Attached but access-token creation failed: ${tokenErr.message}` },
      200,
    );
  }

  // Build the access link onto the elicitation surface. Kept in `magic_link`
  // for response-shape compatibility with existing callers.
  const base = redirectBase || "";
  const sep = landingPath.includes("?") ? "&" : "?";
  const accessLink = `${base}${landingPath}${sep}access=${plaintextToken}`;

  return jsonResponse({ user_id: uid, email, magic_link: accessLink });
});
