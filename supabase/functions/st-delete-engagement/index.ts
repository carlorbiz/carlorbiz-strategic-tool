// =============================================================================
// Carlorbiz Strategic Tool — Delete / Reset an engagement (super-admin only)
// supabase/functions/st-delete-engagement/index.ts
//
// CC-94. Self-service teardown for stuck / test engagements so Carla can clear
// them from the UI instead of hand-writing SQL. Two modes:
//   • 'delete' — cascade-delete every child row (FK-safe order) then the
//     st_engagements row itself. Best-effort purge of uploaded files from the
//     st-documents storage bucket first.
//   • 'reset'  — keep the engagement row + its roles/respondent grants, wipe the
//     *content* (chunks, documents, pillars, stage insights, setup) and drop the
//     status back to 'draft' so the setup wizard can be re-walked from scratch.
//
// Safety guard: a 'living' engagement with active respondents or live access
// tokens cannot be deleted unless the caller passes force:true. This stops the
// real Aventine campaign (21d4614b-…) being nuked by accident.
//
// Auth mirrors st-provision-campaign-user: the caller's bearer JWT is decoded
// in-function (atob the payload → sub), then user_profiles.role must be
// 'internal_admin'. Deploy WITHOUT gateway JWT verification:
//   supabase functions deploy st-delete-engagement --no-verify-jwt
//
// Self-contained on purpose — no import from ../_shared (MCP/edge deploys can't
// bundle it). Any helper is inlined below.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DOCUMENTS_BUCKET = "st-documents";

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Child tables keyed by engagement_id, in FK-safe delete order (validated
// working 2026-07-16). The ordering already respects the two intra-child FKs:
// st_user_engagement_roles before st_engagement_roles, knowledge_chunks before
// st_documents.
const CASCADE_TABLES = [
  "knowledge_chunks",
  "st_user_engagement_roles",
  "ie_conversations",
  "nera_queries",
  "st_stage_insights",
  "st_engagement_stages",
  "st_stakeholder_inputs",
  "st_surveys",
  "st_commitment_change_log",
  "st_commitments",
  "st_compliance_reports",
  "st_drift_reports",
  "st_initiative_updates",
  "st_engagement_deliverables",
  "st_engagement_profiles",
  "st_reporting_templates",
  "st_workshop_decisions",
  "st_workshop_photos",
  "st_organisational_pillars",
  "st_documents",
  "st_engagement_setup",
  "st_ai_config",
  "st_campaign_access_tokens",
  "st_engagement_roles",
] as const;

// Content tables cleared by a 'reset' (engagement row + roles/grants kept).
const RESET_TABLES = [
  "knowledge_chunks",
  "st_documents",
  "st_organisational_pillars",
  "st_stage_insights",
  "st_engagement_setup",
] as const;

// deno-lint-ignore no-explicit-any
async function deleteByEngagement(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  table: string,
  engagementId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("engagement_id", engagementId);
  if (error) throw new Error(`Delete from ${table} failed: ${error.message}`);
  return count ?? 0;
}

// Best-effort purge of the engagement's uploaded files from the st-documents
// bucket. Must run BEFORE st_documents rows are deleted (that's where the paths
// live). Never throws — storage cleanup is best-effort so a bucket hiccup can't
// block the row teardown.
// deno-lint-ignore no-explicit-any
async function purgeStorage(supabase: any, engagementId: string): Promise<{ removed: number; note?: string }> {
  try {
    const { data: docs, error } = await supabase
      .from("st_documents")
      .select("file_path")
      .eq("engagement_id", engagementId);
    if (error) return { removed: 0, note: `could not list documents: ${error.message}` };
    const paths = (docs ?? [])
      // deno-lint-ignore no-explicit-any
      .map((d: any) => d.file_path)
      .filter((p: unknown): p is string => typeof p === "string" && p.length > 0);
    if (paths.length === 0) return { removed: 0 };
    const { error: rmErr } = await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
    if (rmErr) return { removed: 0, note: `storage remove failed: ${rmErr.message}` };
    return { removed: paths.length };
  } catch (e) {
    return { removed: 0, note: e instanceof Error ? e.message : "storage cleanup error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Authn + admin authz (mirrors st-provision-campaign-user).
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
  const engagementId = String(body.engagement_id ?? "").trim();
  const mode = body.mode === "reset" ? "reset" : "delete";
  const force = body.force === true;

  if (!UUID_RE.test(engagementId)) {
    return jsonResponse({ error: "A valid engagement_id (uuid) is required" }, 400);
  }

  // 3. Confirm the engagement exists.
  const { data: engagement, error: engErr } = await supabase
    .from("st_engagements")
    .select("id, name, status")
    .eq("id", engagementId)
    .maybeSingle();
  if (engErr) {
    return jsonResponse({ error: "Failed to load engagement", detail: engErr.message }, 500);
  }
  if (!engagement) {
    return jsonResponse({ error: "Engagement not found" }, 404);
  }

  // 4. Safety guard — don't let a live campaign get nuked by accident.
  const nowIso = new Date().toISOString();
  const { count: respondentCount } = await supabase
    .from("st_user_engagement_roles")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .is("revoked_at", null);
  const { count: liveTokenCount } = await supabase
    .from("st_campaign_access_tokens")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .gt("expires_at", nowIso);

  const respondents = respondentCount ?? 0;
  const liveTokens = liveTokenCount ?? 0;

  if (engagement.status === "living" && (respondents > 0 || liveTokens > 0) && !force) {
    return jsonResponse(
      {
        error: "live_campaign_guard",
        message:
          `This is a live campaign with ${respondents} respondent${respondents === 1 ? "" : "s"} ` +
          `and ${liveTokens} active link${liveTokens === 1 ? "" : "s"}. ` +
          `Pass force:true to ${mode} anyway.`,
        respondents,
        live_tokens: liveTokens,
      },
      409,
    );
  }

  const deleted_counts: Record<string, number> = {};

  try {
    // 5. Best-effort storage purge (before st_documents rows disappear).
    const storage = await purgeStorage(supabase, engagementId);
    deleted_counts["_storage_files"] = storage.removed;

    if (mode === "reset") {
      // Keep the engagement row + roles + respondent grants; wipe content only.
      for (const table of RESET_TABLES) {
        deleted_counts[table] = await deleteByEngagement(supabase, table, engagementId);
      }
      const { error: statusErr } = await supabase
        .from("st_engagements")
        .update({ status: "draft" })
        .eq("id", engagementId);
      if (statusErr) throw new Error(`Failed to reset status: ${statusErr.message}`);

      return jsonResponse({
        ok: true,
        mode,
        engagement_id: engagementId,
        deleted_counts,
        storage_note: storage.note ?? null,
      });
    }

    // mode === 'delete' — cascade every child then the engagement row.
    for (const table of CASCADE_TABLES) {
      deleted_counts[table] = await deleteByEngagement(supabase, table, engagementId);
    }
    const { count: engCount, error: delEngErr } = await supabase
      .from("st_engagements")
      .delete({ count: "exact" })
      .eq("id", engagementId);
    if (delEngErr) throw new Error(`Failed to delete engagement: ${delEngErr.message}`);
    deleted_counts["st_engagements"] = engCount ?? 0;

    return jsonResponse({
      ok: true,
      mode,
      engagement_id: engagementId,
      deleted_counts,
      storage_note: storage.note ?? null,
    });
  } catch (e) {
    // Sequential deletes are not transactional — surface partial progress so a
    // failure is diagnosable and can be retried (deletes are idempotent).
    return jsonResponse(
      {
        error: "teardown_failed",
        detail: e instanceof Error ? e.message : "Unknown error",
        mode,
        engagement_id: engagementId,
        deleted_counts,
      },
      500,
    );
  }
});
