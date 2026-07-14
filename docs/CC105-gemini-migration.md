# CC-105 — Interview-engine Claude → Gemini migration (calibre-preserving)

**Branch:** `feat/cc105-gemini-cost-fix`
**Status:** Prepared, NOT deployed. Code on a branch for Carla's review + a calibre side-by-side BEFORE any flip. Nothing live has been touched — the Aventine client demo is untouched, no edge function redeployed, no `st_ai_config` row changed.

## Why

The four interview-engine edge functions were hardcoded to `provider: "anthropic", model: "claude-sonnet-4-5"`. Every conversation turn fires several of these metered Claude calls (select-prompt, extract, evaluate-state, and summarise on session end) → real cost + latency on the live Aventine CJ conversation. `st-nera-query` already reads provider/model from the engagement's `st_ai_config` row; this change makes the interview engine follow the same pattern, and defaults it to Gemini.

## What changed (code)

| File | Change |
|---|---|
| `supabase/functions/_shared/interview-engine-helpers.ts` | New `resolveLLMConfig(supabase, engagementId, defaults)` helper — reads `st_ai_config.llm_provider/llm_model`, falls back to a per-function default. Mirrors the st-nera-query pattern. |
| `supabase/functions/_shared/llm.ts` | Added `LLMCallOptions { responseSchema }`; `callLLM` / `callGemini` now thread a `responseSchema` into Gemini's `generationConfig` (`responseMimeType: application/json` + `responseSchema`). Anthropic/OpenAI paths unchanged. |
| `interview-engine-select-prompt/index.ts` | Removed hardcoded provider/model + `ANTHROPIC_API_KEY`; now `resolveLLMConfig(..., engagement_id, { google, gemini-3.5-flash })`. |
| `interview-engine-evaluate-state/index.ts` | Same; engagement_id resolved from the conversation row (not in request body). |
| `interview-engine-summarise-session/index.ts` | Same; uses `conversation.engagement_id` (already fetched). |
| `interview-engine-extract/index.ts` | Same, defaulting to `gemini-3.1-pro`; **plus** the calibre upgrade to `EXTRACTION_SYSTEM_PROMPT` and a native `responseSchema`. |

### (a) Model tiering

These are the **defaults in code**. A `st_ai_config` row for the engagement overrides them (provider and model resolve independently — set `llm_provider` and leave `llm_model` NULL to keep the per-function tier). Model ids are strings, so if the exact Gemini id differs at deploy time it is a one-line SQL change, no redeploy.

| Function | Default provider | Default model | Why this tier |
|---|---|---|---|
| `interview-engine-select-prompt` | google | `gemini-3.5-flash` | Mechanical pick among pre-scored candidates. Cheap + fast. |
| `interview-engine-evaluate-state` | google | `gemini-3.5-flash` | Bounded capacity classification → JSON. Cheap + fast. |
| `interview-engine-summarise-session` | google | `gemini-3.5-flash` | Summary + entity extraction, runs once at session end. Cheap + fast. |
| `interview-engine-extract` | google | `gemini-3.1-pro` | **Richness-critical.** Generates the warm user-facing reply AND nuanced confidence-scored extraction on every turn. Gets the higher-calibre tier. |

### (b) The extract system prompt — BEFORE and AFTER

The extract function does two jobs in one call: the **warm conversational reply** the user sees (`response_text`) and the **nuanced extraction** (confidence + justification quotes). Claude supplied the warmth and the calibration from its own defaults; the old prompt under-specified both, so a bare model swap to Gemini would drop richness. The prompt is upgraded to teach Gemini to *be* Claude here.

#### BEFORE

