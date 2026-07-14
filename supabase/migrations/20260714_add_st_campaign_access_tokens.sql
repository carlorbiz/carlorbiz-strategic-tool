-- CC: 96-hour REUSABLE campaign access credential (prefetch-proof, weekend-safe).
-- Replaces the single-use magic link that corporate email scanners consume
-- before the respondent's /verify completes ("One-time token not found").
-- Applied to lgcmjneodjrtjtwbomsj via Supabase MCP apply_migration.
create table if not exists public.st_campaign_access_tokens (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text unique not null,
  user_id       uuid not null,
  engagement_id uuid not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz null
);

create index if not exists idx_st_campaign_access_tokens_hash
  on public.st_campaign_access_tokens (token_hash);

-- Service-role only. The token hash must never be client-readable.
alter table public.st_campaign_access_tokens enable row level security;
-- No policies: RLS with zero policies denies all non-service-role access.
