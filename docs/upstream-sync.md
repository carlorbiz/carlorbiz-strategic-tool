# Upstream sync workflow

Strategic-tool was forked from [carlorbiz-website](https://github.com/carlorbiz/carlorbiz-website) on 10 Apr 2026 as a snapshot, not a git subtree. This doc explains how we keep the snapshot maintained as upstream evolves.

## TL;DR

```bash
# Periodic check — what's drifted?
npm run sync:check

# Pull a specific upstream-ahead file forward into our tree
npm run sync:apply -- <path>

# Then review and commit
git diff -- <path>
git add <path>
git commit -m "sync: pull forward <path> from upstream"
```

## Why a snapshot, not a subtree

The strategic-tool will diverge significantly from carlorbiz-website over time:

- New pages (`Engagement`, `StageEditor`, `DeliverableView`)
- New schema (`st_*` tables)
- New edge functions (`st-*`)
- A different frontend deployment target (its own Cloudflare Pages site)

A git subtree would force every upstream merge to navigate around our additions. The manifest-driven snapshot model lets us declare which paths are still "shared" with upstream, which we've intentionally "diverged", and which are "local_only" — and the drift check tells us, file-by-file, what's worth pulling forward.

## The manifest

[`.upstream-sync.yml`](../.upstream-sync.yml) is the source of truth. It has three buckets:

| Bucket | Meaning | Drift script behaviour |
|---|---|---|
| `local_only` | File exists only here, OR exists upstream but we want to ignore it | Skipped entirely |
| `diverged` | File exists in both but we forked it intentionally — we will not pull upstream changes | Reported if upstream also moved (informational), never suggested for `--apply` |
| `shared` | File should match upstream | Reported as `upstream_ahead` if upstream moved and we didn't, `local_ahead` if we moved and upstream didn't, `both_diverged` if both moved |

Anything matched by none is reported as `untracked` so you can decide which bucket it belongs in.

## What `npm run sync:check` does

1. Reads the manifest.
2. Reads the local upstream checkout at `upstream.local_path` (default `../carlorbiz-website`).
3. Lists every file in our repo, upstream HEAD, and the pinned snapshot SHA.
4. Classifies each path through the manifest.
5. For `shared` paths, computes the git blob SHA in three places — our worktree, upstream HEAD, upstream pinned — and buckets the path:

   | Bucket | Meaning | Action |
   |---|---|---|
   | `identical` | We match upstream HEAD | Nothing to do |
   | `upstream_ahead` | We match the pinned SHA, upstream HEAD has moved | **Safe to pull forward** with `sync:apply` |
   | `local_ahead` | We diverged from the pin, upstream HEAD still matches the pin | We changed a shared file — either upstream the change, or move the path to `diverged:` |
   | `both_diverged` | Everyone moved | Manual merge required |
   | `new_upstream` | File is in upstream HEAD but not in our worktree | Decide whether to pull it in or add to `local_only:` |
   | `removed_upstream` | File is in our worktree but upstream HEAD no longer has it | Decide whether to delete locally or move to `local_only:` |

6. Prints a summary report. The script never modifies files in report mode.

## What `npm run sync:apply -- <path>` does

Reads the upstream HEAD blob for the given path and writes it into our worktree, overwriting whatever was there. Refuses if the path isn't classified as `shared`.

After applying, review the change with `git diff`, run the build to make sure nothing breaks, and commit.

## Updating the snapshot pin

When you've pulled forward enough upstream changes that the pinned SHA no longer reflects "what we last fully synced from", update the pin:

```bash
# Check what upstream HEAD is right now
git -C ../carlorbiz-website rev-parse HEAD

# Update .upstream-snapshot and .upstream-sync.yml with the new SHA
# and a new pinned_at date.
```

The pin is what `local_ahead` vs `both_diverged` distinguishes against, so updating it after every sync session makes future drift reports cleaner.

## When to run it

- **Weekly** at minimum — see [scheduled drift checks](#scheduled-drift-checks) below.
- **After any Nera prompt or RAG change** in carlorbiz-website — those are the highest-value pull-forwards.
- **Before starting a new strategic-tool feature** that touches the chat stack, design tokens, or Supabase plumbing.
- **Before tagging a strategic-tool release**.

## Scheduled drift checks

The repeating workflow is set up via the Claude Code `/schedule` skill (a remote agent that runs the check on a cron and posts a summary to Notion or Slack). To create or update it, ask Claude Code: *"set up a weekly drift check for carlorbiz-strategic-tool"*.

## Maintaining the manifest

When you add a new strategic-tool-only file (a new page, a new edge function), add its glob to `local_only:` in [.upstream-sync.yml](../.upstream-sync.yml). The drift script will then ignore it.

When you intentionally edit a file that was `shared:`, you have two choices:

1. **The change should go upstream** — leave it `shared:`, the script will flag it as `local_ahead`, and you submit a PR to carlorbiz-website. After it lands upstream, our local edit will become `identical`.
2. **The change is strategic-tool-specific** — promote the path from `shared:` to `diverged:`. The script will stop suggesting upstream changes for it.

Avoid leaving files in `local_ahead` for long. Either upstream them or fork them.

## Limitations / future work

- Remote-fetch mode (`--remote` to fetch upstream from GitHub instead of reading a local checkout) is not yet implemented. The manifest assumes you have carlorbiz-website cloned locally at the path given by `upstream.local_path`.
- The drift check is by-file, not by-symbol — if upstream extracts a function and our copy still inlines it, we won't notice unless the file content changes too. For now this is acceptable; if it bites, we can add a smarter diff later.
