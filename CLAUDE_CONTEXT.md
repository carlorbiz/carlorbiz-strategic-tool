# Carlorbiz Strategic Planning Toolkit — Developer Context

## Architecture Overview

This is a **Supabase + Cloudflare Pages** PWA following the same stack as the carlorbiz-website. It is NOT a Manus sandbox project — all infrastructure is Supabase-native.

### Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui + wouter (routing)
- **Backend**: Supabase PostgreSQL + Auth + Edge Functions (Deno) + Storage
- **AI**: Multi-LLM via `_shared/llm.ts` — Anthropic Claude, Google Gemini, OpenRouter
- **Hosting**: Cloudflare Pages (static frontend) + Supabase Edge Functions (serverless)
- **PWA**: Service worker in `client/public/sw.js`

### Key Patterns
- **Nera-conversation**: AI-guided dialogue (not surveys) via SSE streaming from edge functions
- **Knowledge chunking**: OCR text and stakeholder input stored as knowledge_chunks for RAG
- **Role-based access**: user_profiles table with roles (internal_admin, client_admin, facilitator, board_member, external_stakeholder)
- **Session-scoped data**: All workshop data (decisions, photos, chat) scoped to workshop_sessions

### Edge Functions
- `nera-premeeting` — Pre-meeting Nera-conversation with persistent history
- `workshop-ai` — Workshop AI chatbot with 3 functions (question, swot, narrative)
- `workshop-ocr` — Photo OCR with SWOT categorisation (Gemini Vision or Anthropic Vision)
- `generate-report` — Board strategy document generation from all workshop data

### Data Flow
1. Stage 1 (Briefing) loads static JSON from `/data/rwav-strategic-data.json`
2. Pre-Meeting: stakeholder_inputs table stores Nera conversation history + extracted insights
3. Workshop: photos → OCR → knowledge_chunks; decisions tracked in workshop_decisions
4. Report: generate-report aggregates all data sources into a Markdown report
5. Pre-meeting input feeds directly into workshop AI context (hard requirement)

### Constraints
- Facilitator name: **Carla** (exact, used in notification copy)
- Priority labels: **HIGH**, **MEDIUM**, **LOW** (exact)
- Nera-conversation (not "near-conversation" or "survey")
- Pre-meeting → workshop data pathway is mandatory, not optional

### Environment
- `.env` for local dev (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- Supabase secrets for edge functions (ANTHROPIC_API_KEY, GEMINI_API_KEY, etc.)
- No Manus-specific dependencies or environment variables
