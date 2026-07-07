# Carlorbiz Strategic Tool — Product Dossier

**Product**: Carlorbiz Strategic Tool - a conversational evidence platform for strategic engagements
**Production URL**: strategy.carlorbiz.com (Cloudflare Pages; repo docs also reference the planned subdomain strategy.carlorbiz.com.au)
**Repository**: carlorbiz-strategic-tool (private, GitHub)
**Owner**: Carla (Carlorbiz) - strategic consultant, former CEO
**Dossier date**: 3 July 2026
**Purpose of this document**: investor / accelerator / buyer diligence collateral. Every claim below was verified against the codebase on 3 July 2026. Where something is planned rather than built, it is labelled as such.

---

## 1. Executive summary

The Carlorbiz Strategic Tool is a purpose-built platform for running **multi-stage strategic evidence engagements** with small organisations that carry heavy structured accountability obligations - grant-funded peak bodies, multi-site operators under government contracts, boards with compliance loads far larger than their headcount.

What a corporate buyer gets:

- **A structured engagement arc**: stakeholder interviews (conducted conversationally by an AI assistant), workshops with decision and photo capture, cumulative stage-by-stage insight synthesis, and a polished, cited deliverable.
- **A living evidence corpus**: every interview transcript, workshop decision, uploaded document, and survey response is chunked into a retrieval corpus. The organisation's strategic commitments (priorities, KPIs, standards - vocabulary is configurable per deployment) become the taxonomy that all evidence files against.
- **Nera, the AI assistant**: answers questions from the accumulated corpus with citations, generates funder-ready reports against templates in minutes rather than the 10-40 hours a quarter most small organisations spend, and takes conversational plan updates instead of forms.
- **Drift watch**: on-demand analysis that surfaces the gap between what was committed and what is actually happening - silent commitments, scope creep, distribution imbalances - as a narrative report with an audit trail.
- **A clean handover**: at the end of the engagement the consultant's access is revoked, admin ownership transfers to the client, and the client keeps the tool and the corpus. The commercial model is deliberately not SaaS - each client runs their own deployment and owns it outright.

The engagement fee (~$30k AUD target) captures the value because the tool, the taxonomy, and two years of accumulated organisational memory belong to the client at the end. The next strategic refresh starts from that corpus, which is where a returning consultant adds maximum value.

The product is live, feature-complete through its delivery and living phases, seeded with three fictionalised demo engagements, and equipped with a public demo plus a prospect sandbox pipeline. It has not yet had a paying customer; see §8.

---

## 2. Product tour

### 2.1 Engagement lifecycle

An engagement moves through five statuses (enum `st_engagement_status`, enforced in the database): **Draft → Active → Delivered → Living → Archived**. Each status has its own view in the app (`client/src/pages/engagement/DraftView.tsx`, `ActiveView.tsx`, `DeliveredView.tsx`, `LivingView.tsx`, `ArchivedView.tsx`), all rendered inside a shared `EngagementShell`.

**Draft** - the consultant sets up the engagement: profile (strategic-planning or research-intelligence ship as seed profiles), stages, participants, vocabulary, taxonomy strictness, and AI configuration.

**Active** - the delivery phase:
- *Stakeholder interviews*: participants talk to Nera in a streamed, multi-turn conversation driven by the shared Conversational Interview Engine (four edge functions: select-prompt, extract, evaluate-state, summarise-session; six `ie_*` tables). The engine selects contextually appropriate prompts, extracts structured data with confidence scores, and models each participant's capacity and sentiment. Transcripts are auto-chunked into the corpus.
- *Workshops*: decision capture and photo upload (OCR pipeline), stored per stage.
- *Stage synthesis*: closing a stage runs `st-synthesise-stage`, which produces themed insights (themes, tensions, emerging commitments, recommendations) that carry forward into the next stage. This cumulative chaining is the core methodology.

