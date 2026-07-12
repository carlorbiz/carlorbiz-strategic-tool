// =============================================================================
// Carlorbiz Strategic Tool — Engagement Setup Wizard backend (admin only)
// supabase/functions/st-setup-engagement/index.ts
//
// CC-94, increment 1. Backs the /setup wizard on the Carlorbiz host.
//
// Actions:
//   "create" — body { name, client_name?, sector?, description? }.
//     Creates the full scaffolding for a new engagement in one call:
//       1. st_engagements shell (status 'draft', slug from the name with a
//          -2/-3 suffix on collision, created_by = caller).
//       2. Per-engagement st_ai_config cloned from the global row
//          (engagement_id IS NULL), or — when no global row exists (prod) —
//          from the most recently updated engagement-scoped row, so
//          provider/model/vocabulary/prompts start from the house-tuned set.
//       3. Two st_engagement_roles: 'client_admin' + 'participant'.
//       4. One 'onboarding' st_engagement_stages row titled 'Getting started'
//          seeded with DEFAULT_QUESTIONS.
//       5. An st_engagement_setup row at current_step 1.
//       6. Grants the caller the client_admin role.
//     Inserts run sequentially with cleanup on failure: deleting the
//     st_engagements row cascades every child row, so a failed step never
//     leaves a half-built engagement behind.
//     Returns { engagement_id, slug, setup_id }.
//
//   "get" — body { engagement_id }. Returns { engagement, setup } so the
//     wizard can resume at the saved step.
//
// Deploy WITHOUT gateway JWT verification (project convention — tokens are
// validated in-function): supabase functions deploy st-setup-engagement --no-verify-jwt
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// The getting-started questionnaire seeded into the onboarding stage's
// question_set. A display copy lives in client/src/lib/setupApi.ts
// (DEFAULT_QUESTIONS) — keep the two in sync by hand; the client never
// sends these, it reads them back off the stage row.
const DEFAULT_QUESTIONS: { id: string; question: string }[] = [
  { id: "purpose", question: "What does this organisation exist to do, in its own words?" },
  { id: "goals", question: "What are the 3-5 things it is trying to achieve over the next few years?" },
  { id: "working_well", question: "What's working well right now?" },
  { id: "concerns", question: "What keeps leadership up at night?" },
  { id: "changes", question: "What big changes are underway or coming (funding, structure, technology, sector)?" },
  { id: "stakeholders", question: "Who are the key people and groups whose input matters?" },
  { id: "missing_documents", question: "What information or documents exist that we haven't uploaded yet?" },
  { id: "anything_else", question: "Anything else Nera should know before we start?" },
];

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

// Lowercase, ASCII, hyphenated — matches the slug contract from 0011.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

