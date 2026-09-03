# CC-231 — Key-gating the Intelligence Engine catalogue

The Strategy Engine reads the Nera Intelligence Engine catalogue
(`/api/catalogue/*` on `nera-api`) live, per engagement. Until now that read
was public. Setting `ENGINE_READ_KEY` on the engine gates it; from then on the
browser cannot read it directly, so reads go through the `st-catalogue` edge
function, which holds the key server-side.

**The key value is generated once, on the machine you run these from, and is
never pasted into chat, Notion, a commit, or a `VITE_*` variable.** A
`VITE_*` var is public by construction.

Generate it once and keep it in the shell for the two commands below:

```bash
KEY=$(openssl rand -hex 32)
```

## 1. Set the key on the engine (Cloud Run)

```bash
gcloud run services update nera-api \
  --region australia-southeast2 \
  --project n8n-railway-integration-477211 \
  --update-env-vars ENGINE_READ_KEY=$KEY
```

`--update-env-vars` adds or changes this one variable and leaves every other
env var on the service alone. **Never use `--set-env-vars`** — it replaces
the whole set and wipes the engine's other variables (same trap as the Lake
`deploy.sh` env wipe).

The engine keeps serving its own `/console` demo (same-origin reads bypass the
key), and `st-generate-report` keeps working as long as step 2 is done.

## 2. Give the edge functions the same key (Supabase)

```bash
supabase secrets set NERA_ENGINE_READ_KEY=$KEY --project-ref lgcmjneodjrtjtwbomsj
```

Both `st-generate-report` (report grounding, already reads
`NERA_ENGINE_READ_KEY`) and `st-catalogue` (browser proxy) pick this up on
their next invocation; no redeploy is needed for functions already deployed.

## 3. Deploy the proxy

```bash
supabase functions deploy st-catalogue --no-verify-jwt --project-ref lgcmjneodjrtjtwbomsj
```

`--no-verify-jwt` is the in-repo convention: the function verifies the
caller's JWT itself via `auth.getUser()`, which is what lets anonymous demo
sessions through.

## 4. Switch the client to the proxy

In the client environment (Cloudflare Pages / Vercel project env, and
`.env.production` locally):

```
VITE_CATALOGUE_VIA_PROXY=true
```

Rebuild and deploy the client. With the flag unset or anything other than
`true`, `toolCatalogueApi.ts` keeps calling the engine directly, exactly as
before, so nothing changes until you flip it.

Order matters only in one direction: do step 4 before step 1 if you want zero
downtime (the proxy works whether or not the engine is gated). Doing step 1
before step 4 means the Tool Intelligence panel shows a 401 until the client
redeploys.

## What the proxy allows

`st-catalogue` is not an open proxy. It forwards exactly two GET reads:

| Client call                                | Proxy sub-path                     | Engine route                              |
| ------------------------------------------ | ---------------------------------- | ----------------------------------------- |
| `fetchCatalogueVendors()`                  | `/st-catalogue/vendors`            | `GET /api/catalogue/vendors`              |
| `fetchCatalogueVendorDetail(slug, limit)`  | `/st-catalogue/vendors/<slug>`     | `GET /api/catalogue/vendors/<slug>`       |

Only `chunk_limit` (1–200) is forwarded as a query parameter on the detail
route. `POST /api/catalogue/context` is not proxied: it is a server-side read
that `st-generate-report` performs with the secret directly.

## Rotating the key

Repeat steps 1 and 2 with a new value. There is a brief window between the two
where reads 401; run them back to back.