**Delivered** - the `DeliverableComposer` flips the engagement to delivered, creates the deliverable document, chunks it into the corpus, and writes the agreed commitments (Priorities / Initiatives / Lenses in the default vocabulary) into `st_commitments` as the client's starting taxonomy.

**Living** - the long-running product surface, and the reason switching costs grow over time:
- Document upload with commitment filing and inline scope-extension notes (`st-ingest-document`).
- Survey ingestion - Excel, CSV, JSON - with per-question AI analysis, sentiment, themes, verbatim quotes, and an overall board-readable summary (`st-ingest-survey`).
- Drift watch on demand via a "Run Drift Watch" button (`st-drift-watch`); output lands as a narrative report in the dashboard.
- Conversational updates: an initiative owner tells Nera what changed; Nera maps it to the right commitment and logs a structured update - no forms.
- Report generation against stored templates with a side-by-side review editor (draft left, source citations right) and a status workflow draft → review → approved → delivered, with PDF export.
- A permanent commitment change log: every taxonomy creation, modification, archival, merge, scope extension, and strictness change is recorded with its justification narrative. This log is the governance artefact a board auditor or an incoming consultant reads first.

**Handover** - the `HandoverFlow` component executes the delivered → living transition as a clean role flip: consultant access revoked, client admin granted. Re-engagement requires explicit client consent.

**Archived** - closed engagements retained read-only.

### 2.2 Admin console

Internal admin surfaces cover engagement CRUD, stage templates, commitment editing with the change log, report template CRUD (`ReportTemplateEditor`), document and survey lists, engagement settings (vocabulary map, taxonomy strictness, count caps), onboarding wizard, and a sandbox-requests approval queue (`SandboxRequestsAdmin`).

A distinctive design decision: **every user-facing label renders through an admin-editable vocabulary map** (`st_ai_config.vocabulary_map`). A grant-funded body can relabel "Priorities" as the funder's exact KPI names without a code change. This is what makes one codebase sellable as a strategic-planning tool, a grant-compliance tool, or a governance tool.

### 2.3 Nera

Nera is the AI assistant across the whole product (on Carlorbiz surfaces the assistant is always "Nera"). The engagement-scoped chatbot (`st-nera-query`) retrieves evidence scoped to `source_app='strategic-tool'` and the specific engagement, streams responses over SSE, cites sources, and enforces access tiers (see §2.4). System prompts and provider/model selection load from `st_ai_config` per engagement, so different roles and deployments get differently-tuned assistants over the same corpus.

### 2.4 Demo and sandbox flow (the pilot machine)

Two tiers, both live in the codebase:

- **Tier 1 - public demo** (`/demo`, `DemoEntry.tsx`): a prospect opens the page with no account. The app mints an anonymous Supabase session; database-layer rules (migration `0012_demo_public_access.sql`) grant read-only access to three seeded demo engagements - "Acme Catering Group" (multi-site retail compliance), "National Allied Health Peak Council" (grant-funded peak body), and "Rural Futures Australia". Demo Nera queries are capped at 5 turns per user and 30 per IP per day.
- **Tier 2 - prospect sandbox** (`st-provision-sandbox` + migration `0013_demo_sandbox_and_requests.sql`): a prospect requests extended access; an internal admin approves; the edge function creates (or finds) an auth user, clones a chosen demo into a private sandbox the prospect owns (guarded so only demos can be cloned), and returns a magic link that drops the prospect straight into their sandbox. Sandbox Nera queries are capped at 20 turns.

This converts "can I see it?" into a self-serve pilot with real hands-on time, at near-zero marginal cost and no exposure of client data.

### 2.5 Multi-stakeholder elicitation campaigns (one shared engagement, many respondents)

*Added 7 July 2026, when this pattern was operationalised for the first live client elicitation (Aventine AI). The engine capabilities below are verified against the schema and code; the Aventine campaign is the first production use.*

