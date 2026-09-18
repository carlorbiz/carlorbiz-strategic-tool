#!/usr/bin/env bash
# =============================================================================
# Deploy the Strategy Engine's edge functions to the linked Supabase project.
#
#   ./deploy/deploy-functions.sh                  # core engine functions
#   ./deploy/deploy-functions.sh --with-demo-tier # + provisioning / campaign
#   ./deploy/deploy-functions.sh --dry-run        # print the plan only
#
# Prerequisites: `supabase login` and `supabase link --project-ref <ref>` have
# been run from the repo root (deploy/README.md). Per-function verify_jwt
# comes from supabase/config.toml; nothing here passes --no-verify-jwt.
# Website-era functions (nera-query, feedback-chat, process-*, ...) are never
# deployed by this script.
# =============================================================================
set -euo pipefail

CORE_FUNCTIONS=(
  st-nera-query
  st-ingest-document
  st-ingest-survey
  st-generate-report
  st-drift-watch
  st-synthesise-stage
  st-purge-engagement
  st-catalogue
  interview-engine-select-prompt
  interview-engine-extract
  interview-engine-evaluate-state
  interview-engine-summarise-session
)

DEMO_TIER_FUNCTIONS=(
  st-provision-sandbox
  st-provision-campaign-user
  st-campaign-exchange
)

WITH_DEMO_TIER=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --with-demo-tier) WITH_DEMO_TIER=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if command -v supabase >/dev/null 2>&1; then
  SUPABASE=(supabase)
else
  SUPABASE=(npx supabase)   # the CLI is a devDependency of this repo
fi

if [[ ! -f supabase/.temp/project-ref ]]; then
  echo "No linked project. Run: supabase link --project-ref <ref>" >&2
  exit 1
fi
PROJECT_REF="$(<supabase/.temp/project-ref)"

FUNCTIONS=("${CORE_FUNCTIONS[@]}")
if [[ $WITH_DEMO_TIER -eq 1 ]]; then
  FUNCTIONS+=("${DEMO_TIER_FUNCTIONS[@]}")
fi

echo "Project: $PROJECT_REF"
echo "Functions (${#FUNCTIONS[@]}):"
printf '  %s\n' "${FUNCTIONS[@]}"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "(dry run — nothing deployed)"
  exit 0
fi

# One invocation with every name: the CLI bundles ../_shared imports itself and
# reads verify_jwt per function from supabase/config.toml.
"${SUPABASE[@]}" functions deploy "${FUNCTIONS[@]}" --project-ref "$PROJECT_REF"

echo
echo "Deployed. Confirm with: supabase functions list --project-ref $PROJECT_REF"
