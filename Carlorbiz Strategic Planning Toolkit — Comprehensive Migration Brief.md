# Carlorbiz Strategic Planning Toolkit — Comprehensive Migration Brief

## Project Overview

The Carlorbiz Strategic Planning Toolkit is a commercial-grade Progressive Web Application designed to support the full arc of strategic planning facilitation — from pre-meeting stakeholder engagement through live Board workshops to polished report generation. Originally prototyped as a static HTML/JS application (the RWAV Interactive Toolkit), this project has now been completely rebuilt on the proven Carlorbiz infrastructure stack: Supabase (PostgreSQL, Auth, Edge Functions, Storage) + Cloudflare Pages, with the Nera AI conversation engine at its core.

## Background and Context

The original RWAV Strategic Planning Toolkit was built as a single-page HTML application with vanilla JavaScript modules. While it demonstrated the concept, it suffered from reliability issues — particularly because it was converted from a Manus sandbox environment to static files, which introduced architectural incompatibilities. The tool was designed in three stages but only Stage 1 (static briefing) was partially functional.

In this session, a complete architectural overhaul was executed. The legacy codebase was archived and the entire application was rebuilt from scratch using the same stack that powers the carlorbiz-website — the most evolved version of Carla's Nera PWA infrastructure. This ensures the tool is commercially viable, independently deployable, and licensable.

## Three-Stage Architecture

### Stage 1 — Intelligence Briefing

The static intelligence briefing presents the full RWAV strategic plan data including Executive Summary, Three Pillars analysis, Community Pulse Survey results, Pilot Communities mapping, Financial Strategy breakdown, and Implementation Timeline. Interactive Recharts visualisations render the data dynamically. An interactive Victoria map is embedded within the briefing. PDF export via jsPDF and html2canvas allows the full briefing to be downloaded as a Board-ready document. All data loads from static JSON files (`/data/rwav-strategic-data.json`) which can be swapped for different clients via the admin panel.

### Stage 1.5 — Pre-Meeting Stakeholder Engagement (Nera-Conversation)

This is the critical data collection layer that sits between the briefing and the live workshop. Rather than traditional surveys or questionnaires, it uses a Nera-conversation — an AI-guided dialogue that elicits richer, more nuanced stakeholder input. The conversation is powered by a Supabase Edge Function (`nera-premeeting`) that streams responses via Server-Sent Events, using the same multi-LLM abstraction (`_shared/llm.ts`) as the carlorbiz-website.

Key features of the pre-meeting tool include persistent memory across sessions (participants can log back in over days or weeks and continue adding to their content), automatic extraction of structured insights from conversational input, and a hard data pathway that feeds all pre-meeting input directly into the Stage 2 workshop as source material for the decision engine and AI chatbot. This feed-forward integration is a non-negotiable architectural requirement.

### Stage 2 — Live Workshop Facilitation

The workshop interface provides the facilitator (Carla) with a comprehensive toolset for running live Board strategic planning sessions. Components include QR code generation for a shareable session endpoint where participants can upload photos of whiteboards, sticky notes, and planning artefacts directly from their phones. An OCR edge function (`workshop-ocr`) processes uploaded photos using Vision AI (Gemini or Anthropic) to extract text and automatically categorise it into SWOT categories.

The Decision Engine tracks workshop decisions with priority labels (HIGH, MEDIUM, LOW — exact values), impact assessment, and initiative categorisation. An AI chatbot (`workshop-ai`) serves three distinct functions: answering questions about the strategic plan data, performing SWOT categorisation of workshop input, and generating narrative summaries for the exported report. All workshop data (decisions, OCR results, uploaded photos, chat messages) is scoped to named sessions with persistent storage.

### Stage 3 — Admin Panel

An authenticated admin UI allows loading and editing strategic plan data, configuring branding per client, managing workshop sessions (create, name, archive), and configuring AI prompt templates. This makes the tool fully reusable across different clients — the same infrastructure serves RWAV, or any other organisation, simply by swapping the data and branding.