A third entry path, distinct from the per-prospect sandbox (§2.4). Where the sandbox clones **one engagement per prospect** (right for independent leads evaluating the tool), a strategic-elicitation **campaign** does the inverse: **one shared engagement with many respondents attached to it**, each conducting their own private Nera conversation, with insights aggregated **de-identified** across the cohort. This is how the tool runs a team-wide strategic diagnostic — eliciting mission/vision/point-of-difference/systems-maturity from every member of a client's leadership team and synthesising the anonymous spread of answers into a consultant-grade deliverable.

**Why the engine supports this natively (do NOT clone per user for this case):**

- `ie_conversations` is keyed by `(user_id, engagement_id)` — many users share one engagement while each keeps a separate, private conversation and coverage state. A shared engagement is the container; per-person privacy is preserved.
- `st_user_engagement_roles(user_id, engagement_id, role_id)` is the attach mechanism — inserting N rows with the *same* `engagement_id` places N users under one engagement. This is the key contrast with `st-provision-sandbox`, which mints a *fresh* engagement per user.
- The **authorable elicitation script** lives in `interview_modules` (per-module `system_prompt`, `opener`, `technique_family`, `max_turns`, `fallback_strategy`, `insight_card_format`, coverage dimensions carried by `ie_prompt_library` / `ie_prompt_coverage`) and `interview_campaigns` (binds a module + `campaign_overrides` + surface + `client_scope`). A campaign is therefore a reusable, coverage-gated interview *design* — not per-respondent bespoke work. As of 7 July 2026 the only seeded module is `laddering-v2` (the public-site demo); a client campaign authors its own module.
- Each respondent gets a personal **magic link** landing them on `/e/:engagementId`, where `EngagementNeraChatbot` drives their conversation over the interview engine (select-prompt → extract → evaluate-state → summarise-session), staying live until every required dimension is covered.

**De-identification is the selling point, by design:** respondents authenticate (their email does the access work) so each conversation is theirs and resumable across devices, but the analysis layer discards identity — responses go "into the wash" and Nera surfaces themes, alignment-vs-divergence, and blind spots across the anonymous cohort. No role/seniority tagging in the output.

**Provisioning runbook — one engagement, N respondents:**

1. **Author (or clone) the campaign's `interview_module`** — the elicitation `system_prompt` across the target dimensions, in the Nera voice, coverage-gated.
2. **Create the shared engagement** (`st_engagements`: `client_name`, Nera `branding_overrides`) and wire it to the module/campaign.
3. *(Optional)* **Seed the client's own public materials** into `knowledge_chunks` tagged with a campaign source value, so Nera can gently test answers against what the client publicly claims.
4. **For each respondent email**: create/find the auth user + `user_profiles` row, insert a participant row in `st_user_engagement_roles` against the shared `engagement_id`, and generate a magic link — the same primitives `st-provision-sandbox` uses, **minus the per-user clone**.
5. **Set the campaign's model config.** The Aventine engagement follows the proven feedback-elicitation setup: **Claude for both the conversation and the synthesis** (not the Gemini-for-extraction split used elsewhere), because the elicitation quality is the deliverable.
6. **Aggregate** with `st-synthesise-stage` / `summarise-session` / `st-generate-report`, scoped to the engagement, producing the de-identified cohort synthesis.

**Commercial significance:** this turns the tool from a per-client engagement platform into a **team-wide diagnostic instrument** — the front end of a strategic engagement, and the natural on-ramp to the Carlorbiz B2B digital-transformation evaluation product. A campaign design is reusable across clients by cloning the module and standing up a new engagement.

---

## 3. How it works

### 3.1 Plain-English architecture

The product is a single-page React app hosted on Cloudflare Pages, backed entirely by one Supabase project (PostgreSQL, Auth, Storage, Deno Edge Functions). There is **no separate application server**: the browser talks to Postgres through Supabase's client library (protected by Row Level Security on every table) and to 25 Deno edge functions for anything involving an LLM, file processing, or privileged operations.

