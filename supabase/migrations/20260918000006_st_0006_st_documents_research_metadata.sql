-- =============================================================================
-- Carlorbiz Strategic Tool — Research metadata on st_documents
-- migrations/strategic-tool/0006_st_documents_research_metadata.sql
--
-- Adds first-class metadata columns so research-vertical engagements (e.g.
-- Rural Futures Australia) can store author, institution, year, journal, DOI
-- and an external link per abstract. All columns are nullable so existing
-- non-research uploads (board papers, policies, meeting notes) are unaffected.
--
-- These fields surface in the Documents tab UI and are included in retrieval
-- context so Nera can answer questions like "who has presented on X?" without
-- needing to parse them out of free-text descriptions.
-- =============================================================================

BEGIN;

ALTER TABLE st_documents
  ADD COLUMN IF NOT EXISTS authors        TEXT,    -- free-text author list ("Smith J, Lee K, et al.")
  ADD COLUMN IF NOT EXISTS institution    TEXT,    -- primary affiliation
  ADD COLUMN IF NOT EXISTS publication_year SMALLINT,
  ADD COLUMN IF NOT EXISTS journal        TEXT,
  ADD COLUMN IF NOT EXISTS doi            TEXT,    -- e.g. "10.1111/ajr.13144"
  ADD COLUMN IF NOT EXISTS external_link  TEXT;    -- canonical URL (Consensus / publisher / DOI resolver)

-- Index on year + journal for theme-by-year and journal-cohort views in reports
CREATE INDEX IF NOT EXISTS idx_st_documents_year
  ON st_documents (engagement_id, publication_year)
  WHERE publication_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_st_documents_doi
  ON st_documents (doi)
  WHERE doi IS NOT NULL;

COMMENT ON COLUMN st_documents.authors IS
  'Free-text author list. Used by research-vertical engagements; NULL for board-paper / policy uploads.';
COMMENT ON COLUMN st_documents.institution IS
  'Primary institutional affiliation of the document''s authors (e.g. "Macquarie University").';
COMMENT ON COLUMN st_documents.publication_year IS
  'Publication year for research outputs. SMALLINT — supports historical and forward years.';
COMMENT ON COLUMN st_documents.journal IS
  'Source journal / venue (e.g. "The Australian Journal of Rural Health").';
COMMENT ON COLUMN st_documents.doi IS
  'Digital Object Identifier without the doi.org prefix.';
COMMENT ON COLUMN st_documents.external_link IS
  'Canonical external URL (publisher page, Consensus link, or DOI resolver) for opening the source.';

COMMIT;
