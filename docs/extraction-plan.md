# Extraction plan: lifting strategic-tool out into its own Supabase project

This is the working checklist for extracting strategic-tool from the shared carlorbiz-website Supabase project into a standalone Supabase project, when the tool becomes a commercial product sold to other consultants.

**Maintain this document as we build.** Every new `st_*` table, `st-*` function, `st-*` bucket, and `st_*` policy goes here the day it's created. When extraction time comes, it should be a mechanical exercise.

## When to extract

- The first paying consultant licensee is contracted, OR
- We want to demo strategic-tool to a prospect on infrastructure they can verify is independent of Carlorbiz, OR
- The shared project is hitting any quota limit attributable to strategic-tool usage

## What gets extracted

### Enums (13)

- `st_engagement_status` — draft|active|delivered|living|archived
- `st_engagement_type` — strategic_planning|grant_reporting|governance|accreditation
- `st_taxonomy_strictness` — soft|medium|hard
- `st_commitment_kind` — top|sub|cross_cut
- `st_commitment_status` — active|archived|merged_into
- `st_scope_extension_category` — clarification|expansion|reinterpretation|correction
- `st_change_type` — commitment_created|commitment_modified|commitment_archived|commitment_merged|scope_extended|scope_narrowed|strictness_changed|count_cap_overridden
- `st_ratification_status` — draft|pending_board|ratified|rejected
- `st_document_status` — uploaded|ingesting|ingested|failed
- `st_survey_status` — uploaded|ingesting|ingested|failed
- `st_report_status` — draft|review|approved|delivered
- `st_stage_type` — interview|workshop|report|checkpoint|board_review|retrospective|onboarding|survey_run|reporting_cycle
- `st_stage_status` — draft|open|closed|archived
- `st_update_rag_status` — on_track|at_risk|blocked|done

### Tables (24)

*Format: `table_name` — purpose — key FKs*

- `st_engagements` — core engagement record — created_by→user_profiles, handed_over_to→user_profiles
- `st_engagement_stages` — ordered stage list per engagement — engagement_id→st_engagements
- `st_stage_participants` — who's invited to which stage — stage_id→st_engagement_stages, user_id→user_profiles
- `st_engagement_roles` — per-engagement role definitions — engagement_id→st_engagements
- `st_user_engagement_roles` — user ↔ engagement ↔ role join — user_id→user_profiles, engagement_id→st_engagements, role_id→st_engagement_roles
- `st_engagement_profiles` — engagement ↔ profile key join — engagement_id→st_engagements
- `st_commitments` — the taxonomy tree (Priorities/Initiatives/Lenses) — engagement_id→st_engagements, parent_id→self, merged_into_id→self, justification_log_id→st_commitment_change_log
- `st_commitment_change_log` — permanent audit log of taxonomy changes — engagement_id→st_engagements, commitment_id→st_commitments, author_id→user_profiles
- `st_scope_extensions` — medium-weight scope extension records — commitment_id→st_commitments, change_log_id→st_commitment_change_log, created_by→user_profiles
- `st_documents` — living-phase document uploads — engagement_id→st_engagements, primary_commitment_id→st_commitments, uploaded_by→user_profiles
- `st_commitment_document_links` — many-to-many commitment ↔ document — commitment_id→st_commitments, document_id→st_documents
- `st_stakeholder_inputs` — Nera-conversation transcripts — stage_id→st_engagement_stages, engagement_id→st_engagements, user_id→user_profiles
- `st_workshop_decisions` — workshop decision capture — stage_id→st_engagement_stages, engagement_id→st_engagements, commitment_id→st_commitments
- `st_workshop_photos` — workshop photo uploads with OCR — stage_id→st_engagement_stages, engagement_id→st_engagements, commitment_id→st_commitments
- `st_stage_insights` — synthesised output from closed stages — stage_id→st_engagement_stages, engagement_id→st_engagements
- `st_engagement_deliverables` — final deliverable documents — engagement_id→st_engagements, created_by→user_profiles
- `st_initiative_updates` — conversational update-mode entries — commitment_id→st_commitments, engagement_id→st_engagements, author_id→user_profiles
- `st_surveys` — survey upload containers — engagement_id→st_engagements, uploaded_by→user_profiles
- `st_survey_responses` — normalised survey rows — survey_id→st_surveys
- `st_survey_question_summaries` — per-question Nera analysis — survey_id→st_surveys
- `st_drift_reports` — scheduled drift-watch output — engagement_id→st_engagements
- `st_reporting_templates` — funder/regulator report templates — engagement_id→st_engagements (nullable for globals)
- `st_compliance_reports` — generated reports — engagement_id→st_engagements, template_id→st_reporting_templates, created_by→user_profiles
- `st_ai_config` — strategic-tool LLM and vocabulary config — engagement_id→st_engagements (nullable for global defaults)

### Helper functions (3)

- `st_user_has_engagement_access(eng_id UUID)` — checks if current user has any role in the engagement or is internal_admin
- `st_is_admin()` — checks if current user is internal_admin
- `st_user_has_role(eng_id UUID, required_role TEXT)` — checks for a specific role_key
- `st_set_updated_at()` — trigger function for updated_at columns

### Edge functions

*Format: `st-function-name` — purpose — secrets required*

