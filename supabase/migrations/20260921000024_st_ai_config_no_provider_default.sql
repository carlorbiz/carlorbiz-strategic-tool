-- Acceptance run, 21 Sep 2026 (CC-347): on a fresh Google-only client project
-- every ingest failed with "No API key configured for LLM provider: anthropic".
-- st_ai_config.llm_provider / llm_model carried column defaults ('anthropic' /
-- a Claude model), so any row inserted without naming them read as an explicit
-- per-engagement override and beat the project-wide LLM_PROVIDER secret
-- (_shared/interview-engine-helpers.ts, resolveLLMConfigFromRow).
-- NULL now means "not chosen here": the secret, then the function default, decide.
-- Existing rows are left as they are; only new rows stop inheriting a provider.
ALTER TABLE st_ai_config
  ALTER COLUMN llm_provider DROP DEFAULT,
  ALTER COLUMN llm_model DROP DEFAULT;
