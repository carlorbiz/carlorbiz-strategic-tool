// Resolves the in-app assistant's display name for model-facing prompts.
// Order: (a) optional `assistant_name` from the request body, sanitised;
// (b) the ASSISTANT_NAME environment variable; (c) "CJ for Teams".
// CC-447 / DEC-129: each deployment names its own assistant.

const FALLBACK_NAME = "CJ for Teams";

function sanitise(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[^A-Za-z0-9 '\-]/g, "").trim().slice(0, 40).trim();
}

export function resolveAssistantName(raw?: unknown): string {
  return (
    sanitise(raw) ||
    sanitise(Deno.env.get("ASSISTANT_NAME")) ||
    FALLBACK_NAME
  );
}
