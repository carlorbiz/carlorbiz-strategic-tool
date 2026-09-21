import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── st-purge-engagement ──────────────────────────────────────
// The enforcement half of the sovereignty claim: every derived or uploaded
// artefact the platform holds for an engagement can be deleted on demand, in
// one call, with an auditable receipt.
//
// Row deletion across every table that has an engagement_id column is done
// by the st_purge_engagement() Postgres function (migration 20260921000025),
// which discovers those tables from information_schema rather than a
// hand-list — a table added by a future migration is covered automatically.
// This function's own job is: authenticate/authorise the caller, require the
// typed engagement-name confirmation, remove the storage objects (which the
// database function cannot reach), and fold the storage counts into the same
// receipt.
//
// Admin-only: internal_admin. A client's own client_admin cannot call this —
// the product rule is Carla purges (or transfers) at end of engagement, not
// a client accidentally wiping their own working evidence mid-engagement.

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
    let callerEmail: string | null = null;
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user?.id) return jsonResponse({ error: "Invalid bearer token" }, 401);
      callerId = data.user.id;
      callerEmail = data.user.email ?? null;
    }

    const body = await req.json();
    const engagement_id = body.engagement_id as string | undefined;
    const confirmation_text = body.confirmation_text as string | undefined;
    if (!engagement_id) return jsonResponse({ error: "engagement_id is required" }, 400);
    if (!confirmation_text || !confirmation_text.trim()) {
      return jsonResponse(
        { error: "confirmation_text is required — type the engagement's exact name to confirm" },
        400,
      );
    }

    // Admin-only. callerId is the auth uid, which lives in
    // user_profiles.user_id (id is a separate PK — see scripts/bootstrap-admin.sql).
    // The service role (used by internal tooling / this function's own tests)
    // skips this check by design, same as every other st-* function.
    let purgedByProfileId: string | null = null;
    if (callerId) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, role")
        .eq("user_id", callerId)
        .maybeSingle();
      if (profile?.role !== "internal_admin") {
        return jsonResponse({ error: "Only an internal admin can purge an engagement" }, 403);
      }
      purgedByProfileId = profile.id;
    }

    // 1. Delete every row keyed to this engagement, across every table
    //    discovered from information_schema, inside one transaction. Throws
    //    (and this whole call fails with no partial purge) if
    //    confirmation_text doesn't match the engagement's current name.
    const { data: receipt, error: purgeErr } = await supabase.rpc("st_purge_engagement", {
      p_engagement_id: engagement_id,
      p_confirmation_text: confirmation_text,
      p_purged_by: purgedByProfileId,
      p_purged_by_email: callerEmail,
    });

    if (purgeErr) {
      const msg = purgeErr.message || "Purge failed";
      const status = msg.includes("confirmation text does not match") ? 400 : 500;
      return jsonResponse({ error: msg }, status);
    }

    // 2. Remove stored files under the engagement prefix in every bucket
    //    (legacy uploads — the sovereign ingestion path stores no files).
    const storageCounts: Record<string, number> = {};
    let totalObjects = 0;
    for (const bucket of BUCKETS) {
      const { data: objects } = await supabase.storage
        .from(bucket)
        .list(engagement_id, { limit: 1000 });
      const names = (objects ?? []).map((o) => `${engagement_id}/${o.name}`);
      if (names.length > 0) {
        const { error: rmErr } = await supabase.storage.from(bucket).remove(names);
        if (rmErr) {
          // The row-level purge already committed; a storage failure here
          // must not be silently dropped from the receipt, so surface it
          // clearly with what row-level purge already succeeded.
          return jsonResponse(
            {
              error: `Row-level purge complete, but failed to remove files from ${bucket}: ${rmErr.message}`,
              receipt,
            },
            500,
          );
        }
      }
      storageCounts[bucket] = names.length;
      totalObjects += names.length;
    }

    // 3. Fold the storage counts into the same receipt row.
    await supabase.rpc("st_record_purge_storage", {
      p_receipt_id: receipt.id,
      p_storage_counts: storageCounts,
      p_total_objects: totalObjects,
    });

    console.log(
      `[st-purge-engagement] ${engagement_id}: ${receipt.total_rows_deleted} rows across ${
        Object.keys(receipt.table_counts ?? {}).length
      } tables, ${totalObjects} storage objects`,
    );

    return jsonResponse({
      engagement_id,
      receipt_id: receipt.id,
      table_counts: receipt.table_counts,
      total_rows_deleted: receipt.total_rows_deleted,
      storage_counts: storageCounts,
      total_objects_deleted: totalObjects,
      purged_at: receipt.purged_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("st-purge-engagement error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