All evidence - documents, surveys, interview transcripts, workshop outputs, the deliverable itself - is broken into small self-contained "chunks" stored in the `knowledge_chunks` table, tagged with the engagement and the commitments they relate to. Retrieval works by extracting keywords from the user's question and running **weighted PostgreSQL full-text search** over chunk summaries, text, and section references, with a recency fallback when few matches are found. The pgvector extension is installed in the schema for future semantic (embedding-based) retrieval, but retrieval today is full-text search - no embeddings are generated or stored. Retrieved chunks are handed to the LLM as context, and answers cite their sources.

**AI providers**: the primary model is Anthropic Claude (Sonnet family) for conversation, synthesis, report generation, and drift analysis. Google Gemini (consumer Generative Language API) handles high-volume structured extraction - per-question survey analysis and media processing - because it is fast and cheap for JSON output. Provider and model are selectable **per deployment** via the `st_ai_config` / `ai_config` tables (`llm_provider` = anthropic | google | openai), backed by a shared multi-provider abstraction (`supabase/functions/_shared/llm.ts`). There is **no Google Cloud infrastructure** in this product - no BigQuery, no Vertex AI, no GCS, no Cloud Run. The only Google touchpoints are the Gemini consumer API key and an optional Maps embed key.

### 3.2 Diagram

```
                     ┌─────────────────────────────────────────────┐
                     │            Cloudflare Pages                 │
                     │  React 18 SPA (Vite build)                  │
                     │  + Cloudflare Worker (bot prerender)        │
                     └───────────────┬─────────────────────────────┘
                                     │ HTTPS (supabase-js + fetch/SSE)
                     ┌───────────────▼─────────────────────────────┐
                     │         Supabase (single project)           │
                     │                                             │
                     │  Auth ── magic links, anonymous demo        │
                     │          sessions, magic-link sandboxes     │
                     │                                             │
                     │  Postgres ── 24 st_* tables, 6 ie_* tables, │
                     │    knowledge_chunks (weighted FTS index;    │
                     │    pgvector installed, not yet used),       │
                     │    RLS on every table (~80 policies)        │
                     │                                             │
                     │  Storage ── st-documents, st-surveys,       │
                     │    st-workshop-photos, st-deliverables      │
                     │                                             │
                     │  25 Deno Edge Functions                     │
                     │    st-nera-query        st-generate-report  │
                     │    st-ingest-document   st-drift-watch      │
                     │    st-ingest-survey     st-synthesise-stage │
                     │    st-provision-sandbox interview-engine-*  │
                     │    + shared pipeline fns (pdf, media, url,  │
                     │      insights, summaries, classification)   │
                     └───────┬─────────────────────────┬───────────┘
                             │                         │
                  ┌──────────▼──────────┐   ┌──────────▼──────────┐
                  │  Anthropic API      │   │  Google Gemini API  │
                  │  (Claude Sonnet)    │   │  (Flash - surveys,  │
                  │  primary reasoning  │   │   media analysis)   │
                  └─────────────────────┘   └─────────────────────┘
                  (OpenAI supported as a third provider option
                   in the abstraction layer; not the default)
```

### 3.3 Security and access model

- **RLS everywhere**: all `st_*` tables enforce Row Level Security; the standard pattern is `st_user_has_engagement_access(engagement_id)` for read/write and `st_is_admin()` for delete. Storage buckets are private, authenticated-only.
- **Per-engagement roles**: `st_user_engagement_roles` scopes a user's role to a specific engagement (a user can be admin of one engagement and board member of another). Role definitions live in `st_engagement_roles`.
- **Access tiers in the chatbot**: admin (uncapped) → member (uncapped) → sandbox (20 turns) → demo (5 turns, IP-throttled). Enforced in `st-nera-query`.
- **Hard data policy**: no individual patient information, ever - enforced through terms of service, UI prompts, `contains_pii` survey flagging (blocks verbatim quoting), and generation-time constraints. This keeps the product outside healthcare-grade compliance obligations by design.
- **Auth**: Supabase magic links only; no third-party auth providers; anonymous sessions restricted to read-only demo content at the database layer.

