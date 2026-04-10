# Carlorbiz Strategic Tool

A commercial-grade PWA for facilitating multi-stage strategic planning engagements — from one-on-one stakeholder interviews and live workshops through to a polished deliverable handover. Built for consultants who run cumulative discovery → workshop → decision arcs and need a single tool that carries insights forward between rounds.

## Status

This branch (`rebuild/from-carlorbiz-website`) is a foundation snapshot of the [carlorbiz-website](https://github.com/carlorbiz/carlorbiz-website) codebase, taken on 10 Apr 2026, on top of which the strategic-tool-specific surfaces (engagements, stages, insight chaining, deliverable mode flip) will be layered.

The previous contents of this repo are archived under git tags:

- `legacy/static-rwav-master` — original vanilla-JS RWAV PWA
- `legacy/manus-supabase-migration` — Manus 9 Apr 2026 React+Supabase rewrite (never merged)

See [docs/migration-brief.md](docs/migration-brief.md) for the original migration brief that informs the strategic-tool feature roadmap.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui + Wouter
- **Backend**: Supabase (PostgreSQL with RLS, magic-link auth, Edge Functions, Storage)
- **AI**: Multi-LLM via `ai_config` table (Anthropic / Gemini / OpenAI), SSE streaming
- **Hosting**: Cloudflare Pages (frontend), Supabase (backend)
- **Tenancy model**: single tenant per Supabase project — each consultant runs their own deployment

## Getting Started

1. Copy `.env.example` to `.env` and fill in Supabase credentials
2. `npm install`
3. `npm run dev`
4. Run schema migrations against your Supabase project (see `DEFINITIVE_MIGRATION.sql` and `migrations/`)

## Roadmap (strategic-tool layer)

To be built on top of this foundation:

- `engagements`, `engagement_stages`, `stage_insights`, `engagement_deliverables` schema
- Admin-editable stage templates (interview / workshop / report) — any number per engagement
- Cumulative insight chaining between stages (`synthesise-stage` edge function)
- QR-code participant join + photo upload + Vision-AI OCR pipeline
- Deliverable mode flip (collapses participant view to the final report only)
- De-identified demo engagement (fictionalised from RWAV data) for show-and-tell
