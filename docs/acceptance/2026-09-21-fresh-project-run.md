# Strategy Engine client runbook - acceptance run, steps 8-11 (CC-347)

Run: 21 Sep 2026 (UTC 00:55-01:10). Project `thsapsjqzqrctlclprzz` only. Clone at e10cb71.
Secrets in play: GOOGLE_API_KEY + LLM_PROVIDER=google (Google-only client).
Paths below are relative to `SP/strategy-engine-accept`.

## Pre-state / seeded demo data (item 6) - PASS

Before any insert: `st_engagements 0, user_profiles 0, auth.users 0, st_documents 0, st_engagement_roles 0, st_ai_config 0`.
After the run: 1 engagement, 1 auth user, 1 profile, 0 commitments - all mine. No migration (incl. 0018 demo_kestrel_mutual) seeded engagements, users or profiles into this project.
(st_ai_config had 0 rows, so there is no global-defaults row either.)

## Step 8 - bootstrap admin - PASS

- `POST /auth/v1/admin/users` (service_role, email_confirm true, random password) -> user `1f47d19d-609c-4c99-b9d1-5c457ac51bb4`, email_confirmed_at set.
- No profile row existed beforehand (no auto-profile trigger fired on auth user creation).
- Ran scripts/bootstrap-admin.sql with only the email changed. The MCP SQL call returned "The operation timed out" but the transaction had committed: `user_profiles` = id = user_id = auth uid, role internal_admin. That is the "Created internal_admin profile ..." branch; the NOTICE text itself was NOT captured (MCP does not return notices; no psql on this machine) - not verified verbatim.
- Step 8.3 (reload UI, "No engagements yet") - not verified (headless).

## Step 9 - first engagement - SQL PASS, but plants DEFECT 1

Ran the block verbatim with four values changed. Result: engagement `7afa1254-7a1e-45bd-a1ea-7d470aa3f967` slug `wattlebrook`, 3 roles, 1 st_ai_config row.
The st_ai_config row came out with `llm_provider='anthropic'`, `llm_model='claude-sonnet-4-20250514'` (column defaults).

## Step 11 - ingest - FAIL as written, PASS after fix

Client flow mimicked (client/src/components/engagement/DocumentUpload.tsx:150-186, client/src/lib/documentApi.ts:81-194): .md is "extractable" -> sovereign path: password sign-in with anon key -> `POST /rest/v1/st_documents` (file_path NULL, status uploaded) as the user JWT -> `POST /functions/v1/st-ingest-document` `{document_id, segment_text, segment_index:0, total_segments:1}`. No storage upload happens on this path.

First attempt, all three documents (inserts 201, RLS fine):

    500 {"error":"No API key configured for LLM provider: anthropic","segment_index":0}

### DEFECT 1 (blocker for any non-Anthropic client)
- Root cause: `supabase/migrations/20260918000001_st_0001_init.sql:542-543` give st_ai_config `llm_provider DEFAULT 'anthropic'`, `llm_model DEFAULT 'claude-sonnet-4-20250514'`. The runbook step 9 insert (`CLIENT_RUNBOOK.md` ~line 179, `INSERT INTO st_ai_config (engagement_id, profile_key)`) omits both, so the defaults land in the row. `supabase/functions/_shared/interview-engine-helpers.ts:69-77` treats row.llm_provider as an explicit operator override that beats the LLM_PROVIDER secret and throws when its key is missing. So the runbook's own "Google-only client" / "OpenAI-only client" options in step 5 cannot pass step 11.
- Fix applied (scratch clone): runbook step 9 insert now writes `llm_provider, llm_model` = NULL, NULL with a comment. Data fix on the project: `update st_ai_config set llm_provider=null, llm_model=null where engagement_id=...`. A better permanent fix is a migration dropping the two column defaults (not done).
- Side note: the st-provision-sandbox clone functions (migrations 0013:173, 0017:116) copy llm_provider/llm_model from the template row, same trap if demo tier is ever used on a client project.

### Minor (D5): server leaves status 'ingesting' on a segment error
After the 500s all three rows sat at `status='ingesting'`, summary NULL. The browser client sets `failed` itself after 3 attempts (documentApi.ts:184-189), so this only shows if the tab closes mid-retry. Not fixed.

Retry on the same document ids after the fix (segment 0 is an idempotent restart):

| Document | HTTP | time | chunks_inserted | st_documents.status | chunk_count | rows in knowledge_chunks |
|---|---|---|---|---|---|---|
| Board minutes extract - 18 August 2026 | 200 | 27.4 s | 20 | ingested | 20 | 20 |
| Strategic Plan 2027-2030 excerpt | 200 | 22.9 s | 19 | ingested | 19 | 19 |
| Risk register note - 2 September 2026 | 200 | 22.5 s | 27 | ingested | 27 | 27 |