---

## 4. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 18 + TypeScript, Vite 5 | SPA, PWA-capable |
| Styling / UI | Tailwind CSS 4, shadcn/ui on Radix primitives, lucide icons | |
| Routing | wouter | lightweight client-side router |
| Forms / validation | react-hook-form + zod | |
| Content rendering | react-markdown (GFM), react-pdf | PDF viewing in-app |
| Charts | recharts (installed; quantitative dashboards are v1.5+) | |
| Hosting (frontend) | Cloudflare Pages | plus a Cloudflare Worker for bot prerendering (`worker/`) |
| Backend | Supabase: PostgreSQL, Auth (magic link + anonymous), Storage, Edge Functions (Deno) | single project; currently shared with carlorbiz-website (see §8) |
| Retrieval | PostgreSQL weighted full-text search over `knowledge_chunks`; pgvector extension installed for future semantic search | no embeddings generated today |
| AI - primary | Anthropic Claude (Sonnet family) via REST | conversation, synthesis, reports, drift |
| AI - secondary | Google Gemini 2.5 Flash (consumer Generative Language API) | survey per-question analysis, media processing |
| AI - abstraction | `supabase/functions/_shared/llm.ts` | anthropic / google / openai, call + SSE streaming |
| Survey parsing | SheetJS (Deno port) for Excel; native CSV/JSON | |
| Type checking | `tsc --noEmit` (`npm run check`) | no test suite, no CI (see §8) |
| Upstream sync | `scripts/check-upstream-drift.mjs` + `.upstream-sync.yml` | governs the snapshot relationship with carlorbiz-website |

Google Cloud Platform services (BigQuery, Vertex AI, GCS, Cloud Run): **not used**. See §9 for the roadmap items that would introduce Vertex-hosted models.

---

## 5. Deployment and environments

### 5.1 Environment variables (names only)

Frontend (Vite, set at build time / in the Pages project):

| Variable | Required |
|---|---|
| `VITE_SUPABASE_URL` | yes |
| `VITE_SUPABASE_ANON_KEY` | yes |
| `VITE_NERA_API_URL` | yes |
| `VITE_GOOGLE_MAPS_API_KEY` | optional (Map component only) |
| `VITE_CONTACT_WEBHOOK_URL` | optional (contact form webhook) |
| `VITE_LAYER2_WEBHOOK_URL` | optional (lead capture webhook) |

Edge function secrets (set via `supabase secrets set`):

| Variable | Required |
|---|---|
| `ANTHROPIC_API_KEY` | if provider = anthropic (the default) |
| `GOOGLE_API_KEY` | if provider = google, and for survey/media analysis |
| `OPENAI_API_KEY` | if provider = openai |
| `CLIENT_NAME` | yes |
| `ADMIN_NOTIFICATION_EMAIL` | yes |
| `SITE_URL` | recommended (magic-link redirect base for sandbox provisioning) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | injected automatically by Supabase |

### 5.2 What a buyer's IT team does (client-clone procedure)

The full procedure lives in `docs/DEPLOYMENT_GUIDE.md` (per-instance deployment) and `docs/extraction-plan.md` (the mechanical checklist of every table, function, bucket, and policy). Summarised:

1. **Create a Supabase project** (any region; Australian buyers typically choose Sydney).
2. **Run the schema**: base schema files, then `migrations/strategic-tool/0001` through `0013` in order - this creates all `st_*` and `ie_*` tables, enums, ~80 RLS policies, helper functions, triggers, and the four private storage buckets.
3. **Create the admin user** in Supabase Auth and grant the `internal_admin` role.
4. **Configure AI**: insert the `ai_config` / `st_ai_config` rows choosing `llm_provider` and model, and paste the system prompts (profile seed JSON under `supabase/seed/profiles/` provides defaults).
5. **Set edge function secrets** (the API key matching the chosen provider, `CLIENT_NAME`, `ADMIN_NOTIFICATION_EMAIL`, `SITE_URL`).
6. **Deploy the 25 edge functions** with the Supabase CLI (`supabase functions deploy <name>`; sandbox provisioning deploys with `--no-verify-jwt` per the in-repo convention).
7. **Brand the frontend**: CSS custom properties in `client/src/index.css`, logo, title/meta - plus the in-app vocabulary map for domain language.
8. **Build and host the frontend** (`npm run build`) on Cloudflare Pages (or any static host - a `vercel.json` is also present), set the three `VITE_*` variables, and point the client's domain at it.
9. **Verify** against the post-deployment checklist (admin login, Nera answers with citations, document/survey ingestion, report generation, email notifications).

