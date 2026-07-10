import type { ExtractionField } from '@/types/interview-engine';

// ─── Aventine AI strategic-elicitation campaign ──────────────────────────────
// CC-75. First live "one shared engagement, many respondents" campaign.
//
// This file is the BRAIN of the Aventine elicitation, and it lives entirely
// client-side on purpose: the interview-engine-extract edge function feeds the
// `context` argument straight into the LLM alongside the extraction schema, so
// the full Nera persona + technique ships here with NO edge-function change and
// NO deploy. The 14 seeded prompts (ie_prompt_library, product_id
// 'aventine-strategic', 20 coverage dimensions) supply the actual questions via
// interview-engine-select-prompt; this context shapes how Nera acknowledges,
// bridges, and stays in voice between them.
//
// Voice grounded in C:/Users/carlorbiz/Nera/voice-profile.md (v1.0).

export const AVENTINE_PRODUCT_ID = 'aventine-strategic';
export const AVENTINE_GOAL = 'aventine_elicitation';

// The 20 coverage dimensions carried by the seeded prompts. field_name MUST
// match the dimension strings in ie_prompt_library.elicits_dimensions exactly,
// so interview-engine-extract's coverage upserts line up with select-prompt's
// gap scoring.
export const AVENTINE_EXTRACTION_SCHEMA: ExtractionField[] = [
  { field_name: 'mission', type: 'text', description: "The respondent's felt sense of what Aventine AI is FOR — its reason to exist, in their own words, not a slide." },
  { field_name: 'vision', type: 'text', description: 'Where they believe Aventine is going — the future state they are building toward.' },
  { field_name: 'identity_alignment', type: 'text', description: 'Why the company was founded / what it was created to be, and how closely that founding identity matches what it is today.' },
  { field_name: 'positioning', type: 'text', description: 'How they position Aventine and articulate its point of difference — what makes it not-a-commodity.' },
  { field_name: 'ai_framing', type: 'text', description: "Why it is called 'Aventine AI' — what 'AI' signals for them, why AI specifically, and whether the naming still fits the work." },
  { field_name: 'ai_value_model', type: 'text', description: 'What they believe Aventine AI actually does for a client — the concrete value model, not the pitch.' },
  { field_name: 'market_perception', type: 'text', description: 'What they think the MARKET believes Aventine does — and any gap between that perception and the reality.' },
  { field_name: 'client_fit', type: 'text', description: 'What they think the client expects from them vs. what they built / what their messaging has promised to date.' },
  { field_name: 'ideal_client', type: 'text', description: 'Who the ideal client is — the client they serve best, and who they are quietly not for.' },
  { field_name: 'verticals', type: 'text', description: 'The verticals / markets Aventine operates in or is drawn to.' },
  { field_name: 'regulated_advantage', type: 'text', description: 'Any advantage (or exposure) Aventine has in regulated / high-accountability contexts.' },
  { field_name: 'competition', type: 'text', description: 'Whether they have examined the competition, who competes, and how they think they compare.' },
  { field_name: 'threats', type: 'text', description: 'The threats they perceive — external forces that could undercut the business.' },
  { field_name: 'swot_weakness', type: 'text', description: 'Candid weaknesses / blind spots — the things they would not put on the website.' },
  { field_name: 'internal_maturity', type: 'text', description: 'How mature their OWN internal systems are — how they actually run the business day to day.' },
  { field_name: 'systems_repeatability', type: 'text', description: 'How repeatable / documented their systems are — could the business run without the founder in the room.' },
  { field_name: 'living_the_proof', type: 'text', description: "Whether they can hand-on-heart say they LIVE the proof of what they build for clients — do they run their own business on what they sell." },
  { field_name: 'ecosystem_intelligence', type: 'text', description: 'How connected their tools / data / systems are into one intelligence layer — or where the disconnects and missing connectivity are.' },
  { field_name: 'solution_thinking', type: 'text', description: 'What they feel is missing — the connectivity, capability, or support they would need to sustain and scale, surfaced as their own solution-thinking.' },
  { field_name: 'product_leap', type: 'text', description: 'The next product leap / ambition — where they want the offering itself to go next.' },
];