Chunks land in `knowledge_chunks` (source_app strategic-tool, engagement_id set, source_id = document id). There is no embedding column: retrieval is Postgres FTS, so no embeddings provider/key is needed.

### DEFECT 4 (cosmetic, Google provider): document summaries truncated
`st_documents.summary` came back as "Wattlebrook Community Health", "Wattlebrook Community Health's", "Wattlebrook Community Health" - two or three words. Summary call: `supabase/functions/st-ingest-document/index.ts:389-394` with maxTokens 200 -> `supabase/functions/_shared/llm.ts:261` `maxOutputTokens: 200`. Likely cause: gemini-2.5-flash thinking tokens consume the 200-token budget. Cause NOT verified (no finishReason captured). Not fixed.

## Step 11 - Nera query + citations

Caller mimicked: client/src/lib/stNeraApi.ts:53-70 (`Authorization: Bearer <user JWT>`, `apikey: <anon>`, body `{engagement_id, query, session_id}`), SSE response.

Question: "Which strategic priority does the clinical workforce shortage risk threaten, and what KPIs are attached to that priority?"

Run 1 - HTTP 200 text/event-stream. Raw saved at SP/nera-raw-response-run1.txt.

meta event:

    {"type":"answer","sources":["Board minutes extract - 18 August 2026","Strategic Plan 2027-2030 excerpt"],"query_id":"c7839bf1-dd55-4224-bff4-a93ce17a97e5","tier":"admin","turns_used":null,"turns_limit":null}

Answer (full):

> The clinical workforce shortage risk primarily threatens **Strategic Priority 1 - Care closer to home**. The current allied health waiting time at the Kerrindale outreach clinic is **47 days**, against a board target of **28 days**, a gap attributed to vacant physiotherapy and speech pathology positions (Source 1, Source 2). The opening of the Kerrindale second-day service, a key initiative for this priority, is also contingent on recruiting **3.0 FTE** of clinical staff (Source 3, Source 9).
>
> The KPIs attached to Strategic Priority 1 - Care closer to home are:
>
> *   **KPI 1.1:** An average allied health waiting time at outreach sites of **28 days or fewer by 31 December 2027** (baseline **47 days**, June quarter 2026) (Source 10).
> *   **KPI 1.2:** Outreach occasions of service of **9,500 per year by 2028** (baseline **6,120** in 2025-26) (Source 11).

Figures are correct against the synthetic documents.

### VERDICT on citations: PARTIAL
- YES, the response identifies source documents: the SSE `meta.sources` is an array of document titles (`string[]`; `"<title>, <section_reference>"` when a section exists - st-nera-query/index.ts:527-535). Same list is stored in `nera_queries.sources_cited`. There are no document ids, chunk ids, links or per-claim mapping in the payload. section_reference was NULL on all 66 chunks, so titles only.
- DEFECT 3: inline citations in run 1 were "(Source 1, Source 2)", "(Source 10)" etc. Those are the prompt-internal chunk indices from `formatChunksForContext` (st-nera-query/index.ts:518-524, `[Source ${i+1}] title`); the user never sees that numbering and `meta.sources` has only 2 deduplicated entries, so "Source 10" resolves to nothing. The system prompt asks for citation by title (index.ts:400) but Gemini followed the labels. Run 2 (same question, below) cited "(Strategic Plan 2027-2030 excerpt)" inline, so behaviour is non-deterministic. Not fixed.
- Retrieval note: the Risk register note (the document that actually states what the workforce risk threatens) was not among the 12 chunks used (6 board minutes + 6 strategic plan). Retrieval is unranked OR-keyword FTS `.limit(12)` (index.ts:476-482). The answer reached Priority 1 by inference from the minutes; the risk note also names the workforce priority (Priority 2 KPIs 2.1/2.2), which the answer omitted. Quality limitation, not a crash.

### DEFECT 2: every Nera query log insert fails on a clean install
Edge function log during run 1:

    st-nera-query: failed to log query { code: "PGRST204", message: "Could not find the 'accumulated_context' column of 'nera_queries' in the schema cache" }