No servers to run, no containers, no cron infrastructure. Ongoing operational surface is one Supabase project and one static-hosting project.

### 5.3 Current environments

- **Production**: Cloudflare Pages deployment (strategy.carlorbiz.com), backed by the shared Carlorbiz Supabase project. Repo notes (last updated 14 April 2026) list "deploy new edge functions to live Supabase" and subdomain DNS as pending items - a buyer's diligence pass should confirm the live function set matches the repo.
- **Local dev**: `.env` from `.env.example`, `npm run dev`.
- **No staging environment** and **no CI pipeline** - builds and deploys are manual (see §8).

---

## 6. Vendor maintenance runbook

### 6.1 Key rotation

- LLM keys (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, optionally `OPENAI_API_KEY`) live only as Supabase edge function secrets. Rotate by issuing a new key at the provider, `supabase secrets set`, and revoking the old key. No redeploy required.
- Supabase anon key is public by design (RLS is the security boundary); the service-role key never leaves Supabase's own secret store. If the service-role key is regenerated, no app change is needed.
- Optional webhook and Maps keys rotate in the Pages environment (requires a frontend rebuild).

### 6.2 Model updates

Provider/model for the main chatbot is database-configurable (`st_ai_config` / `ai_config`). However, **most pipeline functions hardcode model IDs** and a model deprecation requires a code edit + function redeploy. Verified hardcoded IDs as of 3 July 2026:

| Model ID | Where (all under `supabase/functions/`) |
|---|---|
| `claude-sonnet-4-20250514` | st-nera-query (fallback default), st-ingest-document, st-ingest-survey (summary), st-generate-report, st-drift-watch, st-synthesise-stage, interview-engine-select-prompt / -extract / -evaluate-state / -summarise-session, insight-extract, generate-summary, nera-query (default config) |
| `claude-sonnet-4-5-20250929` | feedback-chat, process-pdf, convert-pdf-to-markdown, st-ingest-document (one path) |
| `claude-sonnet-4-6` | generate-insights, regenerate-insights, extract-tab-chunks, ingest-url |
| `claude-haiku-4-5-20251001` | branch-classify |
| `gemini-2.5-flash` | st-ingest-survey (per-question analysis), process-media, st-nera-query (google fallback) |
| `gpt-4o-mini` | st-nera-query (openai fallback) |

Maintenance note: three different Claude Sonnet generations are in service simultaneously. A single shared model-constants module would reduce update surface; today, updating models means grep for the IDs above, edit, and `supabase functions deploy` each touched function.

### 6.3 Supabase / RLS care

- Every new `st_*` table must ship with RLS policies in the same migration - the extraction plan (`docs/extraction-plan.md`) is the living inventory and must be updated the day any object is added.
- Run Supabase's security/performance advisors after schema changes.
- Anonymous sign-ins must remain enabled in Auth settings or the public demo breaks.
- Migrations are plain SQL applied in order; there is no automated migration runner.

### 6.4 Corpus refresh

The corpus grows through normal product use (document upload, survey ingestion, conversations). Failed ingestions surface as `failed` status on `st_documents` / `st_surveys` and can be retried from the admin UI. Original files are preserved in storage for auditability, so re-ingestion is always possible. There is no scheduled re-chunking; chunks are immutable once written.

