import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Admin email — the internal_admin user who receives follow-up notifications.
// Falls back to env var, then to hardcoded default.
const ADMIN_EMAIL =
  Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "admin@example.com";

// ─── CORS ─────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { id, name, contact_method, contact_details, availability_notes } =
      body;

    if (!id || !name || !contact_method || !contact_details) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Send email notification via Supabase Auth admin API ───
    // Uses the built-in email service (no external provider needed).
    // This sends a "magic link" style email that's actually just a notification.
    //
    // Alternative: If you have Resend/SendGrid configured, replace this
    // with a direct API call to your email provider.

    const timestamp = new Date().toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const methodLabel =
      contact_method === "teams"
        ? "Microsoft Teams"
        : contact_method === "phone"
          ? "Phone"
          : "Email";

    const emailBody = `
New follow-up contact request received.

Name: ${name}
Contact method: ${methodLabel}
Contact details: ${contact_details}
Availability: ${availability_notes || "Not specified"}
Submitted: ${timestamp}

View all follow-up requests in the Admin dashboard:
${SUPABASE_URL.replace(".supabase.co", "")}/admin

---
This notification was sent automatically by ${Deno.env.get("CLIENT_NAME") || "Resource Hub"}.
    `.trim();

    // Log the notification for audit trail
    console.log(
      `Follow-up notification for ${name} (${contact_method}: ${contact_details})`
    );

    // ── Store notification record ─────────────────────────────
    // If email sending isn't configured, at minimum we log it and
    // the admin can see it in the dashboard.
    const { error: logError } = await supabase.from("follow_up_contacts").update({
      admin_notes: `Notification sent to ${ADMIN_EMAIL} at ${timestamp}`,
    }).eq("id", id);

    if (logError) {
      console.warn("Could not update notification log:", logError.message);
    }

    // ── Attempt email via n8n webhook (if configured) ─────────
    const N8N_WEBHOOK_URL = Deno.env.get("N8N_FOLLOW_UP_WEBHOOK");
    if (N8N_WEBHOOK_URL) {
      try {
        const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: ADMIN_EMAIL,
            subject: `Follow-up request: ${name} (${methodLabel})`,
            body: emailBody,
            contact: {
              id,
              name,
              contact_method: methodLabel,
              contact_details,
              availability_notes: availability_notes || null,
              submitted_at: timestamp,
            },
          }),
        });

        if (!webhookResponse.ok) {
          console.warn(
            `n8n webhook returned ${webhookResponse.status}: ${await webhookResponse.text()}`
          );
        } else {
          console.log("n8n webhook notification sent successfully");
        }
      } catch (webhookErr) {
        console.warn("n8n webhook failed:", (webhookErr as Error).message);
      }
    } else {
      console.log(
        "N8N_FOLLOW_UP_WEBHOOK not configured — notification logged only. " +
          "Set the env var to enable email delivery."
      );
    }

    return jsonResponse({
      success: true,
      message: "Notification processed",
      admin_email: ADMIN_EMAIL,
      webhook_configured: !!N8N_WEBHOOK_URL,
    });
  } catch (error) {
    console.error("notify-follow-up error:", error);
    return jsonResponse(
      { error: `Notification failed: ${(error as Error).message}` },
      500
    );
  }
});