## Technical Stack

The application is built on the following infrastructure, matching the carlorbiz-website exactly:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + TypeScript + Vite | SPA with code splitting |
| Styling | Tailwind CSS 4 + shadcn/ui | Design system and components |
| Routing | wouter | Lightweight client-side routing |
| Database | Supabase PostgreSQL | All persistent data with RLS |
| Auth | Supabase Auth (magic link) | Role-based access control |
| AI Backend | Supabase Edge Functions (Deno) | SSE streaming, OCR, report gen |
| LLM | Multi-LLM via _shared/llm.ts | Anthropic, Gemini, OpenRouter |
| Storage | Supabase Storage | Photo uploads, generated reports |
| Hosting | Cloudflare Pages | Static frontend deployment |
| PWA | Service worker | Offline workshop support |

## Database Schema

Nine tables in Supabase PostgreSQL:

| Table | Purpose |
|-------|---------|
| user_profiles | Role-based user management (internal_admin, client_admin, facilitator, board_member, external_stakeholder) |
| workshop_sessions | Named sessions with access tokens, status tracking, and client branding |
| stakeholder_inputs | Pre-meeting Nera-conversation data with conversation history and extracted insights |
| workshop_decisions | Decisions with priority (HIGH/MEDIUM/LOW), impact assessment, SWOT category |
| workshop_photos | Uploaded photos with OCR results and SWOT categorisation |
| workshop_chat_messages | AI chatbot conversation history scoped to sessions |
| workshop_reports | Generated PDF reports with metadata |
| knowledge_chunks | RAG-style knowledge storage for AI context |
| app_config | Client-specific configuration (branding, AI prompts, strategic data) |

## Edge Functions

| Function | Purpose | Pattern |
|----------|---------|---------|
| nera-premeeting | Pre-meeting Nera-conversation with persistent history | SSE streaming |
| workshop-ai | Three-function chatbot (question, SWOT, narrative) | SSE streaming |
| workshop-ocr | Vision AI OCR with SWOT categorisation | Request/response |
| generate-report | Board strategy document from all workshop data | Request/response |

## Key Constraints

1. The facilitator's name is Carla — used exactly in all notification copy
2. Priority labels must use exact values: HIGH, MEDIUM, LOW
3. The AI conversation feature is branded as "Nera-conversation" (not "near-conversation" or "survey")
4. Pre-meeting stakeholder input must have a clear, functional data pathway into the Stage 2 workshop — this is a hard requirement
5. The AI chatbot in the facilitator interface must serve three distinct functions: answering questions, SWOT categorisation, and narrative summary generation
6. The application must be completely independent of any Manus sandbox infrastructure
7. The tool must be commercially licensable and deployable for different clients

## Current State

The `feature/supabase-cloudflare-migration` branch on `carlorbiz/carlorbiz-strategic-tool` contains the complete rewrite. TypeScript compiles with zero errors, and the Vite production build succeeds cleanly. Legacy code is archived in `_archive/` for reference.

## Deployment Steps

1. Run `supabase_schema.sql` in Supabase SQL Editor to create all tables, indexes, RLS policies, and storage buckets
2. Set edge function secrets: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`
3. Deploy edge functions: `supabase functions deploy nera-premeeting workshop-ai workshop-ocr generate-report`
4. Set frontend environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. Build frontend: `pnpm build`
6. Deploy to Cloudflare Pages from the `dist/` directory

## Outstanding Items

1. Visual design direction — awaiting client style guidance (colour palette, typography, imagery)
2. Victoria map integration — needs a mapping library (Leaflet or Google Maps) with LGA boundary data
3. PWA icon generation — placeholder icons need replacing with branded versions
4. End-to-end testing with live Supabase instance
5. Report PDF template refinement based on client feedback
6. Knowledge chunking pipeline for RAG context enrichment