// deno-lint-ignore no-explicit-any
async function pickFreeSlug(admin: any, base: string): Promise<string | null> {
  const root = base || "engagement";
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const { data, error } = await admin
      .from("st_engagements")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) return null; // fail closed; caller reports the error
    if (!data) return candidate;
  }
  return null;
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
    .select("id, role")
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
  const action = String(body.action ?? "create");

  // ── Action: get (resume) ───────────────────────────────────────────────────
  if (action === "get") {
    const engagementId = String(body.engagement_id ?? "").trim();
    if (!engagementId) {
      return jsonResponse({ error: "engagement_id is required" }, 400);
    }
    const { data: engagement, error: engErr } = await supabase
      .from("st_engagements")
      .select("*")
      .eq("id", engagementId)
      .maybeSingle();
    if (engErr || !engagement) {
      return jsonResponse({ error: "Engagement not found" }, 404);
    }
    const { data: setup } = await supabase
      .from("st_engagement_setup")
      .select("*")
      .eq("engagement_id", engagementId)
      .maybeSingle();
    return jsonResponse({ engagement, setup: setup ?? null });
  }

  if (action !== "create") {
    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  }

  // ── Action: create ─────────────────────────────────────────────────────────
  const name = String(body.name ?? "").trim();
  const clientName = body.client_name ? String(body.client_name).trim() : null;
  const sector = body.sector ? String(body.sector).trim() : null;
  const description = body.description ? String(body.description).trim() : null;

  if (!name) {
    return jsonResponse({ error: "An engagement name is required" }, 400);
  }

  // Slug from the name, -2/-3… suffix on collision.
  const slug = await pickFreeSlug(supabase, slugify(name));
  if (!slug) {
    return jsonResponse({ error: "Could not allocate a unique slug for this engagement" }, 500);
  }

  // Everything below cascades off the engagement row: on any failure we
  // delete it, which removes roles, stage, ai_config, setup and grants.
  let engagementId: string | null = null;
  const cleanup = async () => {
    if (engagementId) {
      await supabase.from("st_engagements").delete().eq("id", engagementId);
    }
  };

  // 3. Engagement shell (short_code auto-generates via its column DEFAULT).
  const { data: engagement, error: engErr } = await supabase
    .from("st_engagements")
    .insert({
      name,
      client_name: clientName,
      sector,
      description,
      status: "draft",
      type: "strategic_planning",
      slug,
      created_by: callerProfile.id,
    })
    .select("id, slug")
    .single();
  if (engErr || !engagement) {
    return jsonResponse({ error: "Failed to create engagement", detail: engErr?.message ?? null }, 500);
  }
  engagementId = engagement.id as string;

  // 4. Per-engagement AI config cloned from the best available source:
  //    global defaults row (engagement_id IS NULL) → else the most recently
  //    updated engagement-scoped row (prod has no global row; the newest
  //    engagement config carries the house-tuned prompts/provider/model/
  //    vocabulary) → else column defaults.
  const { data: globalConfig } = await supabase
    .from("st_ai_config")
    .select("*")
    .is("engagement_id", null)
    .limit(1)
    .maybeSingle();

  let sourceConfig = globalConfig;
  if (!sourceConfig) {
    const { data: recentConfig } = await supabase
      .from("st_ai_config")
      .select("*")
      .not("engagement_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sourceConfig = recentConfig;
  }

  const aiConfigRow = sourceConfig
    ? {
        engagement_id: engagementId,
        profile_key: sourceConfig.profile_key,
        llm_provider: sourceConfig.llm_provider,
        llm_model: sourceConfig.llm_model,
        vocabulary_map: sourceConfig.vocabulary_map,
        system_prompt_interview: sourceConfig.system_prompt_interview,
        system_prompt_workshop: sourceConfig.system_prompt_workshop,
        system_prompt_pulse: sourceConfig.system_prompt_pulse,
        system_prompt_drift_watch: sourceConfig.system_prompt_drift_watch,
        system_prompt_brief: sourceConfig.system_prompt_brief,
        system_prompt_report: sourceConfig.system_prompt_report,
        system_prompt_update: sourceConfig.system_prompt_update,
        drift_watch_config: sourceConfig.drift_watch_config,
        dashboard_layout: sourceConfig.dashboard_layout,
      }
    : { engagement_id: engagementId }; // column defaults still give a sane config

  const { error: aiErr } = await supabase.from("st_ai_config").insert(aiConfigRow);
  if (aiErr) {
    await cleanup();
    return jsonResponse({ error: "Failed to create AI config", detail: aiErr.message }, 500);
  }

  // 5. Role definitions — same column shape as 0001 / st_clone_engagement_for_user.
  const { data: roles, error: rolesErr } = await supabase
    .from("st_engagement_roles")
    .insert([
      {
        engagement_id: engagementId,
        role_key: "client_admin",
        label: "Client admin",
        permissions: { admin: true },
      },
      {
        engagement_id: engagementId,
        role_key: "participant",
        label: "Participant",
        permissions: {},
      },
    ])
    .select("id, role_key");
  if (rolesErr || !roles?.length) {
    await cleanup();
    return jsonResponse({ error: "Failed to create engagement roles", detail: rolesErr?.message ?? null }, 500);
  }
  // deno-lint-ignore no-explicit-any
  const clientAdminRole = roles.find((r: any) => r.role_key === "client_admin");

  // 6. Onboarding stage seeded with the getting-started questions.
  const { error: stageErr } = await supabase.from("st_engagement_stages").insert({
    engagement_id: engagementId,
    title: "Getting started",
    description:
      "A short set of questions that helps Nera understand the organisation before the real work begins.",
    stage_type: "onboarding",
    status: "draft",
    order_index: 0,
    question_set: DEFAULT_QUESTIONS,
  });
  if (stageErr) {
    await cleanup();
    return jsonResponse({ error: "Failed to create onboarding stage", detail: stageErr.message }, 500);
  }

  // 7. Wizard progress row.
  const { data: setup, error: setupErr } = await supabase
    .from("st_engagement_setup")
    .insert({ engagement_id: engagementId, current_step: 1 })
    .select("id")
    .single();
  if (setupErr || !setup) {
    await cleanup();
    return jsonResponse({ error: "Failed to create setup record", detail: setupErr?.message ?? null }, 500);
  }

  // 8. Grant the caller client_admin on the new engagement. user_id references
  //    user_profiles(id); the project convention is id = user_id = auth uid
  //    (see st-provision-campaign-user), but we use the profile's id so the FK
  //    holds even for a legacy profile where they differ. Internal admins get
  //    access via st_is_admin() regardless — this row marks ownership.
  if (clientAdminRole) {
    const { error: grantErr } = await supabase.from("st_user_engagement_roles").insert({
      user_id: callerProfile.id,
      engagement_id: engagementId,
      role_id: clientAdminRole.id,
    });
    if (grantErr) {
      await cleanup();
      return jsonResponse({ error: "Failed to grant access to the new engagement", detail: grantErr.message }, 500);
    }
  }

  return jsonResponse({
    engagement_id: engagementId,
    slug: engagement.slug,
    setup_id: setup.id,
  });
});
