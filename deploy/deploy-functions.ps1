<#
.SYNOPSIS
  Deploy the Strategy Engine's edge functions to the linked Supabase project.

.EXAMPLE
  .\deploy\deploy-functions.ps1                 # core engine functions
  .\deploy\deploy-functions.ps1 -WithDemoTier   # + provisioning / campaign
  .\deploy\deploy-functions.ps1 -DryRun         # print the plan only

.NOTES
  Prerequisites: `supabase login` and `supabase link --project-ref <ref>` have
  been run from the repo root (deploy/README.md). Per-function verify_jwt comes
  from supabase/config.toml; nothing here passes --no-verify-jwt. Website-era
  functions (nera-query, feedback-chat, process-*, ...) are never deployed.
#>
[CmdletBinding()]
param(
  [switch]$WithDemoTier,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

$CoreFunctions = @(
  'st-nera-query',
  'st-ingest-document',
  'st-ingest-survey',
  'st-generate-report',
  'st-drift-watch',
  'st-synthesise-stage',
  'st-purge-engagement',
  'st-catalogue',
  'interview-engine-select-prompt',
  'interview-engine-extract',
  'interview-engine-evaluate-state',
  'interview-engine-summarise-session'
)
$DemoTierFunctions = @(
  'st-provision-sandbox',
  'st-provision-campaign-user',
  'st-campaign-exchange'
)

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

$refFile = Join-Path $RepoRoot 'supabase/.temp/project-ref'
if (-not (Test-Path $refFile)) {
  throw 'No linked project. Run: supabase link --project-ref <ref>'
}
$ProjectRef = (Get-Content $refFile -Raw).Trim()

$Functions = @($CoreFunctions)
if ($WithDemoTier) { $Functions += $DemoTierFunctions }

Write-Host "Project: $ProjectRef"
Write-Host "Functions ($($Functions.Count)):"
$Functions | ForEach-Object { Write-Host "  $_" }

if ($DryRun) {
  Write-Host '(dry run - nothing deployed)'
  exit 0
}

$supabase = if (Get-Command supabase -ErrorAction SilentlyContinue) { 'supabase' } else { 'npx' }
$prefix = if ($supabase -eq 'npx') { @('supabase') } else { @() }

# One invocation with every name: the CLI bundles ../_shared imports itself and
# reads verify_jwt per function from supabase/config.toml.
& $supabase @prefix functions deploy @Functions --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "supabase functions deploy failed ($LASTEXITCODE)" }

Write-Host ''
Write-Host "Deployed. Confirm with: supabase functions list --project-ref $ProjectRef"
