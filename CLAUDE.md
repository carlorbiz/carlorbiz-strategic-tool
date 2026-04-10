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

## Getting started

1. Copy `.env.example` to `.env`
2. `npm install`
3. `npm run dev`