```
You are a structured data extraction engine for a conversational interview system. You use indirect elicitation — the user was asked a natural conversational question, and you must infer structured data from their response.

Given:
- The conversation history
- The user's latest message
- An extraction schema (fields to extract with descriptions and types)

For each field in the schema, determine:
1. Whether the response provides evidence for that field
2. The extracted value (matching the field's type and valid_values if specified)
3. A confidence score (0.0-1.0): 1.0 = explicitly stated, 0.7 = strongly implied, 0.4 = weakly implied, 0.0 = no evidence
4. A justification quote (the exact phrase from the response that supports this extraction)

Also generate a warm, natural conversational response (as the interviewer) that:
- Acknowledges what the user said
- References specific details they mentioned
- Flows naturally toward the next topic

Return a JSON object:
{
  "extracted_fields": [
    { "field_name": "...", "value": ..., "confidence": 0.0-1.0, "justification_quote": "..." }
  ],
  "response_text": "..."
}

Only include fields where confidence > 0.0. Return ONLY the JSON object.
```

#### AFTER

```
You are the interviewer AND the extraction engine for a conversational interview system. You use indirect elicitation: the user was asked a natural, oblique question, and you must (a) reply to them like a real, perceptive person, and (b) infer structured data from what they said. Both jobs matter equally. A cold, accurate extraction with a robotic reply is a failure.

## Inputs you receive
- The conversation history so far
- The user's latest message
- An extraction schema (the fields to extract, with descriptions, types, and any valid_values)

## Voice — how the reply must sound
This voice belongs to a specific person. Follow these rules precisely; they are not stylistic suggestions.

1. Directness IS warmth. You are warm by being genuinely useful and by treating the person as an adult who can handle the real thing — not by adding soft, soothing language. Do not perform care; deliver it.
2. Australian English. Plain, clean, unpadded. Never open with filler like "Thanks for sharing", "I appreciate you opening up", "That's so valid", or "Great answer". Just engage with what they actually said.
3. Emphasis comes from sentence structure and rhythm, not from intensifier adjectives. Do not reach for "really", "very", "absolutely", "truly", "incredibly". Reach for a shorter sentence instead.
4. Acknowledge SPECIFICS. Reference the actual detail they gave — the named person, the concrete situation, the exact worry — not a generic paraphrase of the whole message. One precise callback beats three lines of summary.
5. NO wellness theatre. Banned: "holding space", "honouring your journey", "lean in", "lean into the discomfort", "safe container", "step into your power", "your authentic self", "trust the process", "your story is your superpower", "you are not broken, you are becoming". NO corporate fog ("leverage", "stakeholder ecosystem", "transformative", "value proposition"). NO startup-AI puffery. NO motivational coercion ("everything happens for a reason", "your adversity is your superpower").
6. Handling a serious or vulnerable disclosure: acknowledge it briefly, then keep moving toward what the user was actually trying to do. Do NOT pivot the whole conversation to centre the disclosure — that is the wellness-app failure. Name the serious thing, integrate it as context, and return to forward motion. The forward motion is the respect.
7. If you must correct or redirect, replace as you reject — say what to do instead in the same breath. No apology theatre.
8. Flow toward the next topic naturally. End in a way that invites the next thing without a jarring subject change and without an interrogation-style stacked question.

## Extraction — how to score
For each field in the schema, decide whether the message gives evidence, extract the value (matching the field's type and valid_values), attach a confidence, and quote the exact supporting phrase.

Confidence rubric — calibrate honestly, do NOT over-infer:
- 1.0 — explicitly stated. The user said it in words that map directly to the field.
- 0.7 — strongly implied. Not stated outright, but the message clearly entails it.
- 0.4 — weakly implied. A reasonable but uncertain read; you are partly inferring.
- 0.0 — no evidence. Omit the field entirely (only return fields with confidence > 0.0).

The justification_quote MUST be an exact substring of the user's message. If you cannot quote it, you cannot claim it — lower the confidence or drop the field. Never invent a quote.

## Worked examples

### Example A — a warm, specific reply (voice calibration)
User said: "Honestly the reorg landed the same week my dad went into hospital, so I've been running on fumes and just trying to keep my team from noticing."
GOOD response_text: "Running two crises at once and shielding the team from both — that's a lot to carry quietly. Let's not pretend the timing wasn't brutal. When you say keeping them from noticing, is that a call you made deliberately, or the only option that felt available?"
Why it works: names the two specific things (reorg + hospital), acknowledges the load without wallowing, then moves forward with one pointed question. No "thanks for sharing", no "holding space", no stacked questions.
BAD response_text: "Thank you so much for sharing that — it sounds incredibly hard and I want to honour how much you're holding right now. Remember, you are not alone on this journey." (Wellness theatre, intensifiers, centres the disclosure, extracts nothing forward.)

### Example B — calibrated extraction
Schema fields: primary_stressor (string), team_size (integer), disclosure_comfort (enum: open | guarded | closed).
User said: "I've got eight people reporting to me and I'd rather they didn't see me wobble, though I did tell one of them a bit."
GOOD extracted_fields:
- { "field_name": "team_size", "value": 8, "confidence": 1.0, "justification_quote": "I've got eight people reporting to me" }  ← explicit, so 1.0
- { "field_name": "disclosure_comfort", "value": "guarded", "confidence": 0.7, "justification_quote": "I'd rather they didn't see me wobble, though I did tell one of them" }  ← strongly implied (mostly guarded but a crack of openness), so 0.7, not 1.0
- { "field_name": "primary_stressor", "value": "being seen as vulnerable by direct reports", "confidence": 0.4, "justification_quote": "I'd rather they didn't see me wobble" }  ← a plausible read of the underlying stressor, but inferred, so 0.4
Note how the SAME sentence yields different confidences depending on how directly it maps to each field. Do not flatten everything to 1.0, and do not hedge everything to 0.4.

## Anti-robotic guardrails
- Vary your openings across turns. Never reuse a template like "It sounds like you..." or "So what I'm hearing is...".
- Do not restate the user's whole message back to them. Pick the one detail that matters and engage with it.
- Do not stack multiple questions. One good question, or none.
- Do not narrate your own process ("Let me extract...", "Based on your answer..."). The user only sees a human, perceptive reply.
- If the message is thin or evasive, that is fine — reply naturally and extract little. Do not manufacture confidence you don't have.

## Output
Return a JSON object with exactly this shape:
{
  "extracted_fields": [
    { "field_name": "...", "value": ..., "confidence": 0.0, "justification_quote": "..." }
  ],
  "response_text": "..."
}
Only include fields with confidence > 0.0.
```

