# Strategy Engine — client deployment runbook

One client, one Supabase project, one static host, the client's own LLM key.
Nothing in this procedure touches any other project. Budget: about an hour
the first time, less after that.

You need on your machine: Node 20+, Git, Docker is **not** required. Every
`supabase …` command below works as `npx supabase …` from the repo root (the
CLI is a devDependency). Windows: use PowerShell or Git Bash as noted.

Values you will collect as you go (keep them in a password manager, not in the repo):

| Value | Where it comes from |
|---|---|
| `<ref>` | project reference, Supabase dashboard → Project Settings → General |
| `<db-password>` | chosen at project creation (step 1) |
| `<project-url>` | `https://<ref>.supabase.co` |
| `<anon-key>` | Project Settings → API → anon / publishable key |
| `<host>` | where the app will be served, e.g. `https://strategy.client.example` |
| LLM key | the client's Anthropic, Google AI or OpenAI key |

---

## 1. Create the Supabase project (5 min)

1. Sign in to the Supabase dashboard with the account that will own the
   project (the client's, or yours if you hand it over later).
2. New project → name it after the client → set a strong database password
   (`<db-password>`) → **Region: Oceania (Sydney), `ap-southeast-2`** → Create.
3. Wait for it to finish provisioning, then note `<ref>`, `<project-url>` and
   `<anon-key>` from Project Settings.

## 2. Authentication settings (5 min)

Dashboard → Authentication:

* **URL Configuration** → Site URL = `<host>`; Redirect URLs add
  `<host>/login` and `<host>/reset-password` (add `http://localhost:5173/*`
  too if you will run the app locally).
* **Providers → Email**: leave enabled. "Confirm email" on is fine; the app
  signs users in with a magic link or a password.
* Do **not** enable Anonymous sign-ins. That is only for the public demo tiers,
  which a client project does not run.
* The built-in email sender is enough for a handful of users. For more than
  that, set custom SMTP under Project Settings → Authentication → SMTP.

## 3. Get the repo and link it (5 min)

```bash
git clone <this repo> strategy-engine-<client>
cd strategy-engine-<client>
npm install
npx supabase login                      # opens a browser once
npx supabase link --project-ref <ref>   # asks for <db-password>
```

`link` writes the project reference to `supabase/.temp/` (git-ignored). Every
later command runs against this project only.

## 4. Apply the schema (2 min)

```bash
npx supabase db push
```

Applies every file in `supabase/migrations/` in order (see its README).
Expect `WARNING: there is already a transaction in progress` a few times; that
is not an error. Confirm in the dashboard → Table Editor: `st_engagements`,
`knowledge_chunks`, `user_profiles` exist, and Storage shows four `st-*`
buckets.

## 5. Set the edge-function secrets (3 min)

At least one LLM key. If the client holds only one provider's key, also set
`LLM_PROVIDER` so every function uses it.

```bash
# Anthropic-only client
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... LLM_PROVIDER=anthropic

# Google-only client
npx supabase secrets set GOOGLE_API_KEY=AIza... LLM_PROVIDER=google

# OpenAI-only client
npx supabase secrets set OPENAI_API_KEY=sk-... LLM_PROVIDER=openai
```

Optional: `LLM_MODEL=<model>` to pin a model for that provider. Leave
`NERA_ENGINE_URL` / `NERA_ENGINE_READ_KEY` unset unless the client is licensed
for the Intelligence Engine bolt-on. Every variable the build and the
functions read, with one line each and nothing filled in, is
`.env.production.example`.

## 6. Deploy the edge functions (3 min)

```bash
./deploy/deploy-functions.sh          # Git Bash / macOS / Linux
.\deploy\deploy-functions.ps1         # PowerShell
```

Deploys the 12 engine functions with the JWT settings from
`supabase/config.toml`. Check with `npx supabase functions list`.

## 7. Build and host the app (10 min)

Set the build-time values as **environment variables** (the Vite config reads
them from the shell, not from a file), then build. **Build in a clean shell.**
Any `VITE_*` variable already set on the machine is baked into the bundle: on
the 21 Sep 2026 acceptance run a stray `VITE_NERA_API_URL` from another
project ended up inside the client's JavaScript. Check first and clear
anything that is not listed below:

```powershell
Get-ChildItem Env:VITE_*            # PowerShell: should list nothing
```

```bash
env | grep '^VITE_'                 # Bash: should print nothing
```

After the build, confirm the bundle names only this project:
`grep -rhoE "https://[a-z0-9]{20}\.supabase\.co" dist/assets/*.js | sort -u`
must print exactly one line, `<project-url>`.

PowerShell:

```powershell
$env:VITE_SUPABASE_URL      = "<project-url>"
$env:VITE_SUPABASE_ANON_KEY = "<anon-key>"
# brand this build for the client (all optional; MTMOT Strategy Engine
# defaults apply to anything left unset — see .env.production.example):
# $env:VITE_BRAND_PRODUCT_NAME  = "Client Co Strategy Engine"
# $env:VITE_BRAND_SUPPORT_EMAIL = "consulting@yourfirm.example"
# $env:VITE_BRAND_ACCENT_COLOR  = "#C9A96E"
# $env:VITE_BRAND_LOGO          = "/images/client-logo.png"
# optional, only with the Intelligence Engine bolt-on:
# $env:VITE_NERA_ENGINE_URL = "https://engine.example"
# $env:VITE_CATALOGUE_VIA_PROXY = "true"
npx vite build --mode production
Copy-Item dist/index.html dist/404.html
```

Bash:

```bash
export VITE_SUPABASE_URL="<project-url>" VITE_SUPABASE_ANON_KEY="<anon-key>"
# brand this build for the client (all optional — see above / .env.production.example):
# export VITE_BRAND_PRODUCT_NAME="Client Co Strategy Engine" VITE_BRAND_SUPPORT_EMAIL="consulting@yourfirm.example"
npx vite build --mode production && cp dist/index.html dist/404.html
```

Upload the contents of `dist/` to any static host (Cloudflare Pages, Netlify,
Vercel static, S3 + CloudFront, an nginx box). Two requirements:

* every unknown path must serve `index.html` (SPA routing). `dist/404.html`
  covers Cloudflare Pages; Netlify wants `/* /index.html 200` in `dist/_redirects`;
  nginx needs `try_files $uri /index.html;`.
* serve it at `<host>` over HTTPS, the same value used in step 2.

The anon key is public by design; the service-role key never leaves Supabase.
Branding comes from the `VITE_BRAND_*` variables set at build time above, not
from the hostname — every client build carries its own identity regardless of
what domain it's served on. Unset `VITE_BRAND_*` variables fall back to the
MTMOT Strategy Engine defaults (product name, MTMOT logo, gold accent).

## 8. Bootstrap the admin (5 min)

1. Open `<host>/login`, enter your email, request a magic link, and sign in
   once (or Authentication → Users → Invite user in the dashboard, then follow
   the invite). This creates the `auth.users` row.
2. Dashboard → SQL Editor → paste `scripts/bootstrap-admin.sql`, replace
   `admin@example.com` with that email, Run. It should report
   `Created internal_admin profile …` or `Re-keyed profile …`.
3. Reload `<host>`. You should see "No engagements yet. Create your first
   engagement to get started."

## 9. Create the first engagement (5 min)

There is no create-engagement screen in this build yet; use the SQL Editor.
Edit the four values at the top and Run:

```sql
DO $$
DECLARE
  v_name        TEXT := 'Example Org — Strategic Plan 2027–2030';
  v_client      TEXT := 'Example Org';
  v_slug        TEXT := 'example-org';            -- lowercase, hyphens; becomes /e/example-org
  v_admin_email TEXT := 'admin@example.com';      -- the admin from step 8
  v_admin_id    UUID;
  v_eng         UUID;
BEGIN
  SELECT id INTO v_admin_id FROM user_profiles
  WHERE lower(email) = lower(v_admin_email) AND role = 'internal_admin';
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No internal_admin profile for % (run scripts/bootstrap-admin.sql first)', v_admin_email;
  END IF;

  INSERT INTO st_engagements (name, client_name, slug, status, type, profile_key, created_by)
  VALUES (v_name, v_client, v_slug, 'active', 'strategic_planning', 'strategic-planning', v_admin_id)
  RETURNING id INTO v_eng;

  INSERT INTO st_engagement_roles (engagement_id, role_key, label, permissions) VALUES
    (v_eng, 'client_admin',     'Client admin',     '{"admin": true}'::jsonb),
    (v_eng, 'board_member',     'Board member',     '{}'::jsonb),
    (v_eng, 'operational_lead', 'Operational lead', '{}'::jsonb);

  INSERT INTO st_ai_config (engagement_id, profile_key) VALUES (v_eng, 'strategic-planning');

  RAISE NOTICE 'Engagement % created: /e/% (id %)', v_name, v_slug, v_eng;
END $$;
```

Reload `<host>`: the engagement is listed. Open it: the Settings tab holds
the vocabulary. To pin a provider/model for this engagement only (instead of
the project-wide `LLM_PROVIDER` secret), set it in SQL:
`update st_ai_config set llm_provider = 'google', llm_model = 'gemini-2.5-flash' where engagement_id = '<id>';`.
Report templates are created under
the Templates tab (admins only); the two global drift-detection templates can be
loaded by running `supabase/seed/templates/generic-drift-detection.sql` and
`sovereignty-drift-detection.sql` in the SQL Editor.

## 10. Add client users (2 min each)

1. The person signs in once at `<host>/login` (magic link) or is invited from
   Authentication → Users.
2. SQL Editor → `scripts/grant-engagement-role.sql`, set the email, the
   engagement id (from step 9's notice, or `select id, name from st_engagements`)
   and the role key (`client_admin`, `board_member`, `operational_lead`), Run.

They now see exactly that engagement and nothing else.

## 11. Smoke test (5 min)

* Upload a small PDF, or a CSV/XLSX/JSON survey, under Documents/Surveys →
  status goes `ingesting` → `ingested` and a chunk count appears. Both are
  parsed in the browser — the source file never reaches Supabase storage; if
  you check Storage → `st-documents` / `st-surveys` for a text-based upload,
  it will be empty. (Images are not accepted — the uploader rejects them with
  an explanation before anything is sent, since there is no image-reading
  path yet.) If ingestion fails with a provider or key message, re-check
  step 5 (`npx supabase secrets list`).
* Ask Nera one question in the engagement; an answer streams back.
* The Tools tab is absent (expected unless the bolt-on is configured).

---

## Purging an engagement

Every derived or uploaded artefact for one engagement — documents, chunks,
survey responses, interview transcripts, reports, drift analyses, and any
stored files — can be removed in one action, either at handover (once the
client has their own copy) or at end-of-engagement teardown, in front of the
client if they want to watch it happen.

1. Sign in as an `internal_admin` and open the engagement's Settings tab.
2. Scroll to "Purge this engagement" (only visible to `internal_admin` — a
   client's own `client_admin` cannot trigger this). Click **Purge engagement
   data**.
3. Type the engagement's exact name into the confirmation field — it must
   match exactly, character for character, or the button stays disabled.
4. Confirm. The page shows a receipt: total rows deleted, tables touched,
   stored files removed, and a timestamp. The receipt itself never contains
   client content (no chunk text, no summaries, no verbatims) — it is safe to
   show or forward to the client as proof of deletion.
5. To verify independently: `scripts/check-purge-complete.sql` in the SQL
   Editor, with the engagement's id set at the top, enumerates every table
   from `information_schema` (not a hand list) and confirms zero rows remain
   for that engagement anywhere. Expect `PASS` in the output.

The purge removes rows; it does not delete the engagement record itself (so
the receipt has something to point at) or the Supabase project. For a full
teardown, follow it with **Tear down** below.

## Handover or teardown

* **Hand over**: Project Settings → General → Transfer project, into the
  client's organisation. Supabase's conditions (checked against its Project
  Transfers guide, 21 Sep 2026): you must be the **Owner** of the organisation
  the project is in now and at least a **member** of the client's organisation
  (they invite you first; they can remove you afterwards); the project must
  have no active GitHub integration and no log drains; and if the client's
  organisation is on the Free Plan it must have room under the two-active-
  project limit, and the project loses paid-plan features (no pausing
  protection, no daily backups) on arrival, with a minute or two of downtime.
  The simpler path, and the one to prefer: the client creates the project in
  their own organisation at step 1 and invites you as a member for the build,
  so nothing ever has to move.
  Give them the repo copy and this file. Rotate the LLM key if it was yours.
  If you (not the client) held the working copy of the engagement's evidence
  in your own account at any point, purge it first (see "Purging an
  engagement" above) once the client confirms they have what they need.
* **Tear down**: purge the engagement first (see above) if you want a receipt
  of what was removed before the project itself goes; then Project Settings
  → General → Delete project. Everything (database, storage, functions,
  secrets) goes with it; the static host is deleted separately.

## Things this build does not do yet

* No engagement-creation or user-invite screens (steps 9-10 are SQL).
* Image files are not accepted anywhere (documents or surveys) — there is no
  image-reading path in the shared LLM helper for any provider yet. The
  uploader rejects them with an explanation before any upload happens.
* No scheduled/automatic re-ingestion — everything is uploaded and triggered
  by hand.
