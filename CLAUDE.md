# carlorbiz-strategic-tool

A conversational evidence platform for small organisations with heavy structured accountability obligations. The full vision is captured in [docs/living-platform-vision.md](docs/living-platform-vision.md).

## App maintenance state

This app's state is tracked in Carla's [App Development & Maintenance Database](https://www.notion.so/33e9440556f781168a0bf1732f969e01) (page id `33e94405-56f7-8116-8a0b-f1732f969e01`). The database is the canonical source of truth.

Read or update it through the `app-status` skill (`~/.claude/skills/app-status/SKILL.md`). The pointer file at [.claude/project-app.yml](.claude/project-app.yml) tells the skill which row to read.

Do not duplicate app state into this CLAUDE.md.

## Foundation

This trunk is a snapshot of [carlorbiz-website](https://github.com/carlorbiz/carlorbiz-website) taken on 2026-04-10, with strategic-tool-specific surfaces layered on top progressively. The legacy state is preserved as git tags `legacy/static-rwav-master` and `legacy/manus-supabase-migration`.

The relationship to the upstream snapshot is governed by:

- [.upstream-snapshot](.upstream-snapshot) — pinned upstream SHA
- [.upstream-sync.yml](.upstream-sync.yml) — file-by-file classification (local_only / diverged / shared)
- [scripts/check-upstream-drift.mjs](scripts/check-upstream-drift.mjs) — the drift checker
- [docs/upstream-sync.md](docs/upstream-sync.md) — workflow documentation

Run `npm run sync:check` to see drift. Run `npm run sync:apply -- <path>` to pull a specific upstream-ahead file forward.

## Supabase strategy

Strategic-tool **shares** the carlorbiz-website Supabase project (cost-conscious decision until commercialisation). All strategic-tool-specific tables, edge functions, storage buckets, and RLS policies are prefixed `st_*` / `st-*` from day one so the entire surface can be lifted out into a standalone project later. See [docs/supabase-strategy.md](docs/supabase-strategy.md) and [docs/extraction-plan.md](docs/extraction-plan.md).

## Stack

- React 18 + TypeScript + Vite + Tailwind 4 + shadcn/ui + Wouter
- Supabase (PostgreSQL with RLS, magic-link auth, edge functions, storage)
- Cloudflare Pages for frontend hosting
- Multi-LLM via `_shared/llm.ts` (Anthropic / Gemini / OpenRouter)
- SSE streaming for Nera responses

## Current status (updated 2026-04-13)

Phase 1 (schema) + all Phase 2 sub-phases (routing, admin, documents, dashboard) complete and deployed. The tool has a complete working surface from engagement list through to living dashboard. Schema applied to live Supabase. `st-ingest-document` edge function deployed. Two demo engagements loaded.

Phase 3 is split into two sessions:
- **Phase 3a** — conversational surfaces + survey ingestion + drift-watch + handover flow + **shared Conversational Interview Engine (Option A — first consumer)**. The engine is built here as `interview-engine/*` edge functions with `ie_*` tables, designed for extraction. Exec-reclaim and all other CJ/Nera surfaces consume the same functions — do NOT rebuild elsewhere. Full spec: `knowledge-lake-source/V2_ARCHITECTURE_BRIEF.md`.
- **Phase 3b** — deliverable composer + report generator + Cloudflare Pages deployment

Fork points in Notion Chat Fork Points DB:
- Phase 3a: https://www.notion.so/3419440556f781ca9312eeb5e421f696
- Phase 3b: https://www.notion.so/3419440556f7818cb92cccec8bbe056b

## Cross-PWA findings from this build

1. **The V2 Conversational Interview Engine** (knowledge-lake-source/V2_ARCHITECTURE_BRIEF.md) is the canonical spec for all CJ and Nera conversational surfaces. Any new conversational surface in any repo should build against this spec rather than inlining chat logic. First build targets exec-reclaim CJ-on-Slack.
2. **Nera/CLAUDE.md strategic-tool entry (lines 88-99) is stale** — still describes the old RWAV static HTML version. Needs rewriting to match the living platform vision. Flagged in Notion.
3. **The st_* prefix discipline** (docs/supabase-strategy.md) is a reusable pattern for any product that shares a Supabase project temporarily but needs clean extraction later.
4. **The vocabulary map pattern** (useVocabulary hook + st_ai_config.vocabulary_map) is reusable for any multi-tenant product where different deployments need different UI labels without code changes.
5. **The upstream drift tooling** (scripts/check-upstream-drift.mjs + .upstream-sync.yml) is reusable for any repo that snapshots from another and wants deliberate pull-forward rather than continuous merge.

## Getting started

1. Copy `.env.example` to `.env` (point at the carlorbiz-website Supabase project)
2. `npm install`
3. `npm run dev`
