import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";

/**
 * insight-extract — Structured insight card extraction from a completed
 * Nera Layer 2 branching conversation.
 *
 * Takes the full conversation history + branch metadata and produces a
 * 5-section insight card:
 *   1. Core Tension
 *   2. Organisational Signal
 *   3. Key Insight
 *   4. A Question to Sit With
 *   5. A Possible Next Step
 *
 * POST body:
 *   conversationId: "strategic-direction" | "people-culture" | "impact-evidence"
 *   conversationHistory: Array<{ role: string, content: string }>
 *   branch: "A" | "B" | "C"
 *   branchSignal: string   — the classification signal from branch-classify
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

// ─── Conversation context for richer insights ───────────────────

const CONVERSATION_CONTEXT: Record<string, string> = {
  "strategic-direction": `This conversation explored a strategic crossroads — where the organisation is at a decision point about direction, growth, or change. The user chose to explore this scenario because they're navigating competing priorities, unclear paths forward, or the tension between aspiration and operational reality.`,

  "people-culture": `This conversation explored a people and culture challenge — something isn't working in the team and the leader can sense it but may not be able to name it. The user chose this scenario because they're experiencing friction, disengagement, or dysfunction that's affecting how work gets done.`,

  "impact-evidence": `This conversation explored the challenge of demonstrating impact to funders and boards — the persistent gap between what an organisation knows it achieves and what it can prove on paper. The user chose this scenario because they're struggling with reporting, evidence, or stakeholder confidence in outcomes.`,
};

const BRANCH_CONTEXT: Record<string, Record<string, string>> = {
  "strategic-direction": {
    A: "The user's language was mission-driven and values-oriented — focused on impact, purpose, and serving more people. The crossroads is likely about direction or courage rather than capacity.",
    B: "The user's language was operational and resource-focused — budgets, team capacity, infrastructure. The crossroads is about what's practical and sustainable, not what's desirable.",
    C: "The user's language expressed uncertainty, anxiety, or paralysis — disagreement, going in circles, fear of consequences. The crossroads is obscured by indecision or misalignment.",
  },
  "people-culture": {
    A: "The user identified a collective/collaboration issue — communication, trust, decision-making, psychological safety. The concern is about how the team functions as a system.",
    B: "The user identified an individual issue — one person's shift in behaviour, performance, or engagement. The concern is specific and may require a direct conversation.",
    C: "The user couldn't separate individual from collective — the issue is pervasive, cultural, and hard to pinpoint. This often indicates a systemic pattern rather than an isolated problem.",
  },
  "impact-evidence": {
    A: "The user focused on qualitative, human stories — the impact they can see but can't quantify. The gap is between lived experience and reportable data.",
    B: "The user focused on attribution and complexity — systems-level change that can't be traced to a single intervention. The gap is between how change actually works and how funders want it measured.",
    C: "The user focused on governance and trust — reporting fatigue, boards wanting more data, reports nobody reads. The gap is between accountability requirements and actual decision-making.",
  },
};

// ─── CTA mapping — connects insight to Carlorbiz service ────────

const CTA_MAP: Record<string, Record<string, { service: string; url: string; framing: string }>> = {
  "strategic-direction": {
    A: {
      service: "Strategic Planning Facilitation",
      url: "/services#strategic-consulting",
      framing: "When the direction is clear but the path isn't, an external facilitator can hold the space for your team to make the decision together — honestly, without the politics.",
    },
    B: {
      service: "Transformation Staging",
      url: "/services#strategic-consulting",
      framing: "Resource constraints are real, but they're often symptoms of deeper prioritisation gaps. A structured staging process can reveal what to do first — and what to stop doing entirely.",
    },
    C: {
      service: "Leadership Alignment Workshop",
      url: "/services#strategic-consulting",
      framing: "When a team is going in circles, it's rarely because people disagree on facts — it's because they haven't surfaced the assumptions underneath. That's exactly what facilitated alignment work is for.",
    },
  },
  "people-culture": {
    A: {
      service: "Organisational Culture Review",
      url: "/services#strategic-consulting",
      framing: "Collaboration doesn't fix itself by hoping. A structured culture review identifies what's structural (fixable by design) versus relational (fixable by conversation) — and gives you a sequence.",
    },
    B: {
      service: "Leadership Coaching",
      url: "/services#strategic-consulting",
      framing: "Sometimes the hardest leadership conversation is the one you haven't had yet. Coaching can help you prepare for that conversation — and mean it.",
    },
    C: {
      service: "Team Diagnostic & Reset",
      url: "/services#strategic-consulting",
      framing: "When you can't separate the individual from the collective, it's a systems problem. A diagnostic gives you the language and the evidence to act — not just feel.",
    },
  },
  "impact-evidence": {
    A: {
      service: "Impact Storytelling Framework",
      url: "/services#ai-powered-knowledge-systems",
      framing: "Nera can systematically capture beneficiary stories, tag them by theme, and surface patterns your funders haven't seen. Stories become evidence when they're structured.",
    },
    B: {
      service: "Theory of Change Development",
      url: "/services#strategic-consulting",
      framing: "Attribution is a red herring for most community organisations. What funders actually need is a credible theory of change — and confidence that you're measuring the right leading indicators.",
    },
    C: {
      service: "Board Reporting Redesign",
      url: "/services#ai-powered-knowledge-systems",
      framing: "If your reports don't change decisions, they're compliance artefacts, not governance tools. A reporting redesign starts with what your board actually needs to feel confident — then works backwards.",
    },
  },
};

// ─── Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { conversationId, conversationHistory, branch, branchSignal } = body;

    if (!conversationId || !conversationHistory || !branch) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const convContext = CONVERSATION_CONTEXT[conversationId] || "";
    const branchCtx = BRANCH_CONTEXT[conversationId]?.[branch] || "";
    const cta = CTA_MAP[conversationId]?.[branch] || {
      service: "Strategic Consulting",
      url: "/contact",
      framing: "Every organisation's situation is unique. A conversation with Carla is the best way to understand what's possible.",
    };

    // Format conversation for the prompt
    const transcript = conversationHistory
      .map((m: { role: string; content: string }) =>
        `${m.role === "assistant" ? "NERA" : "VISITOR"}: ${m.content}`
      )
      .join("\n\n");

    const extractionPrompt = `You are an insight extraction engine for Carlorbiz, a strategic consulting practice led by Carla Taylor.

You have just observed a Socratic conversation between Nera (AI interviewer) and a visitor exploring a leadership challenge. Your job is to extract a structured insight card that names the thing the visitor is feeling but hasn't articulated — the real tension beneath the presenting problem.

## CONVERSATION CONTEXT
${convContext}

## BRANCH CLASSIFICATION
Branch ${branch}: ${branchCtx}
${branchSignal ? `Classification signal: "${branchSignal}"` : ""}

## TRANSCRIPT
${transcript}

## YOUR TASK

Produce a JSON object with exactly 5 fields. Each field should be 1-3 sentences maximum. Write in Australian English. Be direct, warm, and insightful — not generic or corporate.

{
  "coreTension": "The real problem beneath the presenting problem. Name the tension the visitor is navigating — the thing that makes this hard, not just complicated. Be specific to what they said, not generic.",

  "organisationalSignal": "A brief read on the organisation's current state based on what the visitor revealed. What does the way they described their situation tell you about where the organisation actually is? This should feel like a perceptive observation, not a diagnosis.",

  "keyInsight": "1-2 sentences naming the felt-but-unarticulated thing. This is the moment the visitor should think 'yes, that's exactly it'. Use their own language where possible. Do not be vague.",

  "questionToSitWith": "A generative question for their next leadership conversation. Not a coaching question for them personally — a question they could bring to their next meeting or board discussion that would shift the conversation. Frame it as something practical they can use.",

  "possibleNextStep": "${cta.framing}"
}

IMPORTANT:
- Use the visitor's actual words and specific situation. Do NOT produce generic consulting-speak.
- The core tension should feel like a mirror — the visitor should recognise themselves.
- The key insight should name something they know but haven't said out loud.
- The question should be one they'd actually want to ask in their next meeting.
- Return ONLY valid JSON. No preamble, no markdown fencing.`;

    const config: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: Deno.env.get("ANTHROPIC_API_KEY") || "",
    };

    const raw = await callLLM(
      config,
      extractionPrompt,
      [{ role: "user", content: "Extract the insight card from this conversation." }],
      1024
    );

    // Parse the JSON response
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const insights = JSON.parse(cleaned);

    return jsonResponse({
      coreTension: insights.coreTension || "",
      organisationalSignal: insights.organisationalSignal || "",
      keyInsight: insights.keyInsight || "",
      questionToSitWith: insights.questionToSitWith || "",
      possibleNextStep: insights.possibleNextStep || "",
      service: cta.service,
      serviceUrl: cta.url,
      conversationId,
      branch,
    });
  } catch (err) {
    console.error("insight-extract error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Insight extraction failed" },
      500
    );
  }
});
