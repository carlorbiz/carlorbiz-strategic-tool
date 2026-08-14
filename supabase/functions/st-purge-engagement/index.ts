import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── st-purge-engagement ──────────────────────────────────────
// The enforcement half of the sovereignty claim: every derived artefact the
// platform holds for an engagement can be deleted on demand, in one call.
// Removes: knowledge_chunks rows, stored files under the engagement prefix in
// every st-* bucket (legacy uploads — the sovereign path stores no files),
// and derived fields on st_documents / st_surveys (rows are kept as an audit
// record of WHAT was purged, with all content-derived fields cleared).
//
// Caller must be an internal admin, or the engagement's client admin.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BUCKETS = ["st-documents", "st-surveys", "st-workshop-photos", "st-deliverables"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonResponse({ error: "Missing bearer token" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let callerId: string | null = null;
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user?.id) return jsonResponse({ error: "Invalid bearer token" }, 401);
      callerId = data.user.id;
    }

    const body = await req.json();
    const engagement_id = body.engagement_id as string | undefined;
    if (!engagement_id) return jsonResponse({ error: "engagement_id is required" }, 400);

    if (callerId) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", callerId)
        .maybeSingle();
      const { data: roleRow } = await supabase
        .from("st_user_engagement_roles")
        .select("role")
        .eq("user_id", callerId)
        .eq("engagement_id", engagement_id)
        .is("revoked_at", null)
        .maybeSingle();
      const isInternalAdmin = profile?.role === "internal_admin";
      const isClientAdmin = roleRow?.role === "client_admin";
      if (!isInternalAdmin && !isClientAdmin) {
        return jsonResponse({ error: "Only an admin can purge an engagement corpus" }, 403);
      }
    }

    // 1. Delete all derived knowledge for the engagement.
    const { count: chunksDeleted } = await supabase
      .from("knowledge_chunks")
      .delete({ count: "exact" })
      .eq("engagement_id", engagement_id);

    // 2. Remove any stored files under the engagement prefix (legacy uploads).
    const filesDeleted: Record<string, number> = {};
    for (const bucket of BUCKETS) {
      const { data: objects } = await supabase.storage
        .from(bucket)
        .list(engagement_id, { limit: 1000 });
      const names = (objects ?? []).map((o) => `${engagement_id}/${o.name}`);
      if (names.length > 0) {
        const { error: rmErr } = await supabase.storage.from(bucket).remove(names);
        if (rmErr) {
          return jsonResponse(
            { error: `Failed to remove files from ${bucket}: ${rmErr.message}` },
            500,
          );
        }
      }
      filesDeleted[bucket] = names.length;
    }

    // 3. Clear content-derived fields; keep rows as the audit record.
    const { count: docsPurged } = await supabase
      .from("st_documents")
      .update(
        { status: "purged", summary: null, chunk_count: 0, file_path: null },
        { count: "exact" },
      )
      .eq("engagement_id", engagement_id);

    // Survey verbatims and derived summaries are content — they go too.
    // (Responses/summaries key by survey_id, so collect the surveys first.)
    const { data: surveys } = await supabase
      .from("st_surveys")
      .select("id")
      .eq("engagement_id", engagement_id);
    const surveyIds = (surveys ?? []).map((s) => s.id);

    let responsesDeleted = 0;
    if (surveyIds.length > 0) {
      const { count: respCount } = await supabase
        .from("st_survey_responses")
        .delete({ count: "exact" })
        .in("survey_id", surveyIds);
      responsesDeleted = respCount ?? 0;
      await supabase
        .from("st_survey_question_summaries")
        .delete()
        .in("survey_id", surveyIds);
    }

    const { count: surveysPurged } = await supabase
      .from("st_surveys")
      .update({ overall_summary: null, file_path: null }, { count: "exact" })
      .eq("engagement_id", engagement_id);

    console.log(
      `[st-purge-engagement] ${engagement_id}: chunks=${chunksDeleted} docs=${docsPurged} surveys=${surveysPurged} responses=${responsesDeleted}`,
    );

    return jsonResponse({
      engagement_id,
      chunks_deleted: chunksDeleted ?? 0,
      files_deleted: filesDeleted,
      documents_purged: docsPurged ?? 0,
      surveys_purged: surveysPurged ?? 0,
      survey_responses_deleted: responsesDeleted ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("st-purge-engagement error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
