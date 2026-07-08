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
//   5. Generates a magic link that drops them onto the elicitation surface.
//
// Returns { user_id, email, magic_link } for the admin to send on.
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

  // 6. Magic link onto the elicitation surface.
  const redirectTo = redirectBase ? `${redirectBase}${landingPath}` : undefined;
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (linkErr) {
    return jsonResponse(
      { user_id: uid, email, magic_link: null, warning: `Attached but magic-link generation failed: ${linkErr.message}` },
      200,
    );
  }
  // deno-lint-ignore no-explicit-any
  const magicLink = (linkData as any)?.properties?.action_link ?? null;

  return jsonResponse({ user_id: uid, email, magic_link: magicLink });
});
