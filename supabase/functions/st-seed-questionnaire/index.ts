// =============================================================================
// Carlorbiz Strategic Tool — seed questionnaire answers into knowledge_chunks
// supabase/functions/st-seed-questionnaire/index.ts
//
// CC-94, increment 3. Body { engagement_id }. Reads the getting-started
// questionnaire answers from st_engagement_setup.questionnaire_answers
// ({ answers: { <question_id>: { question, answer } }, answered_at }) and
// writes one knowledge_chunks row per non-empty answer:
//   chunk_text = "Q: <question>\nA: <answer>"  (verbatim — the evidence)
//   chunk_summary = first ~200 chars of the answer (deterministic, no LLM)
//
// IDEMPOTENT: existing questionnaire chunks for this engagement + setup row
// are deleted before inserting, so re-running the wizard step never
// duplicates. Returns { seeded: n }.
//
// Deploy WITHOUT gateway JWT verification (project convention — tokens are
// validated in-function): supabase functions deploy st-seed-questionnaire --no-verify-jwt
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Verify the caller's JWT against the auth server (signature + expiry) —
// deliberately stronger than the repo's older decode-only pattern.
// deno-lint-ignore no-explicit-any
async function verifyUid(req: Request, supabase: any): Promise<string> {
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw new Error("Missing bearer token");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid or expired token");
  return data.user.id as string;
}

// First ~200 chars of the answer as a deterministic summary.
function summarise(answer: string): string {
  return answer.length > 200 ? `${answer.slice(0, 197)}...` : answer;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Authn + admin authz (same contract as st-setup-engagement).
  let callerUid: string;
  try {
    callerUid = await verifyUid(req, supabase);
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
  const engagementId = String(body.engagement_id ?? "").trim();
  if (!engagementId) {
    return jsonResponse({ error: "engagement_id is required" }, 400);
  }

  // 3. Read the saved answers off the setup row.
  const { data: setup, error: setupErr } = await supabase
    .from("st_engagement_setup")
    .select("id, questionnaire_answers")
    .eq("engagement_id", engagementId)
    .maybeSingle();
  if (setupErr || !setup) {
    return jsonResponse({ error: "No setup record found for this engagement" }, 404);
  }

  const payload = (setup.questionnaire_answers ?? {}) as Record<string, unknown>;
  // Canonical shape is { answers: {...} }; tolerate a bare map for safety.
  const rawAnswers =
    payload.answers && typeof payload.answers === "object"
      ? (payload.answers as Record<string, unknown>)
      : payload;

  const entries: { qid: string; question: string; answer: string }[] = [];
  for (const [qid, value] of Object.entries(rawAnswers)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const question = String(v.question ?? "").trim();
    const answer = String(v.answer ?? "").trim();
    if (question && answer) entries.push({ qid, question, answer });
  }

  // 4. Idempotency: clear previous questionnaire chunks for this setup row
  //    before (re-)seeding. Scoped by app + engagement + type + source.
  const { error: delErr } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("source_app", "strategic-tool")
    .eq("engagement_id", engagementId)
    .eq("source_type", "questionnaire")
    .eq("source_id", setup.id);
  if (delErr) {
    return jsonResponse({ error: "Failed to clear previous questionnaire chunks", detail: delErr.message }, 500);
  }

  if (entries.length === 0) {
    return jsonResponse({ seeded: 0 });
  }

  // 5. One chunk per answered question — same column shape as
  //    st-ingest-document / st-ingest-survey.
  const rows = entries.map(({ qid, question, answer }) => ({
    source_app: "strategic-tool",
    engagement_id: engagementId,
    source_type: "questionnaire",
    source_id: setup.id,
    document_source: "Getting started questionnaire",
    section_reference: qid,
    chunk_text: `Q: ${question}\nA: ${answer}`,
    chunk_summary: summarise(answer),
    topic_tags: [] as string[],
    content_type: "questionnaire",
    is_active: true,
    extraction_version: "st-questionnaire-1.0",
  }));

  const { error: insErr } = await supabase.from("knowledge_chunks").insert(rows);
  if (insErr) {
    return jsonResponse({ error: "Failed to seed questionnaire chunks", detail: insErr.message }, 500);
  }

  return jsonResponse({ seeded: rows.length });
});
