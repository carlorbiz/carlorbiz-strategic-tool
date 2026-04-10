# Living Platform Vision

**Status**: reference document. Supersedes the narrower framing in [docs/migration-brief.md](migration-brief.md), which describes the consulting engagement arc (discovery → workshop → deliverable) as if that were the whole product. It is not. The engagement arc is the *onboarding path* into the actual product, which is a long-running evidence platform.

**Last updated**: 2026-04-11. Living document — update as the model sharpens.

---

## 1. One-paragraph product

A conversational evidence platform for small organisations with heavy structured accountability obligations. The organisation sets up a small number of fixed commitments — the priorities of a strategic plan, the KPIs of a grant agreement, the standards of an accreditation framework, the governance obligations of a board — and every document, survey, and meeting note they produce lands against those commitments. Nera, the AI assistant already built in the carlorbiz-website stack, reads everything, answers questions from the accumulated corpus, generates funder-ready reports on demand, and quietly watches for drift between what was committed and what's actually happening. Boards get clarity, CEOs get time back, funders get better reports, and the organisation develops a semantic memory that grows more valuable every year.

The consulting engagement (discovery interviews → workshops → deliverable) remains part of the offering, but as a premium onboarding path for customers who need help establishing the initial commitment taxonomy. Customers who already have clean commitments — a signed grant agreement, a published accreditation standard, an existing strategic plan — can onboard themselves through the admin panel without ever engaging Carla as a consultant.

## 2. Product framing

**Primary target**: small organisations with heavy structured accountability obligations. The common shape is a tiny permanent team (often a single-digit headcount, sometimes the CEO plus a part-time bookkeeper) running something much bigger than their headcount suggests — multi-site operations, multi-million-dollar grant agreements, multiple funders, a volunteer or oversized board, and a compliance load that could break a larger team. Healthcare is the most obvious vertical but the shape is not healthcare-specific.

**Lived proof points from Carla's own career**:

- **Zouki** — CEO of a company running 135 small retail and café outlets across Australia, all inside hospital government contracts. Governance and compliance for 135 separate small businesses with one CEO, no assistant, three directors, and a couple of accountants. The team wore ten hats each. A tool like this would have been transformational.
- **GPSA** — CEO of a national healthcare peak body. Sole full-time employee for the first 18 months, later a team of 5 FTE made up of many part-timers. A $3M government grant with full reporting obligations, a voluntary board larger than the staff, stakeholder reporting across all levels of government. The tool would have made the role sustainable.

Both contexts — retail-in-healthcare and healthcare-peak-body — had the same structural shape: small permanent team, large accountability surface, heavy cyclical reporting, documents flowing in and out daily, no one with time to synthesise any of it. The tool is designed for that shape. The vertical is secondary.

**Positioning**: we look like a strategic planning tool to strategic planning buyers, a compliance tool to grant administrators, a governance tool to board chairs, and an operations-sanity tool to overloaded CEOs. One codebase, one database schema, four marketing stories. This is achieved through the profile pattern (§11) — not through four products.

**Vertical focus in marketing, horizontal architecture**: we pitch one profile at a time to one buyer type at a time. Healthcare is the likely first vertical because it's where Carla has strongest credibility and the pain is most acute. But the architecture imposes no vertical limit, and the worked examples above make it clear the pattern applies to any small org with heavy obligations — arts councils, community legal centres, small education providers, faith-based charities, franchise operators in regulated sectors, peak bodies of any kind, consortia, cooperatives, not-for-profits.

## 3. The two phases

### Phase A — Engagement (the existing brief)