- `st-ingest-document` — accepts a `document_id`, downloads the file from `st-documents` bucket, extracts text (md/txt/csv/json natively, PDF/DOCX with caveats noted in code), runs LLM chunk extraction via `_shared/llm.ts`, writes chunks to `knowledge_chunks` with `source_app='strategic-tool'` + `engagement_id`, generates a one-sentence summary, updates `st_documents` status. Secrets: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Storage buckets (4)

- `st-documents` — living-phase document uploads — private, authenticated read/write
- `st-workshop-photos` — workshop photo uploads — private, authenticated read/write
- `st-surveys` — survey file uploads — private, authenticated read/write
- `st-deliverables` — generated deliverable exports — private, authenticated read/write

### RLS policies (~80)

All `st_*` tables have RLS enabled and policies. Pattern:
- **SELECT**: `st_user_has_engagement_access(engagement_id)` — users see only engagements they have a role in
- **INSERT**: same access check (you can contribute to engagements you're part of)
- **UPDATE**: same access check (or admin-only for some tables)
- **DELETE**: `st_is_admin()` only

Exceptions:
- `st_user_engagement_roles` — users see their own rows, admins see all, admins manage
- `st_scope_extensions`, `st_survey_responses`, `st_survey_question_summaries`, `st_commitment_document_links` — access resolved through parent table FK chain
- Storage bucket policies — gated by `auth.role() = 'authenticated'` and bucket_id

### Extensions to shared tables

- `knowledge_chunks` gains `source_app TEXT` and `engagement_id UUID` columns
  - Backfilled: all existing rows get `source_app = 'carlorbiz-website'`
  - FK: `engagement_id` → `st_engagements(id)` ON DELETE SET NULL
  - Indexes: `idx_chunks_source_app`, `idx_chunks_engagement_id`, `idx_chunks_st_scoped`
  - **NOTE**: existing RLS policies on knowledge_chunks are NOT modified (backward compat with carlorbiz-website's public read)
  - **At extraction**: the new project's knowledge_chunks gets stricter RLS

### Triggers (7)

- `trg_st_engagements_updated_at`
- `trg_st_engagement_stages_updated_at`
- `trg_st_stakeholder_inputs_updated_at`
- `trg_st_engagement_deliverables_updated_at`
- `trg_st_compliance_reports_updated_at`
- `trg_st_reporting_templates_updated_at`
- `trg_st_ai_config_updated_at`

### Migrations

All migration files under `migrations/strategic-tool/` are extracted as-is.

- `0001_init.sql` — all st_* tables, enums, RLS, indexes, storage buckets, helper functions, triggers
- `0002_extend_knowledge_chunks.sql` — source_app + engagement_id columns on shared table

### Frontend env vars

Strategic-tool's `.env` will need to point at the new Supabase project URL and anon key.

```
VITE_SUPABASE_URL=https://<new-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<new-anon-key>
VITE_NERA_API_URL=https://<new-project>.supabase.co/functions/v1/nera-query
```

### What does NOT get extracted automatically

| Object | Why | What to do instead |
|---|---|---|
| `user_profiles` | Carlorbiz-website also uses this | Strategic-tool's new project gets its own copy. Existing strategic-tool users lose continuity unless we migrate them by export/import. |
| `knowledge_chunks` | Owned by carlorbiz-website | Strategic-tool's new project imports rows WHERE `source_app='strategic-tool'`, then drops the `source_app` column (all rows are strategic-tool in the new project). |
| `ai_config` | Carlorbiz-website-specific prompts | Strategic-tool's new project starts with `st_ai_config` only (renamed to `ai_config` in the new project). |
| `app_settings` | Carlorbiz-website branding | Strategic-tool's new project gets fresh branding via its own `app_settings` row. |
| `nera-query` and other shared edge functions | Owned by carlorbiz-website | Strategic-tool's new project either gets a copy deployed by lifting source from carlorbiz-website's repo, OR continues calling carlorbiz-website's deployed functions cross-origin. |

## Mechanical extraction steps (when the time comes)

1. Create new Supabase project: `cb-strategic-tool` (or per-licensee name).
2. Run all `migrations/strategic-tool/*.sql` against it in order.
3. Export strategic-tool's `knowledge_chunks` rows: `pg_dump` with `--where "source_app='strategic-tool'"` or equivalent.
4. Import into the new project's `knowledge_chunks` table, drop `source_app` column (all rows are strategic-tool now).
5. For each `st-*` edge function, deploy to the new project: `supabase functions deploy <name> --project-ref <new-ref>`.
6. Lift `nera-query`, `feedback-chat`, `_shared/llm.ts` source from carlorbiz-website's repo, deploy them to the new project too (or skip and call upstream's deployed functions if cross-origin is acceptable).
7. Set edge function secrets on the new project (ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY).
8. Create the `st-*` storage buckets and apply their RLS policies (already in 0001_init.sql).
9. Update strategic-tool's `.env` to point at the new project.
10. Optionally export-and-import any production data from the shared project's `st_*` tables: `pg_dump --table='st_*' --data-only` → `psql` into the new project.
11. Test end-to-end on the new project.
12. After verification, drop `st_*` tables, `st_*` enums, `st_*` functions, and `st-*` buckets from the shared carlorbiz-website project. Remove `source_app` and `engagement_id` columns from the shared `knowledge_chunks`.

## What about historic data?

If there's production data in the shared project's `st_*` tables at extraction time, decide per-engagement:

- Active engagements → migrate to the new project.
- Completed engagements → leave as a historic snapshot in the shared project, archive a static export to `st-deliverables` storage, and rely on the deliverable PDF as the canonical record.
