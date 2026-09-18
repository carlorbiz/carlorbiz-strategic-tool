# Strategy Engine migrations — single source of truth

From 18 Sep 2026 this folder is the **only** migration path for the Strategy
Engine. `supabase db push` applies every `YYYYMMDDHHMMSS_name.sql` file here, in
name order, to whichever project the CLI is linked to. Nothing else needs to be
run by hand.

| Order | File | Origin |
|---|---|---|
| 000 | `20260918000000_base.sql` | Minimal subset of the root `DEFINITIVE_MIGRATION.sql`: extensions, `user_profiles`, `ai_config`, `knowledge_chunks`, `nera_queries`. Website tables are not created. |
| 001–020 | `20260918000001_st_0001_init.sql` … `20260918000020_st_0020_…sql` | Byte-for-byte copies of `migrations/strategic-tool/0001–0020`. |
| 021 | `20260918000021_st_campaign_access_tokens.sql` | Byte-for-byte copy of the former `supabase/migrations/20260714_add_st_campaign_access_tokens.sql`. |
| 022 | `20260918000022_client_deployment_guard.sql` | New. Adds `st_deployment_settings.demo_tiers_enabled` (default **false**) and gates the demo / sandbox tiers from 0012, 0013 and 0018 behind it. |

## Old locations

`migrations/strategic-tool/`, the root `*.sql` files and `legacy-website/` are
kept for history and for the upstream-sync tooling (`.upstream-sync.yml`). They
are **not** applied by the CLI and must not be edited as a way of changing the
schema: add a new timestamped file here instead.

`legacy-website/` holds the two timestamped files that used to sit in this
folder. They were moved because the CLI would otherwise apply
`20260330_add_content_type_to_tabs.sql` first and fail on the missing website
`tabs` table.

## Demo tiers

A fresh project applies the whole bundle and ends with the Carlorbiz demo
tiers switched **off**: `st_is_demo_engagement()` returns false for every row,
`st_sandbox_requests` refuses anonymous inserts, and `supabase/seed/demo/*.sql`
is never run (`[db.seed]` is disabled in `../config.toml`).

Carla's own project turns them back on with

```sql
UPDATE st_deployment_settings SET demo_tiers_enabled = true;
```

followed by the seed files. A client project never does this.

## Notes for the next slice

* `base.sql` carries the website's `"Auth manage user_profiles"` policy
  unchanged (any authenticated user may update any profile row). The engine's
  first-sign-in profile creation depends on its INSERT half; tightening it is a
  follow-up, not a copy-and-order job.
* `0001`, `0002`, `0005`–`0015`, `0017`, `0018`, `0020` and `0022` contain their
  own `BEGIN;`/`COMMIT;`. The CLI already wraps each file in a transaction, so
  Postgres logs `WARNING: there is already a transaction in progress` for those
  files. That is a warning, not an error, and the bundle applies cleanly.
* `0016` and `0019` use `ALTER TYPE … ADD VALUE`. That is allowed inside a
  transaction on Postgres 12+ as long as the new value is not used in the same
  transaction; neither file does.