This is the arc already captured in [docs/migration-brief.md](migration-brief.md). Discovery interviews with stakeholders via Nera-conversation, workshops with novel inputs (QR code photo uploads, OCR'd sticky notes, live decision capture), cumulative stage-by-stage insight synthesis, and a polished deliverable.

The deliverable is no longer the end state. At the end of Phase A, the deliverable composer **writes the commitments** (Priorities / KPIs / standards, depending on the profile) into `st_commitments` as the starting taxonomy. Every stakeholder interview transcript, workshop decision, photo, and supporting document has already been auto-chunked into `knowledge_chunks` (scoped to the engagement) during the Phase A stages. Nera already knows the organisation's context in depth. The handover into Phase B is a status transition, not a content transfer — the knowledge is already in place.

Consultants who sell this product can run Phase A themselves. Carla does. Other consultants would buy a licence (eventual commercial path, deferred).

### Phase B — Living

This is the new product surface. Once an engagement transitions to `living` status:

- The admin user uploads documents as the organisation produces them (board papers, CEO reports, policies, committee minutes, external correspondence, grant variations, audit reports).
- Each document is chunked into `knowledge_chunks` and filed against one or more commitments via `st_commitment_document_links`.
- Nera runs drift-watch on a schedule, noting imbalances, silences, and unjustified movement.
- Users ask Nera questions about the accumulated corpus, in any of four modes (ask, brief, drift-watch, update — §7).
- Periodic surveys are ingested (Excel, CSV, JSON) and synthesised into evidence.
- Reports are generated on demand against funder/regulator templates.
- Nera reaches out proactively for conversational updates from initiative owners.
- Taxonomy changes are captured in a permanent change log with justification.

Phase B is open-ended. There is no end state. The value accumulates. Switching costs become real as the corpus grows.

The board-facing dashboard (§9), reporting cycle (§10), and commitment taxonomy discipline (§6) are the three things a Phase B customer actually pays for.

## 4. Conceptual model

Four core concepts:

**Commitments** (§6) is the abstract concept name and the technical table name (`st_commitments`). The vocabulary the user sees is configurable per deployment via the profile pattern (§11). The default vocabulary for the `strategic-planning` profile is **Priority** (top level) → **Initiative** (sub-level) → **Lens** (cross-cutting tag). Other profiles use other words: a `grant-reporting` deployment talks about KPIs and evidence items; an `accreditation` deployment talks about standards and compliance evidence. The data model is the same; only the labels change.

**Evidence**. Anything that counts as input — a document, a survey result, a meeting note, a Nera-conversation transcript, a photo from a workshop. Evidence attaches to commitments via many-to-many linking. All evidence is chunked into `knowledge_chunks` so Nera can retrieve across the entire corpus at once.

**Drift**. The gap between what was committed and what's actually happening. Nera watches for drift through scheduled analysis (§8). Drift isn't always bad — the organisation's context changes and the plan should sometimes change too — but drift should never be invisible.

**Reports**. The output. On-demand narrative synthesis of the accumulated evidence against a reporting template. Board pre-reads, quarterly funder reports, accreditation submissions, annual general meeting papers, grant variation requests. All produced by Nera from the existing corpus, with every claim cited to its source document.

## 5. Knowledge chunking as the engine

This is the architectural keystone and it is the answer to why this tool is fundamentally different from every document management system, every project tracker, every compliance platform the customer might have looked at.

The organisation does not work *inside* this tool. They continue to use whatever they currently use — SharePoint, OneDrive, Google Drive, ClickUp, Word, Excel, email. When they produce a document in their normal workflow, they upload a copy to this tool. That's the only work the tool asks of them. Everything else is derived.

Once uploaded, every document flows through the chunking pipeline already built in carlorbiz-website and ACRRM PWA:

- PDF → markdown (via the existing `convert-pdf-to-markdown` edge function)
- Markdown → chunks (via the existing `extract-tab-chunks` edge function pattern, generalised into a strategic-tool sibling)
- Chunks → `knowledge_chunks` table with metadata (document source, page range, commitment links, source type, engagement id)
- Chunks → embeddings for retrieval (via whatever embedding model `ai_config` is configured to use)

From that point on, every capability in the tool is just RAG plus LLM calls over the accumulated corpus. Ask mode is RAG + streaming chat. Brief mode is RAG + structured output. Drift watch is scheduled RAG + narrative synthesis. Report generation is RAG + template-constrained generation.

**We are not building new infrastructure**. We are re-pointing infrastructure that already exists, battle-tested, in the carlorbiz-website Supabase project. The marginal cost to strategic-tool is the data modelling, the admin surfaces, the commitment taxonomy logic, the survey ingestion, and a couple of strategic-tool-specific edge functions. Everything else is reuse.

**Scoping knowledge_chunks**: per the decision in [docs/supabase-strategy.md](supabase-strategy.md), strategic-tool shares the carlorbiz-website Supabase project. To isolate strategic-tool chunks from carlorbiz-website content, `knowledge_chunks` gains two columns: `source_app TEXT` and `engagement_id UUID NULL`. Strategic-tool queries always filter by both. Carlorbiz-website queries remain unchanged (both columns nullable for their existing rows). RLS policies enforce the boundary.

## 6. The commitment taxonomy and the justification mechanism

### Structure

A single self-referencing tree table `st_commitments`:

- `id` (uuid)
- `engagement_id` (fk)
- `parent_id` (nullable self-fk)
- `kind` — `top` / `sub` / `cross_cut` (the structural shape — the `strategic-planning` profile labels these as Priority / Initiative / Lens, but the table column stays profile-agnostic)
- `title`, `description`, `success_signal`
- `status` — `active` / `archived` / `merged_into`
- `merged_into_id` (nullable self-fk; used when Nera's merge-watcher recommends combining two commitments)
- `created_at`, `archived_at`, `order_index`
- `justification_log_id` (fk to the change log entry that created it, if not part of the original taxonomy)

**Cross-cuts** (Lenses, in the `strategic-planning` profile) are not hierarchical — they're a separate `kind` with no parent, used as cross-cutting tags. They sit alongside the Priority/Initiative hierarchy. See §8 for how Nera uses them.

### Count guidance (Priorities — top-level commitments)

- **Recommended**: 3–5 Priorities. Three is optimal. Five is doable.
- **Soft warning**: 6 Priorities. Nera flags but does not block.
- **Hard cap**: 7 Priorities. Above 7, the admin cannot create a new Priority without **archiving an existing one**. This is the "replacement rule" — it's not a total number, it's a live number.
- **Justification loophole**: the admin can override the hard cap through a structured Nera-conversation that requires explicit sign-off (and, if configured, board ratification). This creates a change-log entry flagged `count_cap_overridden` so auditors can find it.

These numbers are defaults in the profile (§11) and can be edited in the admin panel. Some customers will want tighter limits, others will want looser. The software enforces what the customer configures.

### Justification strictness — configurable per engagement

The strictness of the justification flow when a new Priority is created is **itself a per-engagement configuration setting**, not a hardcoded product rule. Three levels:

- **Soft** (default): any admin can create a new commitment by talking to Nera for ~30 seconds. Justification is logged. No external sign-off required. Suitable for mature, self-managing orgs with high trust, or for the back half of a three-year strategic plan when the organisation has grown into the tool.
- **Medium**: new commitments require a justification transcript that Nera reviews against the existing plan for fit and duplication. Nera can push back and ask the admin to reconsider. Once approved by Nera's check, the commitment is created. A draft board paper is generated for noting (not for approval) at the next meeting.
- **Hard**: new commitments cannot be created directly. They can only be drafted for board ratification. A designated board chair role must formally ratify them before they become live. Draft state is visible in the admin panel but not in the main dashboard.

The setting lives in `st_engagements.taxonomy_strictness` and can be changed at any time by an admin or facilitator. Common pattern: hard for the first year of a new plan (disciplined roll-out), soft for the subsequent two years (operational reality), hard again when a new CEO starts or a strategic plan refresh begins.

### Scope extensions — medium weight

When a document is being filed and the admin selects an existing Priority/Initiative but notes "this slightly extends the scope to include X", the tool captures a structured `st_scope_extension` entry:

- `commitment_id` (what was extended)
- `category` — `clarification` / `expansion` / `reinterpretation` / `correction` (required)
- `narrative` (required, short)
- `triggering_document_id` (optional link to the document that prompted this)
- `created_at`, `created_by`

Nera tracks accumulation. If a single commitment receives 5+ scope extensions in a rolling 6-month window, it's flagged in the drift-watch report: *"R3 has accumulated significant scope extension. Its current operational reality may have drifted materially from its founding definition. Recommend a review conversation with the owner, and consider whether the commitment should be rewritten, split, or archived."*

### The merge-watcher

A subtle but important feature. When the admin creates a new Priority or Initiative, Nera does **not** immediately check for duplication against existing ones — that's too aggressive and prevents legitimate nuance from emerging. Instead, Nera watches the new commitment for the first 30–60 days after creation.

If the evidence flowing into the new commitment looks semantically very similar to the evidence flowing into an existing commitment, Nera raises a merge suggestion: *"The content you've been filing under the new Priority 'Digital transformation readiness' over the last six weeks looks ~84% semantically similar to content filed under the existing Priority 'Operational modernisation'. Consider whether these should be merged. If you meant them to be distinct, I'll stop asking — but you might want to sharpen the boundary between them in both Priority descriptions."*

The admin can accept the merge (Nera handles the migration, updates the change log, marks the merged Priority with `merged_into_id`), reject the merge (Nera stops asking for that pair), or defer (Nera re-asks in 30 days). This is the mechanism that prevents taxonomy bloat from well-meaning but redundant additions.

### The change log

All taxonomy changes write to `st_commitment_change_log`:

- Creation, modification, archival, merge
- Scope extensions (logged here and in `st_scope_extensions`, with the scope extension record being the source of truth)
- Count cap overrides
- Justification strictness changes
- Full narrative from the Nera-conversation that justified the change
- Optional ratification document id and ratification status

This log is the single most valuable artefact in the tool from a long-term governance perspective. At the next strategic plan refresh, the incoming consultant has a ready-made history of every strategic pivot with rationale. Interview prep is done. Discovery is faster. The refresh engagement is sharper because the tool has been keeping a diary.

## 7. Nera's four modes in living phase

### Ask

The existing Nera chatbot, unchanged. User asks a question, Nera answers from the chunked corpus. Every answer cites its sources. Already built.

### Brief

User clicks "brief me" on an upcoming meeting (board meeting, committee meeting, funder catch-up) or drops tomorrow's board pack in. Nera reads it, cross-references the corpus, and produces a structured pre-read:

- Items in the pack that touch current commitments
- Related prior decisions
- Inconsistencies or tensions with current commitments or recent decisions
- Recommended questions to raise
- Anything new that might warrant a scope extension or a new commitment

This is the killer feature for time-poor directors and it is almost entirely reusable from the existing `generate-insights` edge function pattern.

### Drift watch

Scheduled. Runs daily, weekly, or monthly per engagement configuration. Analyses the corpus and writes a narrative report to `st_drift_reports`. Report content:

- Mention frequency per commitment over the reporting window
- Commitments that have gone silent (no documents, no mentions, no updates for N days)
- Commitments with accelerating scope extensions
- Document-to-commitment distribution imbalances
- Merge-watcher suggestions
- New themes in recent documents that don't map cleanly to any existing commitment
- Unjustified drift attempts (abandoned new-commitment flows)

The report lands in the admin's dashboard and optionally via email or Notion. The admin triages, takes action, or dismisses with reasons (which Nera learns from).

### Update

Instead of a form, the admin or an initiative owner talks to Nera. "We decided in the meeting on Tuesday to extend the Bendigo pilot by six months because of the credentialing delay. Update the plan." Nera captures this as a structured update, identifies which commitment it maps to via RAG over the commitment titles and descriptions, stores it as an `st_initiative_update` linked to the commitment, and optionally files it as a document summary. The admin approves or edits. No forms.

Update mode is also the entry point for scope extensions — Nera recognises when an update is describing new scope and offers to log it as a scope extension with a category and narrative.

## 7a. Multi-role access against a shared corpus

A single deployment serves one organisation, but one organisation has multiple audiences who each need a different lens on the same underlying content. This is a first-class capability, not an afterthought.

### The problem

In the lived examples (§2): the Zouki board saw the same business as the CEO did, but needed a different lens (strategic risk across 135 outlets, aggregate compliance status, fiduciary concerns). The GPSA board and CEO had the same grant obligations but needed different views — the CEO needed operational tracking and drafting help, the board needed governance assurance that nothing was drifting. Funders needed yet another view — narrative reporting against agreed KPIs. Staff needed a fourth view — "what am I supposed to be doing and against which commitment".

If the tool makes each audience feel they're getting a purpose-built experience, adoption is easy. If it makes everyone fight through a single admin panel designed for someone else, adoption fails.

### The mechanism

One engagement, one document corpus, multiple **role-scoped views** on top. Implemented through three mechanisms working together:

**1. Roles and permissions (via existing carlorbiz-website RBAC, extended)**. Roles are attached to `user_profiles` and scoped per engagement: `internal_admin`, `facilitator`, `client_admin`, `ceo`, `board_chair`, `board_member`, `committee_member`, `operational_lead`, `external_stakeholder`. Each role has read/write/admin scopes on each resource type. The role model is stored in the engagement configuration and editable by the client admin.

**2. Role-scoped dashboards**. Each role gets its own default landing view. CEO sees operational slipstream, drift alerts, and report drafting shortcuts. Board chair sees strategic status, drift narratives, and pre-read generator. Board member sees the strategic dashboard in read-only mode with their own annotations layer. Operational leads see only the commitments they own, with a simplified update interface. These are views over the same data, not separate copies.

**3. Role-scoped Nera prompts**. The same nera-query function is called, but the system prompt is specialised per role. Board-chair-Nera is deliberately more formal, governance-aware, cautious about financial claims, and explicit about citation. CEO-Nera is more candid about drift, more willing to speculate under uncertainty, more oriented to next-action framing. Operational-Nera is scoped to the commitments the user owns and avoids commenting on strategy-level decisions. These prompts are profile-driven (§11) and admin-editable.

### Multi-profile per engagement

A single engagement can activate multiple profiles simultaneously. A GPSA-style deployment might activate:

- `strategic-planning` profile for the board-facing dashboard
- `grant-reporting` profile for the CEO-facing funder-report surface
- `governance` profile for the board chair's committee oversight

All three profiles share the same commitment taxonomy and the same knowledge corpus. They differ in vocabulary, default Nera prompts, reporting templates, and dashboard widgets. A user's active profile is determined by their role and can be switched manually if the user has multiple roles.

This is the mechanism that lets one $3M grant-funded peak body serve the CEO, the board, the funder, and the staff from one deployment without anyone feeling they're using the wrong tool.

### Schema implications

- `st_engagement_profiles` — many-to-many between engagements and profile keys, with a flag for which profile is each role's default
- `st_engagement_roles` — per-engagement role definitions, extending the base roles with client-specific labels
- `user_engagement_roles` — join table scoping user roles to specific engagements (a user can be admin of one engagement and board-member of another)
- Existing `user_profiles` gains no new columns — all engagement-specific role data lives in the join tables, keeping the shared carlorbiz-website user model clean

## 8. Cross-cutting insights (Lenses)

Lenses are the non-hierarchical layer of the taxonomy. They emerged from a real strategic plan deliverable where "pilot communities", "financial strategy", and "implementation timeline" weren't Priorities — they were cross-cutting views that applied across all Priorities. They remain first-class in the model because they are where the most valuable insights come from during Phase A workshops and survey analysis.

A Lens is just a commitment with `kind='cross_cut'` and `parent_id=NULL`. Documents and evidence can be tagged with Lenses in addition to (not instead of) Priorities/Initiatives. Lenses carry their own descriptions and success signals but no hierarchical children.

### Why Lenses belong in Nera's insights

The cross-referencing value comes from Nera looking at chunks through multiple axes at once. *"Tell me everything in the corpus that touches the financial-strategy Lens AND is tagged against the rural-health-coalition Priority"* is a qualitatively different query than single-axis retrieval. It surfaces tensions, overlaps, and opportunities that no hierarchical structure alone can reveal. Nera's drift-watch and brief modes should both query across Lenses by default.

### Per-engagement governance

The taxonomy — including Lenses — is **per-engagement**. Every engagement defines its own commitments. `knowledge_chunks` must support per-engagement filtering and per-engagement commitment linking so that cross-cutting insights are scoped correctly. The `engagement_id` column on `knowledge_chunks` (mentioned in §5) is the enforcement mechanism. A strategic-tool query against `knowledge_chunks` is always predicated on `engagement_id = X` plus the commitment filter.

Lenses are also configurable in the admin panel. Admins can add, rename, or archive them without triggering the Priority-count cap. Lenses are lightweight metadata and Nera uses them aggressively; the customer should be able to evolve them freely.

## 9. Three input streams

### Documents

The primary stream. Drag-and-drop upload in the admin panel. Supports PDF, Word, Markdown, plain text, and images (which route through OCR). Each upload asks the admin to select a primary Priority/Initiative and optionally additional Priority/Initiative and Lens tags. A scope-extension note can be added inline. The file is stored in `st-documents` bucket, the chunking pipeline runs, chunks land in `knowledge_chunks` with appropriate metadata, and Nera generates a one-sentence summary for the document list view.

### Surveys

See §10 — surveys deserve their own section because they are a major capability.

### Conversations (Nera-conducted)

The pulse check mechanism. Admin or consultant configures a recurring conversation template — e.g. *"every six weeks, invite these three clinical leads to answer five short questions via Nera about their initiatives"*. The scheduled function `st-run-pulse` emails magic-link invites, each participant walks through a scripted Nera-conversation (streaming, multi-turn, same pattern as the engagement-phase stakeholder interviews), and transcripts are stored, chunked, and linked to relevant commitments.

Pulse results are synthesised into a short narrative summary that lands in the drift-watch report and optionally triggers proactive alerts — "three of the four clinical leads mentioned credentialing delays in this cycle when none did last cycle; worth a conversation."

## 10. Survey ingestion pipeline

The highest-value single capability in the living platform for small healthcare orgs that receive grant funding.

### Target inputs

- **Excel** (`.xlsx`, `.xls`) — the common export format from SurveyMonkey, Qualtrics, Microsoft Forms, Google Forms
- **CSV** (`.csv`) — universal fallback
- **JSON** (`.json`) — for power users, admins running automated pipelines, and tests

### Pipeline

1. Admin uploads via the admin panel. Assigns survey metadata: name, period, linked commitments, response-count estimate, reporting obligation (which funder/regulator it's for).
2. File lands in `st-surveys` storage bucket with a row in `st_surveys` table (status: `ingesting`).
3. Edge function `st-ingest-survey` is invoked. It fetches the file, detects the format, and uses the SheetJS Deno port for `.xlsx`/`.xls`, native CSV parsing for `.csv`, and direct JSON parsing for `.json`.
4. Normalises into an internal structure: `{ survey_id, sheets: [{ sheet_name, columns: [{header, type}], rows: [{col1: val1, ...}] }] }`.
5. Writes normalised rows to `st_survey_responses` (one row per respondent per question), preserving the original file in storage for auditability.
6. For each column (question), runs a Nera pass: sentiment breakdown, theme extraction, notable verbatim quotes, response rate. Writes per-question summary to `st_survey_question_summaries`.
7. For the whole survey, runs a higher-order Nera pass: cross-cutting themes, which commitments the results speak to, which results suggest drift, standout findings. Writes to `st_surveys.overall_summary`.
8. Writes chunks to `knowledge_chunks` with `source_type='survey'`, `survey_id=X`, commitment links, and citation metadata that can trace back to specific rows/columns in the original file.
9. Updates `st_surveys.status` to `ingested`. The admin is notified.

Once ingested, survey content is part of the same RAG corpus as documents and conversations. Nera answers *"what did the 2026 staff survey say about our clinical governance commitments?"* with citations to specific rows.

### Caveats for Excel specifically

- **Merged cells** are handled by SheetJS but Nera is instructed to treat merged headers as hierarchical.
- **Multi-sheet workbooks** with inconsistent structures: each sheet is treated as a section by default, with admin override to designate a canonical sheet.
- **Formulas** — SheetJS reads the computed result, not the formula, which is usually what's wanted.
- **File size** — Supabase Edge Functions have a ~256 MB memory limit. A 10,000-response survey export can reach 20 MB, which is fine. Larger surveys are a v2 concern.
- **Response privacy** — surveys sometimes contain identifying information. The admin panel asks at upload time whether the survey is de-identified, and if not, flags the survey with a `contains_pii` boolean that restricts which Nera modes can quote verbatim responses.

### Between-survey pulse checks

Surveys are formal and infrequent. Between them, the pulse check mechanism in §9 runs lighter-weight Nera-conversations that generate complementary evidence. The two streams — formal surveys and conversational pulses — are synthesised together in drift-watch reports and in quarterly funder reports.

## 11. The profile pattern

A deployment is instantiated with a **profile** that preconfigures everything the admin could otherwise set manually. Profiles ship as JSON bundles in `supabase/seed/profiles/` and are loaded into `st_ai_config` and related configuration tables when a new engagement is created.

### What a profile contains

- **Vocabulary map** — `{ "commitment_top_singular": "Priority", "commitment_top_plural": "Priorities", "commitment_sub_singular": "Initiative", "commitment_sub_plural": "Initiatives", "cross_cut_singular": "Lens", "cross_cut_plural": "Lenses", "commitment_add_verb": "introduce", "commitment_archive_verb": "retire", "evidence_singular": "document", ... }` — **every user-facing heading and placeholder in the UI renders through this map**. The strategic-planning profile defaults to Priority/Initiative/Lens; other profiles ship their own defaults.
- **Default Nera prompts** for each conversation mode (engagement interview, workshop facilitation, pulse check, drift watch, brief generation, report generation), tuned to the profile's context
- **Default drift-watch configuration** — schedule, thresholds (silence window, scope-extension count trigger, merge-watcher similarity threshold), delivery method
- **Default reporting templates** — starter templates in the profile's conventional format (board pre-read, funder quarterly, accreditation submission)
- **Default dashboard layout** — widget selection and order
- **Default taxonomy seed** — optional pre-populated commitments for standardised frameworks (e.g. a PHN contract profile might ship with the five standard PHN KPIs)
- **Default top-level commitment count limits** — recommended range, soft warning, hard cap
- **Default justification strictness**

### Profiles we'll ship

- `strategic-planning` — the original use case. Vocabulary: Priorities, Initiatives, Lenses, board papers, drift, strategic plan. Default strictness: soft. Priority range 3–5, hard cap 7. Default pulse cadence: 6 weeks.
- `grant-reporting` — for PHN contracts, state health agreements, federal grants. Vocabulary: KPIs, evidence items, funder reports, variations. Default strictness: hard (funders hate scope creep). KPI count pre-set by the funder; the cap doesn't apply.
- `governance` — for board chairs. Vocabulary: commitments, policies, decisions, reviews. Default strictness: configurable per governance committee.
- `accreditation` (future) — for RACGP, AGPAL, ISO. Vocabulary: standards, compliance evidence, audit items, corrective actions. Default strictness: hard.

### Admin-editable vocabulary

**Critical user requirement**: the vocabulary map is not set-and-forget. The admin panel exposes the entire vocabulary map as an editable form in the theme/branding section. An admin can change every user-facing heading and placeholder in their deployment without a code change. The profile sets sensible defaults; the admin customises for their organisation's own language. A healthcare co-op might prefer "strategic themes" over "Priorities". A grant-funded org might use the funder's exact KPI names. A board chair might want "commitments" instead of "Initiatives". All of this is admin-editable through the existing CMSContext pattern from carlorbiz-website, extended to cover the vocabulary map as a first-class theme setting.

This is the single most important UX decision in the whole product. It transforms the tool from "Carla's template with her preferred vocabulary" into "the customer's own governance instrument, in their own language". It costs us almost nothing to implement (the CSS theme pattern from carlorbiz-website is already admin-editable — we just extend the same form with additional fields).

## 12. Reporting cycle (the commercial closer)

On-demand funder-ready reports. Every grant has a reporting template; most small orgs spend 10–40 hours each quarter wrestling evidence into the funder's format. This tool generates the draft in 60 seconds.

### Mechanism

- `st_reporting_templates` table stores templates as structured markdown with section placeholders and instructions
- Admin selects a template and a reporting period
- Edge function `st-generate-report` fetches all relevant evidence (filtered by engagement, commitments, time window), retrieves relevant chunks, and generates the narrative section-by-section constrained by the template
- Every claim in the draft is cited to its source (document, survey, conversation transcript)
- Output is written to `st_compliance_reports` with status `draft`
- Admin reviews in a side-by-side editor (draft on the left, source chunks on the right), edits inline, approves
- Approved reports are exported as PDF or Word, sent to the funder, and logged with delivery metadata
- Nera learns from admin edits over time — phrases the admin consistently removes, added emphases, preferred framings

### Templates ship with profiles

A `grant-reporting` deployment starts with a starter template for the funder type (PHN quarterly, state health agreement annual, etc.). Admins customise, save their versions, and build a template library over time. Templates are editable in the admin panel.

## 13. Schema implications for phase 1

The phase 1 schema migration (`migrations/strategic-tool/0001_init.sql`) must establish the foundation for the full living platform, even though only a subset of surfaces will be built first. The structure needs to be right; the surfaces can ship progressively.

### Tables to create

- `st_engagements` (with status enum `draft|active|delivered|living|archived`, type enum `strategic_planning|grant_reporting|governance|accreditation`, `profile_key`, `taxonomy_strictness`, `top_count_warning`, `top_count_hard_cap`, `pulse_cadence_days`)
- `st_engagement_stages` (editable templates, recurring, with `is_recurring`, `recurrence_pattern`)
- `st_stage_participants`
- `st_stakeholder_inputs` (Nera-conversation transcripts, auto-chunked)
- `st_workshop_decisions`, `st_workshop_photos`, `st_stage_insights`
- `st_engagement_deliverables`
- `st_commitments` (self-referencing tree, kind = `top` / `sub` / `cross_cut`, profile renders these as Priority / Initiative / Lens for strategic-planning)
- `st_commitment_document_links` (many-to-many)
- `st_commitment_change_log`
- `st_scope_extensions`
- `st_documents` (living-phase uploads with metadata, ingestion status)
- `st_surveys`, `st_survey_responses`, `st_survey_question_summaries`
- `st_drift_reports`
- `st_reporting_templates`, `st_compliance_reports`
- `st_initiative_updates` (for update mode)
- `st_ai_config` (strategic-tool's own LLM and vocabulary configuration, mirroring ai_config's shape for clean extraction)

### Extensions to shared tables

- `knowledge_chunks` gains `source_app TEXT NULL` and `engagement_id UUID NULL` columns. Backfilled so carlorbiz-website rows get `source_app='carlorbiz-website'` and `engagement_id=NULL`. RLS updated so strategic-tool queries always filter by both.

### Edge functions to create

- `st-ingest-document` (routes uploaded files through the chunking pipeline with strategic-tool scoping)
- `st-ingest-survey` (the survey pipeline in §10)
- `st-workshop-ocr` (photo-to-text during workshops, exists in concept from the original brief)
- `st-synthesise-stage` (closes a stage and writes insights)
- `st-nera-stage-conversation` (stakeholder interviews and pulse checks with strategic-tool prompts)
- `st-drift-watch` (scheduled corpus analysis, writes `st_drift_reports`)
- `st-generate-report` (template-constrained report generation)
- `st-merge-watcher` (scheduled, raises merge suggestions for new commitments)

### Reuse without change

- `nera-query`, `feedback-chat`, `_shared/llm.ts`, `extract-tab-chunks`, `convert-pdf-to-markdown`, `process-pdf`, `insight-extract`, `generate-insights`, `generate-summary` — all called by URL from strategic-tool's frontend and from its own edge functions. Owned and deployed by carlorbiz-website's repo. Kept in sync via the drift tool.

## 13a. Hard policy: no individual patient information

This is a permanent design constraint, not a v1 limitation. The tool stores strategic, governance, and compliance content. **It does not store individual patient information** — no names, no medical record numbers, no diagnoses linked to a person, no clinical notes. The Australian regulatory framing (Privacy Act, APP 6 / APP 11) treats this as sensitive personal information; the US framing (HIPAA) calls it Protected Health Information (PHI). Either way, it does not belong here.

The constraint is enforced through several layers:

- **Terms of Service** for any deployment includes an explicit clause stating that uploading individual patient information is a breach of use.
- **Admin panel surfaces** display the constraint at relevant input flows ("Don't mention individual patients in this update").
- **Surveys flagged with `contains_pii=true`** at upload time are restricted from verbatim quoting in any Nera output. Aggregate analysis is allowed; quoting is not.
- **The deliverable composer and report generator** are prompted with this constraint and refuse to emit text that quotes apparent patient identifiers.
- **The audit log** records any document upload flagged by Nera as potentially containing patient identifiers, so admins can review and remediate.

If a healthcare board needs to discuss specific patients, that conversation happens in their clinical system — not here. The tool exists to make the governance layer above clinical work more effective. It does not exist to be a clinical system.

This is also a positioning advantage: the tool can be sold to non-healthcare orgs (arts councils, community legal centres, peak bodies, education providers) without inheriting healthcare-grade compliance obligations, because it isn't holding healthcare-grade data in the first place.

## 14. What's explicitly NOT in scope for v1

Listed so we don't drift into them during build:

- **API integrations with external tools** (ClickUp, OneDrive, SharePoint, Google Drive). Document upload is the interface. If demand is strong we add one integration at a time in v2+.
- **Multi-tenant SaaS with billing**. Permanent decision, not a v1 deferral. The tool runs on the client's own infrastructure as soon as the engagement ends. Carla is not interested in maintaining N tenant deployments simultaneously, and the consulting engagement fee captures the value of the tool because the tool is theirs to keep at the end. No subscription model. No recurring billing. Maintenance is sold as a separate optional retainer at the client's discretion.
- **Mobile app**. PWA on mobile is the mobile experience.
- **Non-Excel/CSV/JSON survey formats**. No SurveyMonkey API integration in v1.
- **Live video transcription**. Workshop photo upload is the workshop capture mechanism. Video is v2+.
- **Third-party auth providers**. Supabase magic link only.
- **Custom per-tenant Nera fine-tuning**. Profile-level prompt engineering only.
- **Real-time collaboration**. Admin edits are single-user. Two admins editing the same document is out of scope.
- **Quantitative dashboards with charts**. v1 shows status signals as RAG badges, counts, and narrative. Recharts-based charts are v1.5+.
- **Automated funder submission**. Reports are downloaded and submitted manually. Auto-submit is a compliance risk we don't want in v1.

## 15. Relationship to the consulting engagement arc

The engagement arc described in the original brief remains intact, but now it ends *inside* the product rather than at handover. Specifically:

- Phase A delivers the priorities and lenses directly into `st_commitments` — the deliverable composer *is* the taxonomy writer.
- Phase A chunks all interview transcripts, workshop outputs, and supporting documents directly into the living-phase corpus.
- Phase A ends with a status transition from `delivered` to `living` and a **clean handover**: the consultant's account drops to no access (or revoked entirely), and full admin ownership transfers to the named client admin. The consultant is gone unless the client buys ongoing maintenance separately.
- Phase A surveys conducted during workshops (or the community pulse survey from the founding example) are ingested via the survey pipeline and become part of the living corpus.
- The deliverable document itself is chunked and linked to the priorities it describes, so Nera can always cite the founding document when explaining a priority.

The handover is not a content transfer. It's a clean role flip with a hard ownership boundary. The content has been accumulating from day one of the engagement.

### Why the consultant walks away by default

This is a deliberate commercial-positioning decision and it shapes a lot of the rest of the architecture. Carla's whole proposition is *"I help you formulate the starting point and set you up to maintain it yourselves"* — not *"you are now in a lifetime relationship with me"*. The tool is built to be handed over and run by the client. The consultant pricing reflects this — the engagement fee is high because the tool is theirs to keep at the end, including whatever the consultant has poured into it during the engagement.

Ongoing involvement is a separate, optional, paid arrangement. If a client wants Carla (or any other consultant who licenses the product) to spend ten hours a month helping them keep the living document alive, they buy a maintenance retainer. The tool supports re-opening an engagement in `living` mode for an additional facilitator role with explicit client consent — but that role is not assumed by default. Default is a clean walk-away.

The next consulting engagement (a strategic plan refresh, typically 18–24 months later) starts from the accumulated corpus the client has been building, which is *exactly* the moment the consultant adds maximum value — they walk into a tool that already understands two years of organisational history.

## 16. Open questions to resolve before phase 1 schema work

These are the decisions the schema work depends on. Some have been answered; a few remain.

### Resolved

- **Framing**: small organisations with heavy structured accountability obligations, profile-pluggable architecture, healthcare as the likely first marketing vertical but no architectural limit. ✓
- **Multi-role access**: first-class, multiple profiles can be active per engagement, roles have their own dashboards and Nera prompts. ✓
- **Vocabulary customisation**: admin-editable per deployment via the theme/branding panel. ✓
- **Strictness of justification flow**: configurable per engagement, default soft, with medium and hard modes available. ✓
- **Merge-watcher**: opt-in by default, Nera watches new commitments for 30–60 days after creation. ✓
- **Scope extension weight**: medium weight, with category enum. ✓
- **Cross-cutting Lenses**: first-class in the data model, Nera uses them for cross-referencing insights. ✓
- **Priority count**: 3–5 recommended, 7 hard cap, replacement rule above the cap. ✓
- **Supabase strategy**: shared project with `st_*` prefix discipline, extraction plan maintained. ✓
- **Vocabulary defaults for the `strategic-planning` profile**: top-level commitments are called **Priorities**. Sub-items are **Initiatives**. Cross-cutting tags are **Lenses**. ("Priorities" works across most other profiles too, so the default profile vocabulary leans on it.) ✓
- **Default pulse-check cadence**: **six-weekly**. Small boards often meet bi-monthly, so six-weekly is the sweet spot — board members can review the pulse outputs in their meeting prep without being overwhelmed by inter-meeting noise. All cadences are admin-editable per engagement and per role. ✓
- **Default drift-watch report delivery**: configurable per role. Two delivery channels in v1 — **in-app dashboard** and **email**. Not all roles need email — some only need in-app, and for very small orgs without a board secretariat, email-direct-to-board-members is the right pattern. The admin sets per-role preferences in the engagement configuration. Slack and Notion delivery are deferred — unpopular in the Australian market and not worth shipping in v1. ✓
- **Handover role semantics**: **clean walk-away by default**. When an engagement flips to `living`, the consultant's account loses access. Full admin ownership transfers to the named client admin. The consultant has no residual access unless the client explicitly contracts ongoing maintenance — at which point a `facilitator` role can be re-granted, with full audit logging. See §15 for the commercial reasoning. ✓
- **PHI / patient information stance**: **hard policy: no individual patient information is ever stored in this tool.** PHI = Protected Health Information (US/HIPAA) and its Australian equivalent (sensitive personal information under APP 6 / APP 11) are out of scope by design. The tool handles strategic, governance, and compliance content — not clinical content. The admin panel surfaces this constraint explicitly to users on relevant input flows ("Don't mention individual patients in this update"). Surveys flagged with `contains_pii=true` are restricted from verbatim quoting. The deployment Terms of Service contains a clause stating that patient-identifiable content is a breach of use. ✓
- **Subscription pricing model**: **no SaaS, no subscriptions.** The tool lives on the client's own infrastructure as soon as the engagement is over. The consulting engagement fee is high because the tool is theirs to keep at the end. Carla is not interested in maintaining N tenant deployments simultaneously. No billing infrastructure required in v1 or any version. ✓
- **First real engagement target for phase 1 schema work**: a **fictionalised composite** based on Carla's two CEO experiences. Two synthetic profiles will ship with the demo seed data:
  - **"Acme Catering Group"** — a corporate-style multi-outlet operator (modelled on Zouki) with 100+ small retail/cafe locations, each operating under separate compliance regimes, governed by a small parent board and a CEO who needs to track 100+ commitments simultaneously.
  - **"National Allied Health Peak Council"** — a small healthcare peak body (modelled on GPSA) with a single multi-million-dollar government grant, a voluntary board larger than its full-time staff, and quarterly funder reporting obligations.

  Both are anonymised enough that neither Zouki nor GPSA is identifiable from the example, but the structural shapes are real, Carla has lived experience of running both, and they exercise opposite ends of the platform's range — one is multi-site retail compliance, the other is single-grant peak body governance. They become the proof-of-concept demo customers for phase 1 schema validation and for show-and-tell with prospective clients. ✓

### Still open

(none — all questions resolved as of 2026-04-11)

---

Reference: this document should be re-read before any schema or edge-function work on strategic-tool. Update as decisions are made. Keep it in sync with the reality of the code.