- Root cause: `logQuery` (supabase/functions/st-nera-query/index.ts:588-603) writes `response_type`, `turn_number`, `accumulated_context`. `nera_queries` in `supabase/migrations/20260918000000_base.sql:101-120` lacks all three; on Carla's project they came from website-era `migrations/add-carlorbiz-dimensions.sql:35-38`, never folded into the clean-install set. Effect: nera_queries stayed empty (0 rows after run 1) while the client was still handed a `query_id` that does not exist - thumbs feedback and any turn counting by row would silently fail. The user sees nothing wrong.
- Fix applied: new `supabase/migrations/20260918000023_nera_queries_engine_columns.sql` (ADD COLUMN IF NOT EXISTS x3 + pgrst reload); same SQL run on the project via execute_sql (so the project's migration history table does not list 0023). No function redeploy needed.
- Re-test (run 2, same question): 200, query_id d60fde77-79ad-49b1-b5ae-c9f2d570d280, `nera_queries` now 1 row with sources_cited = {Board minutes..., Strategic Plan...}, 12 chunks_used. No new errors logged.

Run 2 answer (full):

> The clinical workforce shortage risk primarily threatens **Strategic Priority 1 - Care closer to home**. This is because the inability to recruit sufficient staff directly impacts the opening of key initiatives like the Kerrindale second-day service and contributes to extended allied health waiting times at outreach clinics.
>
> The KPIs attached to Strategic Priority 1 are:
>
> *   **KPI 1.1:** Average allied health waiting time at outreach sites of **28 days or fewer by 31 December 2027** (baseline **47 days** in the June quarter 2026). (Strategic Plan 2027-2030 excerpt)
> *   **KPI 1.2:** Outreach occasions of service of **9,500 per year by 2028** (baseline **6,120 in 2025-26**). (Strategic Plan 2027-2030 excerpt)

Not verified: streaming in the browser UI, Tools tab absence, PDF upload (I used .md through the same sovereign text path; pdf.js extraction is browser-only).

## Zero calls to any Carla account (item 5) - PASS (by source inspection)

Scope: the 12 core functions + `_shared`. Outbound hosts found:

| Host | Where | Verdict |
|---|---|---|
| `Deno.env.get("SUPABASE_URL")` (project's own) | all functions | own project |
| generativelanguage.googleapis.com | _shared/llm.ts:271, 304 (key in x-goog-api-key header) | chosen provider |
| api.anthropic.com | _shared/llm.ts:191, 224 - only when provider resolves to anthropic | dormant |
| api.anthropic.com | st-ingest-document/index.ts:666 `callDocumentApi` - guarded at :659, throws unless resolved provider is anthropic (legacy server-side PDF path; browser extraction is the default) | dormant, honours LLM_PROVIDER |
| api.openai.com | _shared/llm.ts:335, 368 | dormant |
| `${NERA_ENGINE_URL}` | st-generate-report/index.ts:271 (only if set and tools_in_play non-empty), st-catalogue/index.ts:166 (503 when unset, :38-41) | env only, no default, unset here |
| cdn.sheetjs.com | st-ingest-survey/index.ts:571 dynamic import for xls/xlsx | third-party CDN code load at runtime (not Carla; worth pinning/vendoring) |
| esm.sh | imports: @supabase/supabase-js@2, pdf-lib@1.17.1 | bundled at deploy |

No hardcoded Supabase ref, no run.app, no carlorbiz/mtmot host, no Anthropic call that ignores LLM_PROVIDER, no embeddings provider. "carlorbiz" appears only in header comments.
Env vars read: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY, LLM_PROVIDER, LLM_MODEL, NERA_ENGINE_URL, NERA_ENGINE_READ_KEY.

Built client (`dist/`): Supabase host is `thsapsjqzqrctlclprzz.supabase.co` only (others are SDK doc strings). `https://strategy.carlorbiz.com.au` appears from client/src/App.tsx:43 - a redirect that fires only when the brand resolves to the mtmot host; not a call, not reachable on a client host. index.html loads Google Fonts (fonts.googleapis.com / fonts.gstatic.com).
Runtime egress was not packet-captured; this is a source + log verdict.

Edge/postgres logs for the run window: 3x st-ingest-document 500 (DEFECT 1), 3x 200, 2x st-nera-query 200, one function ERROR (DEFECT 2). The only postgres ERRORs were my own two mistyped diagnostic queries.

## Defect list

1. BLOCKER - st_ai_config defaults 'anthropic' override LLM_PROVIDER: supabase/migrations/20260918000001_st_0001_init.sql:542-543 + CLIENT_RUNBOOK.md step 9 insert (~:179) + _shared/interview-engine-helpers.ts:69-77. Fixed in runbook (patch).
2. HIGH (silent) - nera_queries missing response_type/turn_number/accumulated_context: supabase/migrations/20260918000000_base.sql:101-120 vs st-nera-query/index.ts:588-603. Fixed by new migration 0023 (patch).
3. MEDIUM - inline "(Source N)" citations are unresolvable prompt indices: st-nera-query/index.ts:518-524 (+ prompt rule :400). Not fixed.
4. LOW - doc summaries truncated to 2-3 words under Gemini: st-ingest-document/index.ts:389-394, _shared/llm.ts:261. Cause not verified. Not fixed.
5. LOW - segment failure leaves status 'ingesting' server-side (client compensates, documentApi.ts:184-189).
6. NOTE - retrieval missed the most relevant document (unranked OR FTS, limit 12): st-nera-query/index.ts:476-482.
7. NOTE - runbook step 8 SQL via MCP timed out though it committed; in the dashboard SQL editor this may not occur (not verified).

## Artefacts
- SP/fixes.patch (runbook step 9 + migration 0023)
- SP/run.py, SP/reingest.py (headless client mimic), SP/docs/*.md (3 synthetic documents)
- SP/nera-raw-response-run1.txt, SP/nera-raw-response.txt (run 2)
- SP/adminpw.txt (random admin password for the throwaway project)

## Orchestrator follow-up, same day

Fixed on main after this report: defect 1 (migration 20260921000024 drops the `anthropic` column defaults on `st_ai_config`; verified on the acceptance project, a row inserted by the unmodified runbook SQL now carries NULL provider and model), defect 2 (migration 20260918000023), defect 3 (context is labelled by document title, not by index) and defect 6 (full-text candidates are dealt out one document at a time). Re-asked the same question: the answer drew on the risk register and the strategic plan and cited by title, with no `Source N`. Also found on the build machine, not in the repo: a stray `VITE_NERA_API_URL` in the shell was baked into the first bundle; the runbook now requires a clean-shell check and a one-line bundle check. Still open: defects 4 and 5, and the browser-only checks (step 8 reload, streaming, Tools tab absence, PDF upload).

## Slice 0b (CC-347), 22 Sep 2026

Worked in an isolated worktree (`cc347-slice0b` branch off `main` at `4f932e1`), one commit per item, no push/deploy/remote-project touch. What's verified below is either a local Supabase (Docker) stack or `npx vite build` / `deno check` / `npx tsc --noEmit` — nothing ran against a live client project.

**Verified:**
- Defect 5 (stuck `ingesting` status): every failure path in `st-ingest-document` — Mode C (sovereign text segments, the path the client actually uses), Mode B (per-slice PDF) and a last-resort outer catch — now calls `markFailed()`. Not verified against a live provider call (no API key in this session); verified by code inspection and `deno check`.
- Purge (item 3): verified end to end against a local Supabase stack (Docker) — migrations apply cleanly, `st_purge_engagement()` correctly swept 5 test rows across 5 tables including the two shared ones (`knowledge_chunks`, `nera_queries`, both `ON DELETE SET NULL` rather than cascading), a wrong confirmation string is rejected with no partial purge, a `client_admin` caller gets 403 over the real edge runtime while `internal_admin` succeeds, and `scripts/check-purge-complete.sql` returned `PASS` (0 failures across 112 columns) after the purge. Not verified: the admin UI button/dialog in an actual browser (no browser available in this session) — built to the same shadcn `AlertDialog` idiom already in use elsewhere in the app, and the underlying API call it triggers is the same one verified above.
- Browser-side survey parsing (item 4): `client/src/lib/extractSurvey.ts` parses CSV (papaparse), XLSX/XLS (SheetJS, installed from its official cdn.sheetjs.com distribution — the npm registry's own package is stuck pre-CVE-fix at 0.18.5) and JSON entirely client-side; `st-ingest-survey` accepts the parsed structure as an alternative to downloading a stored file. Verified by `npx vite build` (xlsx correctly lands in its own lazy chunk, not the eagerly-loaded engagement shell) and `deno check`. Not verified: an actual upload through the browser UI (no browser in this session) or the server function's LLM analysis of parsed responses against a live provider key.
- Brand by env (item 7): verified with a real build — `VITE_BRAND_PRODUCT_NAME`, `VITE_BRAND_ACCENT_COLOR` and `VITE_BRAND_SUPPORT_EMAIL` set to test values were confirmed present in `dist/assets/*.js` afterwards. No host-map remains in `client/src/lib/brand.ts`.
- `.env.production.example` (item 8): every variable it lists was grepped fresh from `import.meta.env` (client) and `Deno.env.get` (edge functions, including `_shared/`) in this branch, not copied from the older `.env.example`. Confirmed no line has a value after `=`.
- Website-surface strip (item 6): confirmed by `npx vite build` (module count 3774 → 2519) and `npx tsc --noEmit` (21 pre-existing errors → 5, all five confirmed to be the identical pre-existing errors at the identical file:line on `main`, none new).

**Not verified — needs a browser or a live project:**
- Any of it actually rendering correctly in a browser: the purge dialog, the survey/document upload flows, the brand env values showing up visually, the stripped router not 404ing on a real route.
- A real LLM call under any provider — defect 4's fix (thinking-token headroom in `_shared/llm.ts`) is the defensible fix for the documented mechanism, not proven against a live Gemini response in this session; no `finishReason` was captured either here or in the original 21 Sep run.
- The admin-only purge gate and the browser-parsed survey path deployed to an actual Supabase project (only verified against a local Docker stack).
- Image rejection's UX in an actual browser (drag-and-drop vs. file-picker paths) — verified by code reading only.
