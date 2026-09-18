# deploy/

Scripts that push the Strategy Engine into a Supabase project. The full
end-to-end procedure for a new client is in `../CLIENT_RUNBOOK.md`; this
folder documents only the pieces that live here.

## Files

| File | What it does |
|---|---|
| `deploy-functions.sh` | Deploys the engine's edge functions with one `supabase functions deploy` call. POSIX shell (Git Bash on Windows works). |
| `deploy-functions.ps1` | Same thing for PowerShell. |

Both scripts read the linked project from `supabase/.temp/project-ref`
(written by `supabase link`, git-ignored) and refuse to run if it is missing.
They never pass `--no-verify-jwt`; the per-function `verify_jwt = false`
lives in `supabase/config.toml` and the CLI applies it.

## Function sets

**Core** (always deployed): `st-nera-query`, `st-ingest-document`,
`st-ingest-survey`, `st-generate-report`, `st-drift-watch`,
`st-synthesise-stage`, `st-purge-engagement`, `st-catalogue`,
`interview-engine-select-prompt`, `interview-engine-extract`,
`interview-engine-evaluate-state`, `interview-engine-summarise-session`.

**Demo tier** (only with `--with-demo-tier` / `-WithDemoTier`):
`st-provision-sandbox`, `st-provision-campaign-user`, `st-campaign-exchange`.
These are the Carlorbiz prospect sandbox and campaign magic-link surfaces.
They are declared in `config.toml` so they deploy correctly when wanted, but
a client project has no use for them and `st_deployment_settings.demo_tiers_enabled`
is false there, so the sandbox path would refuse anyway.

Website-era functions in `supabase/functions/` (`nera-query`, `feedback-chat`,
`process-pdf`, `ingest-url`, …) are never deployed by these scripts.

## Secrets the functions read

Set once per project with `supabase secrets set KEY=value ...` (or the
dashboard, Edge Functions → Secrets). `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are injected by the platform automatically.

| Secret | Required | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | one of the three | any function whose resolved provider is `anthropic` |
| `GOOGLE_API_KEY` | one of the three | provider `google` |
| `OPENAI_API_KEY` | one of the three | provider `openai` |
| `LLM_PROVIDER` | optional | deployment-wide default provider (`anthropic` / `google` / `openai`) when an engagement has no `st_ai_config` row. Defaults to `anthropic`. |
| `LLM_MODEL` | optional | model to pair with `LLM_PROVIDER`. Defaults to a sensible model for that provider. |
| `NERA_ENGINE_URL` | optional | Intelligence Engine bolt-on (`st-catalogue`, `st-generate-report`). Unset = feature off. |
| `NERA_ENGINE_READ_KEY` | optional | read key for the above |
| `SITE_URL` | demo tier only | magic-link redirect base for `st-provision-*` |

## Usage

```bash
# from the repo root, after `supabase login` and `supabase link --project-ref <ref>`
./deploy/deploy-functions.sh --dry-run   # show the plan
./deploy/deploy-functions.sh             # deploy core
```

```powershell
.\deploy\deploy-functions.ps1 -DryRun
.\deploy\deploy-functions.ps1
```

Check the result with `supabase functions list --project-ref <ref>`.

## Migrations

Schema is pushed separately and first: `supabase db push` applies
`supabase/migrations/*.sql` in order (see `supabase/migrations/README.md`).
