-- =============================================================================
-- Carlorbiz Strategic Tool — Primary-document metadata on st_documents
-- migrations/strategic-tool/0020_st_documents_primary_document_metadata.sql
--
-- Item #2 of the Generic Drift queue: ingestion format expansion. Tracked as
-- CC Inbox CC-11.
--
-- The Generic Drift lens is a *longitudinal* diagnostic. Migration 0009 says
-- it plainly: the verbal-actual lag detection "runs the claim against the
-- corpus language over time". The Generic Drift Detection report template
-- (commit e39a0c0) reads the corpus as "strategic plans, board papers, annual
-- reports, public communications ingested over the {period_start} –
-- {period_end} window", and the board workbook's "Before you begin" names the
-- same set: the last five years of strategic plans, annual reports, CEO
-- letters or chair statements, and one or two recent board papers.
--
-- Until now the corpus could not express either half of that. st_documents
-- carried a file_type (pdf/docx/xlsx — the wire format) and, from migration
-- 0006, a research-vertical metadata block (authors, journal, DOI). Neither
-- says *what kind of organisational document this is* or *what period it
-- speaks for*. A 2019 strategic plan and a 2024 board paper were
-- indistinguishable to the lens, so "has the language stayed stable across a
-- window in which the operating reality changed" could not be asked.
--
-- So the expansion is of the ingestion *format taxonomy*, not the file-format
-- allowlist (which already accepts everything a board produces: PDF, Word,
-- Markdown, text, Excel, CSV, JSON, images). Two nullable columns, same shape
-- as migration 0006 so existing uploads are unaffected:
--
--   primary_document_type  — the board-document class, from a fixed vocabulary
--   document_period        — the period the document speaks FOR, which is not
--                            the upload date (a strategy refresh adopted in
--                            2024 can speak for 2025-2030)
--
-- Used by:
--   - Generic Drift Detection report — signal 1 (the verbal-actual lag) needs
--     to order primary documents by the period they speak for, and signals 5
--     and 6 need to know which documents are governance artefacts.
--   - Pillar Briefing distinctiveness signal column — assesses whether the
--     corpus evidence supporting a pillar would equally support a peer's
--     claim; primary documents carry that language most directly.
--   - Sovereignty Drift Detection report (CC-11 slice 2) — the same
--     longitudinal read against sovereignty_claim.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'st_primary_document_type') THEN
    CREATE TYPE st_primary_document_type AS ENUM (
      'strategic_plan',
      'annual_report',
      'chair_or_ceo_statement',
      'board_paper',
      'governance_instrument',
      'public_communication',
      'operational_report'
    );
  END IF;
END
$$;

ALTER TABLE st_documents
  ADD COLUMN IF NOT EXISTS primary_document_type st_primary_document_type,
  ADD COLUMN IF NOT EXISTS document_period       TEXT;

-- The lens reads primary documents in period order within an engagement.
CREATE INDEX IF NOT EXISTS idx_st_documents_primary_type
  ON st_documents (engagement_id, primary_document_type, document_period)
  WHERE primary_document_type IS NOT NULL;

COMMENT ON TYPE st_primary_document_type IS
  'The board-document classes a drift diagnostic reads. Mirrors the primary documents named in the Generic Drift board workbook: strategic plans, annual reports, CEO/chair statements, board papers. governance_instrument covers constitutions, rules, member agreements and delegation schedules (Generic Drift signal 5, governance-form change). public_communication covers campaigns, media statements and website positioning (signal 8, language repair before operations repair).';

COMMENT ON COLUMN st_documents.primary_document_type IS
  'Board-document class for drift detection. NULL for evidence that is not a primary organisational document (research abstracts, survey exports, meeting notes) — those still chunk and retrieve normally, they just do not carry the lens.';

COMMENT ON COLUMN st_documents.document_period IS
  'The period this document speaks FOR, not when it was uploaded: a year ("2024"), a financial year ("FY2024-25") or a plan horizon ("2025-2030"). Free text by design — organisations name their own periods, and forcing a date range loses "the 2022 plan" as the board actually refers to it.';

COMMIT;