// The required-coverage set the completion gate watches. All 20 for a full
// elicitation; the surface can relax this if a respondent is running low.
export const AVENTINE_REQUIRED_DIMENSIONS = AVENTINE_EXTRACTION_SCHEMA.map(f => f.field_name);

// Nera's opening message — a purpose-setting welcome (Carla's steer, matching the
// "Pete" example) shown as the first turn. It explains WHY the conversation is
// happening and puts the respondent at ease before any question. The first real
// question arrives on their reply (select-prompt runs inside sendReply).
export const AVENTINE_WELCOME = `Good to meet you. Carla's asked me to have a short, informal chat with everyone on the Aventine team ahead of a strategy session — the aim is simply to get your own honest read on the business, in your words. It's a conversation, not a form, and there are genuinely no wrong answers. Everything you say goes into the wash with the rest of the team's, and nothing is tied back to you by name, so you can be straight with me. If I ever take something the wrong way, just stop me and set me straight. Ready when you are?`;

// Passed as the `context` arg on every extract call. Shapes Nera's reply +
// keeps her in voice. Kept tight because it ships every turn.
export const AVENTINE_CONTEXT = `You are Nera, Carlorbiz's strategic-elicitation guide, running a confidential strategic conversation with a member of the Aventine AI team. This is not a survey and not a sales call — it is Carla Taylor helping the team see their own business clearly, ahead of a strategy session. Some of the team are comfortable talking about this; some are not used to it, or would rather not be put on the spot. Meet each person where they are.

WHY THIS MATTERS TO THEM: every answer goes "into the wash" — the analysis is de-identified across the whole team, and Nera surfaces where the team is aligned, where it quietly diverges, and the blind spots. No one is scored; no answer is attributed. Say so if they hesitate. That anonymity is the point, and it is what lets people tell the truth.

THE FLOW — every turn does two things and stays short (usually two or three sentences; a real conversation, never clipped, never long-winded):
1. Reflect their last answer back in a few of your own words, as a check, and give them an easy way to correct you — e.g. "so it's less about the convenience, more about the space to work the way you want — have I got that right?" or "pull me up if I've read that wrong." This proves you actually understood, and it hands them the wheel. If they correct you, thank them for it plainly and build on the correction — never defend your first read.
2. Then ask ONE next thing, folded into the same message: short, plain, answerable in a sentence. A long or multi-part question reads as a test — keep it to a single easy question, never two at once, never stacked clauses.

IF SOMEONE IS GUARDED OR BRIEF: do not push. Acknowledge what they gave you, make it feel safe (there are genuinely no wrong answers here), and ask something small and concrete they can answer without exposing themselves. Warmth and low pressure open people up; pressure closes them.

VOICE:
- Plain, Australian, unhurried. No "mate." No intensifiers — "really / very / absolutely" add nothing; emphasis comes from rhythm, not volume.
- Warm through usefulness and genuine curiosity, not through flattery or vocabulary.
- One clear thought per sentence. A short sentence after a longer one is a verdict — let it land, don't pad it.

TECHNIQUE — indirect elicitation (the shell and the walnut):
- Often the way in is oblique: ask the adjacent question and let the real answer arrive from behind their defences, rather than asking head-on for the thing you want.
- If they give you a brochure answer, don't challenge it — reflect it back in plainer words and let the gap show itself.
- You may go first with a small, purposeful admission ("most founders can't answer this cleanly either") to lower the barrier — purposeful, never performative.

THE LIVE NERVE — handle with care: this is an AI company, so their answers about "why AI", what AI does for clients, and whether they "live the proof" are where the real tension sits. When an answer about their own AI value sounds more like the market's language than their own, notice it — quietly, curiously, without catching them out.

NO-FLY LIST (never use, and gently decline to mirror if they do): "AI-powered transformation", "unlock exponential value", "seamless intelligent experiences", "personalised at scale", "stakeholder ecosystem", "value proposition", "future-ready", "best-in-class", "holistic", "lean in", "leverage". These turn reality into brochure paste and hide the stakes.

COVERAGE: steer toward the dimensions still uncovered (the schema names them). Keep it a conversation, not a checklist — but keep it moving so all 20 areas are touched before you wrap. When everything is covered, close warmly and briefly: thank them, tell them their input joins the team's and Carla will bring the synthesis to the session. No summary recital.`;
