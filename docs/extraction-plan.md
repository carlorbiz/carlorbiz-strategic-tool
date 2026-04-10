# Extraction plan: lifting strategic-tool out into its own Supabase project

This is the working checklist for extracting strategic-tool from the shared carlorbiz-website Supabase project into a standalone Supabase project, when the tool becomes a commercial product sold to other consultants.

**Maintain this document as we build.** Every new `st_*` table, `st-*` function, `st-*` bucket, and `st_*` policy goes here the day it's created. When extraction time comes, it should be a mechanical exercise.

## When to extract

- The first paying consultant licensee is contracted, OR
- We want to demo strategic-tool to a prospect on infrastructure they can verify is independent of Carlorbiz, OR
- The shared project is hitting any quota limit attributable to strategic-tool usage

## What gets extracted

### Tables

*To be filled in as we build. Format: `st_table_name` — purpose — depends on*

- (none yet)

### Edge functions

*Format: `st-function-name` — purpose — secrets required*

- (none yet)

### Storage buckets

*Format: `st-bucket-name` — purpose — RLS pattern*

- (none yet)

### RLS policies

*All policies on `st_*` tables. Format: `policy_name on table_name` — what it allows*

- (none yet)

### Migrations

All migration files under `migrations/strategic-tool/` are extracted as-is.

- (none yet)

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
| `knowledge_chunks` | Owned by carlorbiz-website | Strategic-tool's new project will need to either import a snapshot of relevant chunks, OR call carlorbiz-website's RAG API as an external service. |
| `ai_config` | Carlorbiz-website-specific prompts | Strategic-tool's new project starts with `st_ai_config` only. |
| `app_settings` | Carlorbiz-website branding | Strategic-tool's new project gets fresh branding via its own `app_settings` row. |
| `nera-query` and other shared edge functions | Owned by carlorbiz-website | Strategic-tool's new project either gets a copy deployed by lifting source from carlorbiz-website's repo, OR continues calling carlorbiz-website's deployed functions cross-origin. |

## Mechanical extraction steps (when the time comes)

1. Create new Supabase project: `cb-strategic-tool` (or per-licensee name).
2. Run all `migrations/strategic-tool/*.sql` against it in order.
3. For each `st-*` edge function, deploy to the new project: `supabase functions deploy <name> --project-ref <new-ref>`.
4. Lift `nera-query`, `feedback-chat`, `_shared/llm.ts` source from carlorbiz-website's repo, deploy them to the new project too (or skip and call upstream's deployed functions if cross-origin is acceptable).
5. Set edge function secrets on the new project (ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY).
6. Create the `st-*` storage buckets and apply their RLS policies.
7. Update strategic-tool's `.env` to point at the new project.
8. Optionally export-and-import any production data from the shared project's `st_*` tables: `pg_dump --table='st_*' --data-only` → `psql` into the new project.
9. Test end-to-end on the new project.
10. After verification, drop `st_*` tables and `st-*` functions/buckets from the shared carlorbiz-website project.

## What about historic data?

If there's production data in the shared project's `st_*` tables at extraction time, decide per-engagement:

- Active engagements → migrate to the new project.
- Completed engagements → leave as a historic snapshot in the shared project, archive a static export to `st-deliverables` storage, and rely on the deliverable PDF as the canonical record.
