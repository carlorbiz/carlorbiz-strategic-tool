# Carlorbiz Strategic Planning Toolkit

**Progressive Web Application for Strategic Planning, Workshop Facilitation, and Report Generation**

A commercial-grade platform that supports the full arc of strategic planning: pre-meeting stakeholder input via Nera-conversation, live facilitated Board workshops with real-time decision modelling, and polished report generation — all in a single reusable platform.

---

## Architecture

Built on the proven Carlorbiz infrastructure stack:

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **AI**: Anthropic Claude / Google Gemini / OpenRouter (multi-LLM abstraction)
- **Hosting**: Cloudflare Pages (frontend) + Supabase Edge Functions (backend)
- **PWA**: Service worker for offline workshop operation

---

## Three-Stage Strategic Planning Arc

### Stage 1 — Intelligence Briefing
Static strategic plan display with interactive Recharts visualisations, Victoria regional map, and PDF export. Serves as the evidence base for Board preparation.

### Stage 1.5 — Pre-Meeting Stakeholder Engagement
Nera-conversation chatbot that draws out richer stakeholder input through guided dialogue — not a traditional survey. Persistent sessions allow participants to return over days or weeks and continue adding to their own content. All input feeds directly into Stage 2 workshop sessions as source material for the decision engine and AI chatbot.

### Stage 2 — Live Workshop Facilitation
Real-time facilitation interface with:
- **QR Code Upload**: Participants scan to upload photos of sticky notes, whiteboards
- **OCR Processing**: AI-powered text extraction with SWOT categorisation
- **Decision Engine**: Record, categorise, and approve strategic decisions (HIGH/MEDIUM/LOW priority)
- **AI Chatbot**: Three distinct functions — question answering, SWOT categorisation, narrative summary generation
- **Report Export**: Board-approved strategy document (PDF) capturing all decisions, impact analysis, and prioritised initiatives

### Stage 3 — Admin Panel
Authenticated admin UI to load and edit strategic plan data, configure branding, and manage workshop sessions — making the toolkit fully reusable for different clients.

---

## Setup

### Prerequisites
- Node.js 18+ and pnpm
- Supabase project (with Edge Functions enabled)
- Anthropic API key or OpenRouter API key (and optionally Gemini for OCR)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=Carlorbiz Strategic Planning Toolkit
```

Edge function secrets (set via Supabase Dashboard or CLI):
```bash
ANTHROPIC_API_KEY=sk-ant-...
# OR
OPENROUTER_API_KEY=sk-or-...
# AND/OR
GEMINI_API_KEY=AI...
```

### Database Setup

Run `supabase_schema.sql` in the Supabase SQL Editor to create all tables, indexes, RLS policies, and storage buckets.

### Development

```bash
pnpm install
pnpm dev
```

### Deployment

**Frontend (Cloudflare Pages):**
```bash
pnpm build
# Deploy dist/ to Cloudflare Pages
```

**Edge Functions (Supabase):**
```bash
supabase functions deploy nera-premeeting
supabase functions deploy workshop-ai
supabase functions deploy workshop-ocr
supabase functions deploy generate-report
```

---

## Key Files

```
client/src/
  pages/
    Home.tsx              → Landing page with three-stage overview
    Briefing.tsx          → Stage 1: Intelligence Briefing
    PreMeeting.tsx        → Stage 1.5: Nera-conversation stakeholder engagement
    Workshop.tsx          → Stage 2: Live workshop facilitation
    WorkshopJoin.tsx      → QR code endpoint for participant photo upload
    AdminDashboard.tsx    → Stage 3: Admin panel
  contexts/
    AuthContext.tsx        → Supabase auth with role-based access
  lib/
    supabase.ts           → Supabase client
    neraApi.ts            → Nera AI streaming API client
shared/
  types.ts                → Shared TypeScript types
supabase/
  functions/
    nera-premeeting/      → Pre-meeting Nera-conversation edge function
    workshop-ai/          → Workshop AI chatbot (3 functions)
    workshop-ocr/         → Photo OCR with SWOT categorisation
    generate-report/      → Board strategy document generation
    _shared/llm.ts        → Multi-LLM abstraction
supabase_schema.sql       → Full database schema with RLS
client/public/data/       → Strategic plan JSON data files
legacy/                   → Archived V1 static HTML/JS (reference only)
```

---

## Constraints

- The session owner is **Carla**; this name is used in all facilitator notification copy.
- Priority column labels use the exact values: **HIGH**, **MEDIUM**, **LOW**.
- The pre-meeting chatbot is a **Nera-conversation** feature — not a traditional survey.
- Pre-meeting stakeholder input has a hard data pathway into Stage 2 workshop and decision engine.
- The AI chatbot in the facilitator interface serves three distinct functions: answering questions, SWOT categorisation, and narrative summary generation.

---

## Acknowledgements

**Country Acknowledgement:**
We acknowledge the Traditional Owners of the lands on which RWAV operates across Victoria, and pay our respects to Elders past, present, and emerging. We recognise the ongoing connection of Aboriginal and Torres Strait Islander peoples to Country, culture, and community.

**Pilot Community Traditional Owners:**
- **Bendigo Region**: Dja Dja Wurrung people
- **Gippsland Lakes Region**: Gunaikurnai people
- **Mallee Region**: Wergaia people

---

## Licence

Proprietary — Carlorbiz Pty Ltd. All rights reserved.

**Individual Section System** | **Cultural Engagement Methodology**

Developed by Carla Taylor, Carlorbiz.
