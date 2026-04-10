import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";

/**
 * branch-classify — Fast LLM call to classify a user response into
 * branch A, B, or C for Nera Layer 2 branching conversations.
 *
 * Called client-side after each user turn. Returns a single letter
 * classification plus a confidence score. Designed to be fast and cheap
 * (~100-200 tokens output).
 *
 * POST body:
 *   conversationId: "strategic-direction" | "people-culture" | "impact-evidence"
 *   userResponse: string    — the user's latest message
 *   turnNumber: number      — which turn this is (1-based)
 *   priorBranch?: string    — branch from prior turn (for consistency)
 */

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

// ─── Classification prompts per conversation ────────────────────

const CLASSIFICATION_PROMPTS: Record<string, string> = {
  "strategic-direction": `You are a response classifier for a strategic consulting conversation about organisational direction.

The user has been asked about a crossroads or strategic decision. Classify their response into ONE branch:

**Branch A — Mission/Impact language**
Signals: serving more people, expanding reach, mission-driven language, stopping turning people away, community impact, long-term outcomes, purpose-driven, values language
Examples: "We want to serve more patients", "Our mission is being diluted", "We're turning away people who need us"

**Branch B — Operational/Resource language**
Signals: budget, capacity, team stretched, board vs staff tension, resourcing, workload, infrastructure, systems, processes, efficiency
Examples: "We don't have the budget", "The team is already at capacity", "Board wants growth but staff are burning out"

**Branch C — Uncertainty/Anxiety language**
Signals: not sure, disagreement, going in circles, paralysis, fear of wrong decision, lack of clarity, conflicting views, indecision
Examples: "We keep having the same conversation", "Nobody agrees on what we should do", "I'm worried we'll make the wrong call"

Return ONLY valid JSON:
{"branch": "A"|"B"|"C", "confidence": 0.0-1.0, "signal": "brief phrase explaining classification"}`,

  "people-culture": `You are a response classifier for a leadership conversation about team dynamics.

The user has been asked whether their team concern is about how people work together, or how individuals are showing up. Classify their response into ONE branch:

**Branch A — Collaboration/Collective**
Signals: communication breakdown, trust issues, silos, decision-making, meetings unproductive, blame culture, psychological safety, team dynamics
Examples: "People aren't talking to each other", "Nobody trusts the process", "Decisions get made and then ignored"

**Branch B — Individual/Performance**
Signals: specific person, showing up differently, motivation, capability, role clarity, performance shift, disengagement, one team member
Examples: "One person has really checked out", "They used to be great but something shifted", "I'm not sure they're in the right role"

**Branch C — Both/Entangled/Can't separate**
Signals: it's everything, can't pinpoint, systemic, cultural, "the whole team", both individual and collective issues mentioned, vague but pervasive
Examples: "I honestly can't tell where it starts", "It's the whole culture", "Everyone's affected but I can't point to one thing"

Return ONLY valid JSON:
{"branch": "A"|"B"|"C", "confidence": 0.0-1.0, "signal": "brief phrase explaining classification"}`,

  "impact-evidence": `You are a response classifier for a conversation about demonstrating organisational impact to funders and boards.

The user has been asked what their funders are missing from current reports. Classify their response into ONE branch:

**Branch A — Qualitative/Stories**
Signals: stories, faces, connection, human impact, long-term change, beneficiary voice, what numbers can't show, the real difference, emotional impact
Examples: "They don't see the faces behind the numbers", "We change lives but the reports show outputs", "The stories never make it into the data"

**Branch B — Attribution/Complexity**
Signals: can't prove causation, 10-year outcomes, system-level change, contribution vs attribution, multiple factors, complexity of measurement, theory of change
Examples: "We can't prove it was us specifically", "The outcomes take a decade to show", "It's a systems problem — no single intervention works alone"

**Branch C — Governance/Trust**
Signals: board wants more data, reporting fatigue, reports nobody reads, trust deficit, oversight vs understanding, compliance-driven reporting, outputs not outcomes
Examples: "The board just wants more numbers", "We spend weeks on reports nobody reads", "They don't trust what we're telling them"

Return ONLY valid JSON:
{"branch": "A"|"B"|"C", "confidence": 0.0-1.0, "signal": "brief phrase explaining classification"}`,
};

// ─── Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { conversationId, userResponse, turnNumber, priorBranch } = body;

    if (!conversationId || !userResponse) {
      return jsonResponse({ error: "Missing conversationId or userResponse" }, 400);
    }

    const classifyPrompt = CLASSIFICATION_PROMPTS[conversationId];
    if (!classifyPrompt) {
      return jsonResponse({ error: `Unknown conversationId: ${conversationId}` }, 400);
    }

    // Build classification context
    let userMessage = `User response (turn ${turnNumber || 1}): "${userResponse}"`;
    if (priorBranch) {
      userMessage += `\n\nPrior classification: Branch ${priorBranch}. Prefer consistency unless the user has clearly shifted to a different register.`;
    }

    // Use Haiku for speed — this is a classification task, not generation
    const config: LLMConfig = {
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      apiKey: Deno.env.get("ANTHROPIC_API_KEY") || "",
    };

    const raw = await callLLM(config, classifyPrompt, [{ role: "user", content: userMessage }], 150);

    // Parse the JSON response
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const result = JSON.parse(cleaned);

    return jsonResponse({
      branch: result.branch || "A",
      confidence: result.confidence || 0.5,
      signal: result.signal || "",
    });
  } catch (err) {
    console.error("branch-classify error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Classification failed", branch: "A", confidence: 0.3 },
      200 // Return 200 with fallback so client can continue
    );
  }
});
