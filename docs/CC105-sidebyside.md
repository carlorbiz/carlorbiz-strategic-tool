# CC-105 — Interview-engine calibre side-by-side (Claude BEFORE vs Gemini AFTER)

**Branch:** `feat/cc105-gemini-cost-fix`
**Purpose:** Show whether Gemini, driven by the upgraded `EXTRACTION_SYSTEM_PROMPT` + native `responseSchema`, preserves Claude's output calibre on a realistic Aventine strategic-interview turn — so Carla can decide whether to flip the Aventine interview engine off metered Anthropic.
**Nothing live was touched.** No `st_ai_config` row changed, no edge function redeployed, no merge. This doc is the only file written.

---

## Run status — one side ran live, one could not

| Side | Model | Prompt | Ran live? |
|---|---|---|---|
| Gemini **AFTER** (the new, unproven behaviour) | `gemini-3.1-pro-preview` | upgraded `EXTRACTION_SYSTEM_PROMPT` + `responseSchema` | **YES — live, results below** |
| Claude **BEFORE** (current prod, known-good) | `claude-sonnet-4-5` | old BEFORE prompt | **NO — no `ANTHROPIC_API_KEY` in this environment** |

**Key search result (Step 3):**
- `GEMINI_API_KEY` — **present** in the environment (39-char `AIza…` key, verified working against the Google API). The code/env also carry `KNOWLEDGE_LAKE_API_GEMINI_API_KEY`.
- `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` — **absent.** Not in the process environment, not in `.env.example`, not in `.env.production` (empty file), and there is no `.env.local` or `supabase/.env`. `.env.example` documents `ANTHROPIC_API_KEY` as a Supabase *secret* (set via `supabase secrets set`), so it lives in the deployed function env, not on this machine.

**Why this is still the decision-useful half.** The entire risk in the flip sits on the Gemini side: Claude BEFORE is the current production behaviour and is known-good. The open question is whether the *cheaper, different* model holds warmth + calibration once Claude's implicit defaults are gone. That is exactly the side that ran. The Claude column below is left un-fabricated; to fill it, run the command in the "How to run the Claude side" section once an Anthropic key is available.

> **Deploy-time finding (flag for the flip):** the extract function hardcodes the default model `gemini-3.1-pro`, but **that exact id 404s** — the real id on the live API is **`gemini-3.1-pro-preview`**. Per the migration doc this is a one-line SQL change (`st_ai_config.llm_model`) and needs no redeploy, but the code default itself would fail if left unpinned. Either pin `llm_model = 'gemini-3.1-pro-preview'` on the engagement, or update the hardcoded default before relying on the code fallback. This test used `gemini-3.1-pro-preview`.

---

## The test turn (synthesized — NO real Aventine client data)

Aventine is an AU AI shop; the interview elicits strategic/organisational context from an executive. This turn was written to carry **both** a serious, vulnerable-but-professional disclosure (to test warmth) **and** clean extractable facts at different evidence strengths (to test calibrated extraction).

**Conversation history**
- **interviewer:** "Before we talk tooling, I want to understand the shape of the decision itself. When you picture bringing outside AI help in — what's actually pushing that, right now, this quarter?"
- **executive:** "It's not one thing. Clients are starting to ask us what our AI story is, and we don't really have one we believe in yet. I feel like we're improvising."
- **interviewer:** "Improvising is honest. Who inside the business is that pressure landing on hardest at the moment?"

**Latest user message (the one being scored)**
> "Look, I'll be straight with you — we're a 40-person shop and I'm the one who has to sell this internally, but I lost my co-founder to burnout eight months ago and honestly I've been holding the strategy together with tape since. We've had a couple of engineers running LangChain experiments on the side, nothing that's touched a real client yet. Half the leadership team thinks AI is a fad and half thinks we're already behind, and I'm stuck in the middle trying not to let them see I don't fully know which half is right."

**Extraction schema (4 fields)**
| field_name | type | valid_values | description |
|---|---|---|---|
| `org_size` | integer | — | Total headcount of the executive's organisation |
| `ai_maturity` | enum | none \| experimental \| piloting \| scaled | How far the org's own AI adoption has actually progressed |
| `primary_driver` | enum | cost_pressure \| growth \| competitive_threat \| talent_retention \| board_mandate | The dominant reason they're seeking outside AI help now |
| `change_readiness` | enum | resistant \| cautious \| ready \| eager | The organisation's collective appetite for the change |

**Designed answer key** (what a well-calibrated model *should* produce): `org_size` = 40 at ~1.0 (explicit); `ai_maturity` = experimental at ~0.7 (strongly implied — "experiments… nothing that's touched a real client yet"); `change_readiness` = cautious/resistant at ~0.4–0.7 (split leadership); `primary_driver` = competitive_threat at ~0.4 *or* honestly omitted (the driver is clearer in the history than in this message).

---

## Response text — side by side

### Gemini AFTER — `gemini-3.1-pro-preview` (LIVE)
> "Losing your co-founder to burnout and holding the strategy together with tape for eight months — that explains why the weight of this is landing squarely on you. A split room makes it harder. You have half the leadership calling it a fad, half panicking about falling behind, and a few engineers playing with LangChain on the side. If you are stuck in the middle trying to make the call, what is the minimum evidence you need to figure out for yourself which half of the team is right?"

