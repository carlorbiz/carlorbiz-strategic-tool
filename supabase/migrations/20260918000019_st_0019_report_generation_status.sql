-- =============================================================================
-- 0019_report_generation_status.sql  (CC-231 — background report generation)
-- =============================================================================
-- st-generate-report now inserts the st_compliance_reports row FIRST with
-- status 'generating', returns 202, and finishes the row from an
-- EdgeRuntime.waitUntil background task (the Kestrel AI Strategy Report
-- outran the 150 s gateway idle timeout on 3 Sep 2026 and no row was written).
--
--   generating  -> row exists, content_markdown NULL, generation_progress set
--   draft       -> ready (the pre-existing first workflow state, unchanged)
--   failed      -> generation_error carries the reason
--
-- Enum ADD VALUE must run outside an explicit transaction block (same note as
-- 0016). The two columns are nullable so existing rows are untouched.
-- =============================================================================

ALTER TYPE st_report_status ADD VALUE IF NOT EXISTS 'generating';
ALTER TYPE st_report_status ADD VALUE IF NOT EXISTS 'failed';

ALTER TABLE st_compliance_reports
  ADD COLUMN IF NOT EXISTS generation_progress TEXT,   -- short phase label while 'generating'
  ADD COLUMN IF NOT EXISTS generation_error    TEXT;   -- reason when 'failed'