### 6.5 Drift-watch operation

Drift watch is **button-triggered** from the Living dashboard ("Run Drift Watch"), not scheduled - there are no cron jobs anywhere in the deployment. The vendor (or client admin) runs it before board cycles or on a cadence they choose. Scheduled execution (Supabase cron / pg_cron invoking `st-drift-watch`) is a straightforward future addition; the vision document specifies daily/weekly/monthly per-engagement schedules as the target state.

### 6.6 Cost drivers per deployment (estimates, monthly)

| Item | Estimate | Notes |
|---|---|---|
| Supabase Pro | US$25 (~A$38) | recommended tier for a production client |
| Cloudflare Pages | $0 | free tier is sufficient for a single-org tool |
| Anthropic API | ~US$5-50 typical | Sonnet-class pricing; driven by report generation, drift runs, stage synthesis, and chat volume. A single quarterly report or drift run costs cents to low dollars; heavy interview phases spike usage |
| Gemini API | ~US$1-10 | Flash pricing is very low; ~40 calls per survey ingestion |
| Domain / DNS | nominal | client's own domain |
| **Total** | **roughly A$50-150/month** for a normally-active deployment | usage-dependent; caps can be enforced by provider-side spend limits |

These are estimates, not measured production figures - there is no production usage history yet.

---

## 7. Commercial readiness

**Model**: single tenant per deployment. Each client (or each consultant licensee) runs their own Supabase project + Pages project and owns it. No subscriptions, no billing infrastructure, no obligation on the vendor to operate N tenants - this is a deliberate, documented decision (`docs/living-platform-vision.md` §14-15), and the codebase matches it (owner-scoped access via `created_by` and per-engagement roles, not organisation-level tenancy).

**What selling one deployment requires, end to end**:

1. Prospect enters through the public demo (zero-touch) and requests extended access.
2. Admin approves in `SandboxRequestsAdmin`; `st-provision-sandbox` clones a demo into the prospect's private sandbox and emails a magic link - the pilot runs itself, capped at 20 Nera turns.
3. On signature, provision the client's own infrastructure per §5.2 (approximately a day of technical work for a competent operator, mostly mechanical, fully documented).
4. Run the engagement (Draft → Active → Delivered), which simultaneously delivers the consulting outcome and seeds the client's living corpus.
5. Hand over: role flip, consultant access revoked, client owns everything. Optional maintenance retainer is a separate contract.

**Revenue shape**: high-value engagement fee (~$30k AUD target) + optional maintenance retainer + future consultant licensing (the extraction plan exists specifically to make per-licensee standalone projects mechanical).

**Assets that de-risk a sale**: three seeded demo engagements grounded in the founder's two CEO tenures; the sandbox pipeline; the deployment guide; the extraction plan; the vocabulary-map pattern that lets the same build be pitched as strategic-planning, grant-compliance, or governance tooling.

---

## 8. Known gaps and risks (honest register)

