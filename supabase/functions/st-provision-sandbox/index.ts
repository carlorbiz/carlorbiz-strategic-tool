// =============================================================================
// Carlorbiz Strategic Tool — Provision a Tier-2 prospect sandbox (admin only)
// supabase/functions/st-provision-sandbox/index.ts
//
// Called when an internal_admin approves an extended-access request. It:
//   1. Verifies the caller is an internal_admin.
//   2. Finds or creates a Supabase Auth user for the prospect's email.
//   3. Ensures a user_profiles row with id = user_id = auth uid (so the
//      role grant in st_clone_engagement_for_user resolves against auth.uid()).
//   4. Clones the chosen demo into a private sandbox the prospect owns
//      (st_clone_engagement_for_user — guarded to demos only).
//   5. Generates a magic link that drops them straight into their sandbox.
//   6. Marks the originating st_sandbox_requests row approved (if supplied).
//
// Returns { engagement_id, magic_link, email } for the admin to send on.
//
// Deploy WITHOUT gateway JWT verification (project convention — tokens are
// validated in-function):  supabase functions deploy st-provision-sandbox --no-verify-jwt
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Fallback redirect base if the caller doesn't pass one.
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

// Verify the caller's JWT against the auth server (signature + expiry checked),
// not just decode it. A forged/unsigned token naming a known admin UUID is
// rejected here. Returns the verified auth.users.id.
async function verifyUid(req: Request): Promise<string> {
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw new Error("Missing bearer token");
  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid or expired token");
  return data.user.id as string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// deno-lint-ignore no-explicit-any
async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  // Realistic prospect volumes fit in one large page. Bump perPage / paginate
  // if the auth user count ever grows past this.
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
    callerUid = await verifyUid(req);
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
  const demoEngagementId = String(body.demo_engagement_id ?? "").trim();
  const fullName = body.full_name ? String(body.full_name).trim() : null;
  const orgLabel = body.organisation ? String(body.organisation).trim() : null;
  const requestId = body.request_id ? String(body.request_id).trim() : null;
  const redirectBase = (body.redirect_to ? String(body.redirect_to) : SITE_URL)
    .replace(/\/+$/, "");

  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "A valid email is required" }, 400);
  }
  if (!demoEngagementId) {
    return jsonResponse({ error: "demo_engagement_id is required" }, 400);
  }

  // Guard: only demos can be cloned (the RPC enforces this too).
  const { data: isDemo } = await supabase.rpc("st_is_demo_engagement", {
    eng_id: demoEngagementId,
  });
  if (isDemo !== true) {
    return jsonResponse({ error: "demo_engagement_id is not a demo engagement" }, 400);
  }

  // 3. Find or create the prospect's auth user.
  let uid: string | null = null;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  });
  if (created?.user) {
    uid = created.user.id;
  } else {
    // Most likely already registered — look them up.
    uid = await findUserIdByEmail(supabase, email);
    if (!uid) {
      return jsonResponse(
        {
          error: "Could not create or find the prospect's account",
          detail: createErr?.message ?? null,
        },
        500,
      );
    }
  }

  // 4. Ensure a profile row with id = user_id = auth uid. This is what makes
  //    st_user_engagement_roles.user_id (= uid) line up with both the RLS
  //    helper and st-nera-query, which compare against auth.uid().
  const { error: profileErr } = await supabase
    .from("user_profiles")
    .upsert(
      { id: uid, user_id: uid, email, full_name: fullName, role: "external_stakeholder" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (profileErr) {
    return jsonResponse(
      { error: "Failed to prepare prospect profile", detail: profileErr.message },
      500,
    );
  }

  // 5. Clone the demo into their private sandbox.
  const { data: newEngagementId, error: cloneErr } = await supabase.rpc(
    "st_clone_engagement_for_user",
    { p_source: demoEngagementId, p_owner: uid, p_label: orgLabel ?? "Sandbox" },
  );
  if (cloneErr || !newEngagementId) {
    return jsonResponse(
      { error: "Failed to create sandbox", detail: cloneErr?.message ?? null },
      500,
    );
  }

  // 6. Magic link straight into the sandbox.
  const redirectTo = redirectBase ? `${redirectBase}/e/${newEngagementId}` : undefined;
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (linkErr) {
    // The sandbox exists; the admin can still trigger a link from the dashboard.
    return jsonResponse(
      {
        engagement_id: newEngagementId,
        magic_link: null,
        email,
        warning: `Sandbox created but magic-link generation failed: ${linkErr.message}`,
      },
      200,
    );
  }
  // deno-lint-ignore no-explicit-any
  const magicLink = (linkData as any)?.properties?.action_link ?? null;

  // 7. Close out the request row, if this came from one.
  if (requestId) {
    await supabase
      .from("st_sandbox_requests")
      .update({
        status: "approved",
        provisioned_engagement_id: newEngagementId,
        handled_at: new Date().toISOString(),
        handled_by: callerUid,
      })
      .eq("id", requestId);
  }

  return jsonResponse({ engagement_id: newEngagementId, magic_link: magicLink, email });
});
