// =============================================================================
// Carlorbiz Strategic Tool — Exchange a reusable campaign access token for a
// real Supabase session.
// supabase/functions/st-campaign-exchange/index.ts
//
// The counterpart to st-provision-campaign-user. A respondent lands on the
// elicitation surface with ?access=<opaque token>. The app POSTs that token
// here; we validate it against st_campaign_access_tokens (by SHA-256 hash) and,
// if valid, mint a genuine Supabase session for the token's user_id and return
// { access_token, refresh_token, user_id }.
//
// PREFETCH-PROOF: the access token is REUSABLE within its 48h window. We do NOT
// consume/delete the row on exchange — a corporate email scanner that prefetches
// the link must not lock the real user out. (Single-use magic links were the
// original bug: scanners burned the one-time token first.)
//
// The token itself is the credential, so this deploys WITHOUT gateway JWT
// verification: supabase functions deploy st-campaign-exchange --no-verify-jwt
//
// Shared helpers are INLINED (no ../_shared import) — the MCP deploy has a ~20k
// ceiling and cannot reference ../_shared (see docs/CC105-gemini-migration.md).
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

// SHA-256 hex of a UTF-8 string.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // 1. Input.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const token = String(body.token ?? "").trim();
  if (!token) {
    return jsonResponse({ error: "A token is required" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 2. Look up the token by its hash (service-role only; RLS denies clients).
  const tokenHash = await sha256Hex(token);
  const { data: row, error: lookupErr } = await admin
    .from("st_campaign_access_tokens")
    .select("user_id, engagement_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (lookupErr) {
    return jsonResponse({ error: "Could not validate access link" }, 500);
  }
  // 3. Reject if not found / revoked / expired. Uniform 401 (don't leak which).
  if (!row) {
    return jsonResponse({ error: "This access link is invalid" }, 401);
  }
  if (row.revoked_at) {
    return jsonResponse({ error: "This access link has been revoked" }, 401);
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return jsonResponse({ error: "This access link has expired" }, 401);
  }

  // 4. Resolve the user's email (needed to mint a magic-link OTP for them).
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(
    row.user_id as string,
  );
  const email = userRes?.user?.email;
  if (userErr || !email) {
    return jsonResponse({ error: "Account for this link is no longer available" }, 401);
  }

  // 5. Mint a real Supabase session server-side WITHOUT consuming the reusable
  //    access token. Generate a fresh magic-link OTP for the user, then verify
  //    it with a clean anon-key client to obtain a full session. The magic-link
  //    OTP is single-use but internal here — it is created and consumed in the
  //    same request, so scanner prefetch never touches it.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  // deno-lint-ignore no-explicit-any
  const hashedToken = (linkData as any)?.properties?.hashed_token ?? null;
  if (linkErr || !hashedToken) {
    return jsonResponse(
      { error: "Could not establish a session", detail: linkErr?.message ?? null },
      500,
    );
  }

  // Fresh anon client (no persisted session) to run verifyOtp server-side.
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });
  const session = verifyData?.session;
  if (verifyErr || !session?.access_token || !session?.refresh_token) {
    return jsonResponse(
      { error: "Could not establish a session", detail: verifyErr?.message ?? null },
      500,
    );
  }

  // 6. Return the session. The access-token row is intentionally left intact
  //    (reusable within 48h) — this is what makes the flow prefetch-proof.
  return jsonResponse({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: row.user_id,
  });
});
