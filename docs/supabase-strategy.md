# Supabase strategy: shared project, prefixed namespacing

**Status: provisional — pending confirmation of carlorbiz-website's current Supabase plan (Free vs Pro). See [Open question](#open-question) at the bottom.**

## Decision

Strategic-tool **shares the existing carlorbiz-website Supabase project** for backend, rather than spinning up its own. Strategic-tool-specific tables, edge functions, and storage buckets are namespaced with an `st_` / `st-` prefix from day one so the entire surface can be lifted out into a standalone Supabase project later, when the tool becomes a commercial product sold to other consultants.

## Why share

- **Cost.** A second Supabase Pro project is roughly $25 USD/month. While strategic-tool is only used by Carla for her own consulting engagements, that's the wrong tradeoff.
- **Reuse Nera RAG infrastructure for free.** `nera-query`, `feedback-chat`, the `_shared/llm.ts` multi-LLM abstraction, all the prompt management in `ai_config`, the `knowledge_chunks` corpus — all of it is already deployed. Strategic-tool calls these as-is by URL.
- **Single auth identity.** A user logged in to carlorbiz.com.au is logged in to the strategic tool. No second magic-link dance.
- **Single dashboard, single secrets store, single bill.**
- **The strategic-tool can RAG over Carlorbiz's published methodology** (knowledge_chunks). That's not a hack, it's actually a feature: a workshop-mode Nera that can cite Carla's own prior writing is more credible than one that can't.

## Frontend deployment is still separate

The strategic-tool ships as its **own Cloudflare Pages project** at a dedicated subdomain (e.g. `strategic.carlorbiz.com.au`). Cloudflare Pages free tier handles a second project comfortably. Sharing the backend doesn't mean sharing the frontend.

## The discipline: prefixing

Every strategic-tool-specific Supabase object gets a prefix from day one. This is non-negotiable because it's the entire mechanism by which we'll later extract this into a standalone product.

| Object type | Prefix | Examples |
|---|---|---|
| Tables | `st_` | `st_engagements`, `st_engagement_stages`, `st_stage_participants`, `st_stakeholder_inputs`, `st_workshop_decisions`, `st_workshop_photos`, `st_stage_insights`, `st_engagement_deliverables`, `st_ai_config` |
| Edge functions | `st-` | `st-workshop-ocr`, `st-synthesise-stage`, `st-generate-deliverable`, `st-nera-stage-conversation` |
| Storage buckets | `st-` | `st-workshop-photos`, `st-deliverables` |
| RLS policies | `st_` | `st_engagements_owner_can_read`, `st_workshop_photos_facilitator_can_write` |
| Migrations | folder | `migrations/strategic-tool/0001_init.sql`, etc. — never mixed with carlorbiz-website's migrations |

## Reuse without prefix — only where it genuinely fits across both products

| Object | Why reuse | Notes |
|---|---|---|
| `user_profiles` | Universal identity | We may add a `tools_access` JSONB column later to gate which products a user can see |
| `knowledge_chunks` | Strategic-tool's Nera should be able to cite Carlorbiz methodology | Read-only from strategic-tool's perspective |
| `app_settings` | Branding tokens used by the design system | Strategic-tool can override per-engagement at runtime via its own state |
| `ai_config` | Generic LLM provider/model selection | But strategic-tool's domain-specific prompts go in a separate `st_ai_config` table to keep extraction clean |

## The Nera prompt question

Strategic-tool needs its own Nera system prompts (workshop facilitation, stakeholder interview, SWOT extraction, etc.) that don't belong in carlorbiz-website's `ai_config`. Three options considered:

1. **Add columns to `ai_config` prefixed with `st_`** — ugly, pollutes upstream's schema.
2. **Make `ai_config` multi-row keyed by `app`** — invasive refactor of carlorbiz-website's CMSContext.
3. **Create `st_ai_config` table** — clean isolation, mirrors the structure of `ai_config` so the extraction is mechanical.

We're going with **option 3**.

## Risks of the shared model

| Risk | Mitigation |
|---|---|
| Strategic-tool participant data lands in the same DB as Carla's live consulting business | RLS policies on every `st_*` table from day one. Tested before any prod data lands. |
| A bug in `st_*` RLS could expose carlorbiz-website data, or vice versa | Schema commit ships with RLS tests. No `st_*` table exists without policies. |
| Strategic-tool consumes the carlorbiz-website Supabase quota | Resolved by confirming the plan tier. See [Open question](#open-question). |
| Extraction work is real when commercialisation comes | Mitigated by the prefixing discipline and [docs/extraction-plan.md](extraction-plan.md). |

## Edge function ownership

The `nera-query`, `feedback-chat`, `_shared/llm.ts` etc. functions are **owned and deployed by carlorbiz-website's repo**. Strategic-tool just calls them by URL. Strategic-tool's repo currently vendors a copy of those folders for reference (`shared:` in the [drift manifest](../.upstream-sync.yml)) so a developer reading just this repo can understand the whole stack — but strategic-tool's CI does not deploy them.

Strategic-tool's own edge functions (`st-*`) live only in strategic-tool's repo and are deployed by strategic-tool's CI.

## Open question

**Which Supabase plan is the carlorbiz-website project currently on?**

- If **Free**: storage cap is 1 GB, DB is 500 MB, 50,000 monthly active users. A few self-test workshops with photo uploads will eat into storage fast. Recommendation: upgrade to Pro before we ship the photo-upload pipeline, OR use external object storage (Cloudflare R2) for `st-workshop-photos`.
- If **Pro**: 100 GB storage, 8 GB DB, 100,000 MAU. Plenty of headroom for both products through commercial extraction.

This needs to be confirmed before we run the schema migration.
