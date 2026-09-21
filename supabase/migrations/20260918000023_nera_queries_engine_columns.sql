-- st-nera-query's logQuery() writes response_type, turn_number and
-- accumulated_context. On the original project those columns came from the
-- website-era migrations/add-carlorbiz-dimensions.sql, which the clean-install
-- base (20260918000000_base.sql) never folded in. Without them every Nera
-- query log insert fails with PGRST204 and nera_queries stays empty (no
-- query_id, no feedback, no turn counting).
ALTER TABLE nera_queries
  ADD COLUMN IF NOT EXISTS response_type TEXT DEFAULT 'answer',
  ADD COLUMN IF NOT EXISTS turn_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accumulated_context JSONB DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
