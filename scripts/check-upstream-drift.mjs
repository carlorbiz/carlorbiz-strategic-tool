#!/usr/bin/env node
/**
 * scripts/check-upstream-drift.mjs
 *
 * Reads .upstream-sync.yml and reports drift between this repo and the
 * carlorbiz-website upstream snapshot it was forked from.
 *
 * Usage:
 *   node scripts/check-upstream-drift.mjs                  # report only
 *   node scripts/check-upstream-drift.mjs --json           # machine output
 *   node scripts/check-upstream-drift.mjs --apply <path>   # pull a specific
 *                                                          # upstream-ahead file
 *                                                          # forward into our tree
 *
 * Requirements:
 *   - The upstream repo must be checked out locally at the path given by
 *     `upstream.local_path` in the manifest. (Remote-fetch mode is a
 *     planned addition; not implemented yet.)
 *   - Both repos must be clean git checkouts (this script invokes git
 *     plumbing commands; no working-tree edits unless --apply is passed).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import picomatch from 'picomatch';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(REPO_ROOT, '.upstream-sync.yml');

// ──────────────────────────────────────────────────────────────────────────
// CLI args
// ──────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flagJson = args.includes('--json');
const applyIdx = args.indexOf('--apply');
const applyPath = applyIdx >= 0 ? args[applyIdx + 1] : null;

// ──────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ──────────────────────────────────────────────────────────────────────────
function git(cwd, ...gitArgs) {
  try {
    return execFileSync('git', gitArgs, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function gitLines(cwd, ...gitArgs) {
  const out = git(cwd, ...gitArgs);
  return out ? out.split('\n').filter(Boolean) : [];
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`✖ manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }
  return yaml.load(readFileSync(MANIFEST_PATH, 'utf8'));
}

function buildMatcher(globs) {
  if (!globs || globs.length === 0) return () => false;
  return picomatch(globs, { dot: true });
}

// Classify a path against the manifest. First-match wins:
// local_only -> diverged -> shared -> untracked
function classify(path, matchers) {
  if (matchers.local_only(path)) return 'local_only';
  if (matchers.diverged(path)) return 'diverged';
  if (matchers.shared(path)) return 'shared';
  return 'untracked';
}

// Get the blob SHA git would assign to a path's content in a given repo,
// reading from a tree-ish (HEAD, a commit SHA, or "WORKTREE" for the
// working copy).
function blobShaAt(cwd, path, treeish) {
  if (treeish === 'WORKTREE') {
    const full = join(cwd, path);
    if (!existsSync(full)) return null;
    return git(cwd, 'hash-object', '--', path);
  }
  return git(cwd, 'rev-parse', '--verify', `${treeish}:${path}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
const manifest = loadManifest();
const upstreamPathRel = manifest.upstream?.local_path;
const pinnedSha = manifest.upstream?.pinned_sha;

if (!upstreamPathRel || !pinnedSha) {
  console.error('✖ manifest missing upstream.local_path or upstream.pinned_sha');
  process.exit(1);
}

const upstreamRoot = resolve(REPO_ROOT, upstreamPathRel);
if (!existsSync(join(upstreamRoot, '.git'))) {
  console.error(`✖ upstream checkout not found at: ${upstreamRoot}`);
  console.error(`  Clone carlorbiz-website there or update upstream.local_path in .upstream-sync.yml`);
  process.exit(1);
}

const upstreamHead = git(upstreamRoot, 'rev-parse', 'HEAD');
const upstreamHeadShort = upstreamHead?.slice(0, 7) ?? '???????';
const pinnedShort = pinnedSha.slice(0, 7);
const upstreamCommitsSincePin = git(upstreamRoot, 'rev-list', '--count', `${pinnedSha}..HEAD`) ?? '?';

const matchers = {
  local_only: buildMatcher(manifest.local_only ?? []),
  diverged: buildMatcher(manifest.diverged ?? []),
  shared: buildMatcher(manifest.shared ?? []),
};

// ── Apply mode (single file pull-forward) ───────────────────────────────
if (applyPath) {
  const cls = classify(applyPath, matchers);
  if (cls !== 'shared') {
    console.error(`✖ refusing to --apply on path classified as "${cls}": ${applyPath}`);
    console.error('  Only "shared" paths can be pulled forward via --apply.');
    process.exit(1);
  }
  // Use git's checkout to grab the upstream HEAD blob and write it into our
  // working copy. We do it via a temp file to avoid touching the upstream's
  // working tree. We bypass the normal git() helper because it .trim()s
  // output, which would strip any trailing newline from the blob and break
  // byte-for-byte equality with the upstream tree.
  let blob;
  try {
    blob = execFileSync('git', ['cat-file', '-p', `HEAD:${applyPath}`], {
      cwd: upstreamRoot,
      encoding: 'utf8',
    });
  } catch {
    console.error(`✖ upstream HEAD has no file at: ${applyPath}`);
    process.exit(1);
  }
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const target = join(REPO_ROOT, applyPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, blob);
  console.log(`✔ pulled ${applyPath} forward from upstream HEAD (${upstreamHeadShort})`);
  console.log('  Review the change with:  git diff -- ' + applyPath);
  process.exit(0);
}

// ── Report mode ─────────────────────────────────────────────────────────
const ourFiles = new Set(gitLines(REPO_ROOT, 'ls-files'));
const upstreamHeadFiles = new Set(gitLines(upstreamRoot, 'ls-files'));
const upstreamPinnedFiles = new Set(
  gitLines(upstreamRoot, 'ls-tree', '-r', '--name-only', pinnedSha)
);

const allPaths = new Set([
  ...ourFiles,
  ...upstreamHeadFiles,
  ...upstreamPinnedFiles,
]);

const buckets = {
  identical: [],          // we == upstreamHead (no action)
  upstream_ahead: [],     // we == pinned, upstreamHead != pinned (safe pull)
  local_ahead: [],        // we != pinned, upstreamHead == pinned (we modified shared file)
  both_diverged: [],      // we != pinned && upstreamHead != pinned && we != upstreamHead
  new_upstream: [],       // upstream added a file matching shared globs that we don't have
  removed_upstream: [],   // upstream deleted a file we still have
  diverged: [],           // intentionally forked (informational)
  diverged_upstream_changed: [], // forked + upstream also moved (worth knowing)
  untracked_in_ours: [],  // exists here, no manifest classification
  untracked_in_upstream: [], // exists upstream, no manifest classification
};

for (const path of allPaths) {
  const cls = classify(path, matchers);

  if (cls === 'local_only') continue; // ignore entirely

  const inOurs = ourFiles.has(path);
  const inUpstreamHead = upstreamHeadFiles.has(path);

  if (cls === 'diverged') {
    if (inOurs && inUpstreamHead) {
      const ourHash = blobShaAt(REPO_ROOT, path, 'WORKTREE');
      const upstreamHeadHash = blobShaAt(upstreamRoot, path, 'HEAD');
      if (ourHash !== upstreamHeadHash) {
        buckets.diverged_upstream_changed.push(path);
      } else {
        buckets.diverged.push(path);
      }
    } else {
      buckets.diverged.push(path);
    }
    continue;
  }

  if (cls === 'untracked') {
    if (inOurs) buckets.untracked_in_ours.push(path);
    if (inUpstreamHead && !inOurs) buckets.untracked_in_upstream.push(path);
    continue;
  }

  // cls === 'shared'
  const ourHash = inOurs ? blobShaAt(REPO_ROOT, path, 'WORKTREE') : null;
  const upstreamHeadHash = inUpstreamHead
    ? blobShaAt(upstreamRoot, path, 'HEAD')
    : null;
  const upstreamPinnedHash = upstreamPinnedFiles.has(path)
    ? blobShaAt(upstreamRoot, path, pinnedSha)
    : null;

  if (!ourHash && upstreamHeadHash) {
    buckets.new_upstream.push(path);
    continue;
  }
  if (ourHash && !upstreamHeadHash) {
    buckets.removed_upstream.push(path);
    continue;
  }
  if (ourHash === upstreamHeadHash) {
    buckets.identical.push(path);
    continue;
  }
  // both exist, hashes differ
  if (ourHash === upstreamPinnedHash) {
    buckets.upstream_ahead.push(path);
  } else if (upstreamHeadHash === upstreamPinnedHash) {
    buckets.local_ahead.push(path);
  } else {
    buckets.both_diverged.push(path);
  }
}

// ── Output ──────────────────────────────────────────────────────────────
if (flagJson) {
  console.log(JSON.stringify({
    upstream: {
      pinned: pinnedShort,
      head: upstreamHeadShort,
      commits_since_pin: Number(upstreamCommitsSincePin),
    },
    buckets,
  }, null, 2));
  process.exit(0);
}

const c = (s, code) => `\x1b[${code}m${s}\x1b[0m`;
const bold = (s) => c(s, '1');
const dim = (s) => c(s, '2');
const red = (s) => c(s, '31');
const green = (s) => c(s, '32');
const yellow = (s) => c(s, '33');
const cyan = (s) => c(s, '36');

console.log('');
console.log(bold('Upstream sync drift report'));
console.log(dim(`  pinned:  ${pinnedShort}`));
console.log(dim(`  HEAD:    ${upstreamHeadShort}  (${upstreamCommitsSincePin} commits ahead of pin)`));
console.log('');

const summary = [
  ['identical',                buckets.identical.length,                green],
  ['upstream-ahead (safe pull)', buckets.upstream_ahead.length,         cyan],
  ['new in upstream',          buckets.new_upstream.length,             cyan],
  ['removed in upstream',      buckets.removed_upstream.length,         yellow],
  ['locally modified shared',  buckets.local_ahead.length,              yellow],
  ['both diverged (conflict)', buckets.both_diverged.length,            red],
  ['diverged (intentional)',   buckets.diverged.length,                 dim],
  ['diverged + upstream moved', buckets.diverged_upstream_changed.length, yellow],
  ['untracked in ours',        buckets.untracked_in_ours.length,        dim],
  ['untracked in upstream',    buckets.untracked_in_upstream.length,    dim],
];

const labelWidth = Math.max(...summary.map(([l]) => l.length));
for (const [label, count, color] of summary) {
  if (count === 0) {
    console.log(dim(`  ${label.padEnd(labelWidth)}  0`));
  } else {
    console.log(`  ${label.padEnd(labelWidth)}  ${color(String(count))}`);
  }
}
console.log('');

function listBucket(name, paths, color, hint) {
  if (paths.length === 0) return;
  console.log(bold(color(`${name} (${paths.length}):`)));
  if (hint) console.log(dim(`  ${hint}`));
  for (const p of paths.slice(0, 30)) console.log(`  ${p}`);
  if (paths.length > 30) console.log(dim(`  ... and ${paths.length - 30} more`));
  console.log('');
}

listBucket('UPSTREAM AHEAD — safe to pull forward', buckets.upstream_ahead, cyan,
  'These files are unchanged locally but newer upstream. Run npm run sync:apply -- <path>');
listBucket('NEW IN UPSTREAM', buckets.new_upstream, cyan,
  'Upstream added these files. Decide if they belong here, then run sync:apply or add to local_only.');
listBucket('REMOVED IN UPSTREAM', buckets.removed_upstream, yellow,
  'Upstream deleted these files. Consider deleting locally or moving to local_only.');
listBucket('LOCALLY MODIFIED SHARED — review', buckets.local_ahead, yellow,
  'You changed a "shared" file. Either move it to "diverged" or upstream the change.');
listBucket('BOTH DIVERGED — conflict, manual review needed', buckets.both_diverged, red,
  'Both we and upstream changed this file since the pin. Diff with upstream and merge by hand.');
listBucket('DIVERGED + UPSTREAM MOVED — informational', buckets.diverged_upstream_changed, yellow,
  'Files we forked that upstream has now also changed. Worth a peek to see if anything is worth lifting.');
listBucket('UNTRACKED IN OURS', buckets.untracked_in_ours, dim,
  'Files in this repo not classified by the manifest. Add to local_only / shared / diverged.');
listBucket('UNTRACKED IN UPSTREAM', buckets.untracked_in_upstream, dim,
  'Files in upstream not classified. Add to shared (to track) or ignore.');

const blockers = buckets.both_diverged.length + buckets.local_ahead.length;
const opportunities = buckets.upstream_ahead.length + buckets.new_upstream.length;
console.log(bold(`Summary: ${opportunities} pull-forward opportunities, ${blockers} files needing review.`));
console.log('');

process.exit(blockers > 0 ? 0 : 0); // never fail; this is a report, not a gate