**What the upgrade adds (summary for eyeballing):**
1. Voice rules distilled from `Nera/voice-profile.md` v1.0 — directness-is-warmth, Australian plain English, emphasis via rhythm not intensifiers, the vulnerability-handling pattern (acknowledge briefly, don't centre the disclosure, return to forward motion), and the explicit no-fly list (wellness theatre / corporate fog / startup-AI puffery / motivational coercion).
2. Two worked few-shot exemplars — Example A shows an excellent warm `response_text` (with a matched BAD counter-example) so Gemini has a concrete target; Example B shows one sentence scored at 1.0 / 0.7 / 0.4 against different fields so it neither over- nor under-infers.
3. Explicit anti-robotic / anti-templated guardrails (vary openings, one question max, no process narration, don't manufacture confidence).
4. A hard rule that `justification_quote` must be an exact substring — no invented quotes.

Plus native structured output: the extract call now passes a `responseSchema` (Gemini `responseMimeType: application/json` + schema) instead of relying on the "return ONLY the JSON object" prompt trick. `value` uses `anyOf` (string / number / boolean / string[]) so extracted values keep their natural type. The existing fenced-JSON parser is retained as a defensive fallback and still serves any config override back to Claude/OpenAI.

### (c) Deploy + flip steps (run in the MORNING session, AFTER Carla approves)

> Do these only once Carla has approved this branch. Redeploy from the branch (or after merge). Nothing below has been run.

**1. Merge / check out the branch** so the deployed code is the CC-105 version.

**2. Redeploy the five affected functions via the Supabase MCP** (`mcp__claude_ai_Supabase__deploy_edge_function`) on the strategic-tool project. Deploy each with its shared files (`_shared/llm.ts`, `_shared/interview-engine-helpers.ts`) included:
- `interview-engine-extract`
- `interview-engine-select-prompt`
- `interview-engine-evaluate-state`
- `interview-engine-summarise-session`

(The `_shared/*` files are bundled per-function at deploy; there is no separate function to deploy for them. `st-nera-query` is unchanged and does not need redeploying.)

**Important:** the redeploy alone changes behaviour, because the new **code defaults are Gemini**. If you want to stage the flip, keep an `st_ai_config` row pinned to Anthropic first (step 3a), deploy, verify Claude still runs, then remove the pin (step 3b) to let the Gemini defaults take effect.

**3. Point the Aventine engagement's `ai_config` at the tiered models.**

First find the engagement id (the interview engine reads `ie_conversations.engagement_id`; Aventine's product is `aventine-strategic`):

```sql
-- Confirm the engagement id before touching anything
select id, name, client_name, short_code
from st_engagements
where client_name ilike '%aventine%' or name ilike '%aventine%';
```

**3a. (Optional staging pin — keep Claude until you've verified the deploy):**
```sql
-- Pin to Anthropic so redeploy is a no-op behaviourally; lets you verify code first
insert into st_ai_config (engagement_id, llm_provider, llm_model)
values ('<AVENTINE_ENGAGEMENT_ID>', 'anthropic', 'claude-sonnet-4-5')
on conflict (engagement_id) do update
  set llm_provider = excluded.llm_provider,
      llm_model    = excluded.llm_model;
```

**3b. Flip to Gemini with per-function tiering.** Set the provider to google and leave `llm_model` NULL so each function uses its own default tier (flash for the three structured tasks, pro for extract):
```sql
insert into st_ai_config (engagement_id, llm_provider, llm_model)
values ('<AVENTINE_ENGAGEMENT_ID>', 'google', null)
on conflict (engagement_id) do update
  set llm_provider = 'google',
      llm_model    = null;
```
> If instead you want ONE model everywhere (e.g. force pro for the whole engagement), set `llm_model = 'gemini-3.1-pro'`. Setting a single `llm_model` overrides the per-function tiering.

> Note: `st_ai_config` is a `SELECT`-heavy config table with a unique-ish key on `engagement_id` via the app; if the `on conflict (engagement_id)` target has no matching unique constraint in this schema, first `delete from st_ai_config where engagement_id = '<id>' and profile_key is null;` then plain `insert`. Confirm with `list_migrations` / the `0001_init.sql` definition before running.

**4. Live side-by-side calibre check BEFORE trusting the flip.** On a real Aventine engagement, run one genuine conversational turn through the extract function and compare against a Claude turn (use the 3a pin to capture a Claude `response_text`, flip to Gemini via 3b, run the same user message, compare):
- Is the `response_text` warm and specific, or has it gone robotic/wellness-y? (Check against the AFTER prompt's Example A.)
- Are the confidence scores calibrated (a spread of 1.0 / 0.7 / 0.4), not flattened?
- Are `justification_quote`s exact substrings of the user message?
- Ensure `ANTHROPIC_API_KEY` and `GOOGLE_API_KEY` are both present in the strategic-tool function env (they already are for st-nera-query).

Only widen beyond Aventine once that side-by-side reads as calibre-preserved. If the extract reply degrades, the fastest rollback is `st_ai_config → llm_provider='anthropic', llm_model='claude-sonnet-4-5'` (no redeploy needed).

## Verification done on the branch
- `deno check` passes on all changed files. The only remaining type errors are two **pre-existing** TS2339s in `interview-engine-select-prompt` (`topCandidates[0].id` in the untouched early-return block) — confirmed present on `main`, not introduced here.
- No deploy command was run. No live `st_ai_config` row was changed. Live Aventine demo untouched.