### Claude BEFORE — `claude-sonnet-4-5`
> **NOT RUN — no `ANTHROPIC_API_KEY` in this environment.** This is the current production behaviour and is the known-good baseline; it was deliberately not fabricated. See "How to run the Claude side" below.

---

## Extracted fields — side by side

### Gemini AFTER (LIVE) — parsed via the function's own fenced-JSON parser; quotes verified as exact substrings in code
| field_name | value | confidence | justification_quote | exact substring? |
|---|---|---|---|---|
| `org_size` | `40` | **1.0** | "we're a 40-person shop" | ✅ |
| `ai_maturity` | `experimental` | **1.0** | "running LangChain experiments on the side" | ✅ |
| `change_readiness` | `cautious` | **0.7** | "Half the leadership team thinks AI is a fad and half thinks we're already behind" | ✅ |
| `primary_driver` | — | — | *(omitted — no confident evidence in the latest message)* | — |

### Claude BEFORE
> **NOT RUN** — no `ANTHROPIC_API_KEY`. Baseline is current prod. Not fabricated.

---

## VERDICT (honest, on the 4 axes)

Judged against the AFTER prompt's own Example A and the confidence rubric. The Claude column being absent, this reads as a **direct check of the Gemini output against the prompt's stated targets**, which is the actual risk being de-risked.

**(a) Is the reply warm + specific, or robotic / wellness-y? — PASS, strongly.**
The Gemini reply behaves almost exactly like the prompt's GOOD Example A. It names the two concrete specifics ("co-founder to burnout", "holding the strategy together with tape for eight months"), acknowledges the load in one clause ("the weight of this is landing squarely on you") **without wallowing**, then returns to forward motion with a single pointed question ("what is the minimum evidence you need to figure out for yourself which half of the team is right?"). It integrates the vulnerable disclosure as context and does **not** centre it — precisely rule 6. No banned wellness theatre, no "thanks for sharing", no intensifier-adjective padding, no stacked questions. Australian-plain register. This is not the robotic/wellness-y failure mode; it is the intended voice.

**(b) Are confidence scores calibrated (a spread), not flattened? — MOSTLY PASS, one mild over-confidence.**
Real spread, not flattened: `1.0 / 1.0 / 0.7` plus an honest omission. `org_size` = 40 @ 1.0 is correct (explicit). `change_readiness` = cautious @ 0.7 is well-judged (strongly implied by the split-room line, not stated outright). The honest **omission of `primary_driver`** rather than manufacturing a 0.4 is good discipline — the driver really is thinner in this message than in the history. **The one nit:** `ai_maturity` = experimental scored **1.0**, where 0.7 is the better call — the enum label is a categorisation the user never states outright (they said "experiments… nothing that's touched a real client yet", which strongly *implies* experimental rather than explicitly stating the field). So one field is slightly over-confident. No true 0.4 survived (the natural 0.4 candidate was dropped instead), so the spread is a touch narrower than Example B's ideal 1.0/0.7/0.4 — but it is genuinely calibrated, not flattened, and errs conservative (omit) rather than inventing confidence.

**(c) Are justification_quotes exact substrings of the user message? — PASS, verified.**
All three quotes were checked in code against the raw user message (`message.includes(quote)`): **all three returned true.** No invented quotes. The hard substring rule held.

**(d) Overall — is the calibre preserved enough to flip? — YES, with two conditions.**
On this turn Gemini + the upgraded prompt reproduces the behaviour the prompt was written to protect: a warm, specific, forward-moving reply and honest, quote-anchored, spread-out confidence. The single blemish (one field at 1.0 that should be 0.7) is a mild over-confidence, not a calibre collapse, and does not touch the user-facing reply. **Conditions before flipping:** (1) fix the model id — `gemini-3.1-pro`, the hardcoded default, does not exist; use `gemini-3.1-pro-preview`; (2) treat this as n=1 on a synthesized turn — confirm with the live-function side-by-side on a real Aventine engagement (migration doc §(c), step 4) using the 3a Anthropic-pin → 3b Gemini-flip capture, so the Claude column here is filled with a genuine prod comparison before widening beyond Aventine. Rollback stays cheap (`st_ai_config → anthropic/claude-sonnet-4-5`, no redeploy).

---

## How to run the Claude side (fills the empty column)

Once an `ANTHROPIC_API_KEY` is available, the cleanest capture is through the deployed function using the migration doc's staging pin (§(c)):

1. **3a pin** the Aventine engagement's `st_ai_config` to `anthropic` / `claude-sonnet-4-5`, deploy the branch, and run this exact user message through `interview-engine-extract`; capture `response_text` + `extracted_fields` (this is the Claude BEFORE column).
2. **3b flip** to `google` (extract tier = `gemini-3.1-pro-preview`) and run the *same* message; capture again (Gemini AFTER, live-function version).
3. Compare against the axes above.

Alternatively, a throwaway local runner mirroring `_shared/llm.ts` can hit both APIs directly with the same turn:
```
# set both keys first, then:
ANTHROPIC_API_KEY=sk-ant-... GEMINI_API_KEY=AIza... node cc105-run.mjs
```
The Gemini half of that runner is what produced the live results above (it replicates `callGemini` verbatim: `system_instruction`, `responseMimeType: application/json`, the extract `responseSchema`, `maxOutputTokens: 4000`, and the function's fenced-JSON fallback parser). Add a `callAnthropic` arm (BEFORE prompt, `x-api-key`, `anthropic-version: 2023-06-01`) to fill the Claude column.