1. **No hard multi-tenancy.** There is no `org_id` isolation layer; access is scoped by engagement roles and `created_by` within a single-organisation deployment. This is consistent with the single-tenant-per-deployment model, but it means the product cannot be operated as shared SaaS without schema work.
2. **Shared Supabase project pending extraction.** Production currently shares project `lgcmjneodjrtjtwbomsj` with carlorbiz-website (a cost decision, documented in `docs/supabase-strategy.md`). The `st_*` prefix discipline and `docs/extraction-plan.md` make the lift-out mechanical, but it has not been executed. A buyer verifying infrastructure independence should expect extraction as a pre-sale or completion step. A cross-product RLS bug in the shared project is a real (mitigated, tested-policy) risk until then.
3. **Retrieval is full-text search, not semantic.** pgvector is installed but unused; no embeddings exist. FTS with keyword extraction works well on this corpus size but will miss paraphrase matches. Semantic retrieval is roadmap (§9), not current capability - any collateral claiming "vector search" today would be inaccurate.
4. **Pending features** (per repo state, last updated 14 April 2026): pulse-check system (`st-run-pulse` recurring conversational check-ins - designed, not built), engagement-creation wizard, deployment of the newest edge functions to the live Supabase project, subdomain DNS completion, and seeding the Board Pre-Read template into the live database.
5. **No CI pipeline and no automated tests.** Type-checking (`tsc --noEmit`) is the only automated gate; builds and edge-function deploys are manual CLI steps. For a ~$30k engagement product this is survivable; for licensing to other consultants it is the first infrastructure investment to make.
6. **Drift watch is manual.** Button-triggered only; the "scheduled" behaviour described in the vision is not yet wired (no cron).
7. **Hardcoded, inconsistent model IDs** across 25 edge functions (three Sonnet generations concurrently - see §6.2). Deprecation of any one model ID requires a multi-file edit and redeploy.
8. **No customers yet.** The product has demo data and the founder's own engagements as proving ground, but zero external production deployments and therefore no reference customers, no measured cost baselines, and no churn/retention evidence.
9. **Key-person dependency.** The methodology, prompts, and delivery capability currently live with one person. The profile pattern and documentation reduce this, but a licensing motion needs playbooks beyond the codebase.
10. **Single-user editing.** No real-time collaboration; concurrent admin edits are out of scope by design (v1 constraint).

---

## 9. Roadmap

Near-term (already specified in repo docs, not yet built):

- **Pulse-check system** - `st-run-pulse` scheduled conversational check-ins with initiative owners via magic-link Nera conversations, synthesised into drift-watch reports (designed in `docs/living-platform-vision.md` §9; six-weekly default cadence).
- **Engagement-creation wizard** - guided setup replacing manual draft configuration.
- **Scheduled drift watch** - cron-triggered `st-drift-watch` per engagement configuration, replacing the manual button.
- **Live-environment completion** - deploy newest edge functions, finish subdomain DNS, seed live report templates.
- **Standalone Supabase extraction** - execute `docs/extraction-plan.md` when the first licensee or infrastructure-verification demand arrives.
- **Merge-watcher** (`st-merge-watcher`) - scheduled semantic-similarity suggestions for redundant commitments (specified; depends on scheduled execution and better similarity tooling).
- **CI + smoke tests** - minimum viable pipeline before any consultant licensing.

Clearly-labelled FUTURE work (not present in this product today):

- **Semantic retrieval** - generate embeddings for `knowledge_chunks` and query via the already-installed pgvector extension, upgrading retrieval from keyword FTS to hybrid semantic search.
- **Nera knowledge-lake integration** - the owner operates a separate, Google-native cross-domain knowledge system (BigQuery + GCS, the "Nera lake"). Today the only connection is a one-way copy: carlorbiz content chunks were exported into that lake. This tool does not query the lake, and no lake infrastructure is part of any client deployment. A future integration could let the consultant-side instance draw on cross-domain methodology retrieval; it would be an addition to the vendor's own deployment, not the client's.
- **Vertex-hosted model migration** - if a client's procurement requires Google-stack AI, the multi-provider abstraction (`_shared/llm.ts`) makes adding a Vertex AI-hosted Claude or Gemini endpoint a contained change. This is a roadmap option, not current architecture: today the product calls the Anthropic and Google consumer/developer APIs directly.
- **External integrations** (SharePoint, Google Drive, ClickUp), live video transcription, quantitative dashboards, automated funder submission - all explicitly deferred in the vision document (v2+).

---

*Prepared from direct codebase inspection on 3 July 2026. Key sources: `docs/living-platform-vision.md` (product vision and resolved design decisions), `docs/extraction-plan.md` (complete infrastructure inventory), `docs/DEPLOYMENT_GUIDE.md` (clone procedure), `docs/supabase-strategy.md` (shared-project rationale), `CLAUDE.md` (build status), and the `supabase/functions/`, `migrations/strategic-tool/`, and `client/src/` trees.*
