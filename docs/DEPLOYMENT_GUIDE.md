# Deployment Guide

Step-by-step guide for deploying a new Nera PWA instance for a client organisation.

## 1. Environment Variables

Create a `.env` file from `.env.example`. The following variables are required:

### Frontend (Vite)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (`https://<project-ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `VITE_NERA_API_URL` | Yes | Nera query edge function URL |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Only if using Map component |

### Edge Functions (Supabase Secrets)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Conditional | Required if `llm_provider` = 'anthropic' |
| `GOOGLE_API_KEY` | Conditional | Required if `llm_provider` = 'google' |
| `OPENAI_API_KEY` | Conditional | Required if `llm_provider` = 'openai' |
| `CLIENT_NAME` | Yes | Organisation name (used in edge function responses) |
| `ADMIN_NOTIFICATION_EMAIL` | Yes | Email for follow-up and feedback admin notifications |

Set edge function secrets via the Supabase CLI:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set CLIENT_NAME="My Organisation"
supabase secrets set ADMIN_NOTIFICATION_EMAIL=admin@example.com
```

## 2. Supabase Project Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Note your project URL and anon key from **Settings > API**
3. Run the schema migrations in the SQL Editor, in order:
   - `supabase_schema.sql` — Base CMS tables
   - `supabase_knowledge_schema.sql` — Knowledge pipeline tables
   - `migrations/ai-config-table.sql` — AI configuration table
   - `migrations/rename-role.sql` — Role standardisation
   - Remaining migration files as needed
4. Enable Row Level Security (RLS) — the schema files include RLS policies
5. Create an admin user in **Authentication > Users**
6. Assign the user a role by inserting into `user_roles`:
   ```sql
   INSERT INTO user_roles (user_id, role)
   VALUES ('<user-uuid>', 'internal_admin');
   ```

## 3. AI Configuration (`ai_config` Table)

Insert a row into the `ai_config` table to configure Nera for this deployment:

```sql
INSERT INTO ai_config (
  llm_provider,
  llm_model,
  system_prompt,
  classify_prompt,
  synonym_map,
  client_name,
  support_contact,
  default_pathway
) VALUES (
  'anthropic',
  'claude-sonnet-4-20250514',
  'You are Nera, an AI assistant for [Organisation]. ...',
  'Classify the following user query...',
  '{"term1": ["synonym1", "synonym2"]}'::jsonb,
  'Organisation Name',
  'support@example.com',
  NULL
);
```

Key decisions:
- **`llm_provider`** — Choose based on client preference/budget. Anthropic Claude recommended for complex reasoning.
- **`system_prompt`** — Must be tailored to the client's domain, tone, and knowledge base.
- **`synonym_map`** — Map domain-specific terminology and acronyms to improve RAG retrieval.

## 4. Brand Configuration

### Colours

Edit `client/src/index.css` CSS custom properties:

```css
--color-brand-dark: oklch(0.25 0.05 250);      /* Header/sidebar */
--color-brand-primary: oklch(0.45 0.15 250);    /* Headings */
--color-brand-accent: oklch(0.55 0.20 150);     /* CTAs/buttons */
--color-brand-accent-hover: oklch(0.50 0.22 150); /* Hover state */
```

### Logo

Replace `client/public/logo.png` with the client's logo. Recommended dimensions: 200x60px, transparent PNG.

### App Title & Metadata

Update in `client/index.html`:
- `<title>` tag
- Meta description
- Favicon

## 5. Edge Function Deployment

Deploy all edge functions to the Supabase project:

```bash
# Link to your Supabase project (one-time)
supabase link --project-ref <project-ref>

# Deploy all functions
supabase functions deploy nera-query
supabase functions deploy feedback-chat
supabase functions deploy generate-insights
supabase functions deploy extract-tab-chunks
supabase functions deploy convert-pdf-to-markdown
supabase functions deploy process-pdf
supabase functions deploy notify-follow-up
```

Verify each function is accessible:

```bash
curl -i https://<project-ref>.supabase.co/functions/v1/nera-query \
  -H "Authorization: Bearer <anon-key>"
```

## 6. Vercel Deployment

1. Push the repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Set the **Root Directory** to `client` (if using monorepo structure)
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_NERA_API_URL`
5. Deploy

### Custom Domain

1. In Vercel, go to **Settings > Domains**
2. Add the client's domain
3. Update DNS records as instructed by Vercel

## Post-Deployment Checklist

- [ ] Admin can log in and access `/admin`
- [ ] Nera responds to queries with domain-relevant answers
- [ ] Decision trees load and navigate correctly
- [ ] PDF viewer renders uploaded documents
- [ ] Feedback interview flow completes end-to-end
- [ ] Follow-up notification emails arrive
- [ ] Brand colours and logo display correctly
- [ ] Mobile responsive layout works
