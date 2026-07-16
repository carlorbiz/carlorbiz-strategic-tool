-- =============================================================================
-- Carlorbiz Strategic Tool — two-pass document ingestion (CC-94, setup wizard)
-- migrations/strategic-tool/0015_document_raw_text_and_text_ready.sql
--
-- Additive only. Backs the fast text pass that unblocks the setup wizard:
--   1. st_documents.raw_text — the raw text extracted on upload (no LLM
--      chunking). st-extract-pillars proposes pillars from this the moment it
--      lands, so the wizard never waits on the slow per-slice chunking.
--   2. A new 'text_ready' value on st_document_status — the document's raw text
--      is extracted and pillars can be proposed, but the deep knowledge base
--      (knowledge_chunks) is not yet built. The full chunk pass still runs
--      later (on pillar confirm) and transitions the row to 'ingested'.
--
-- Nothing existing changes: 'uploaded' → 'ingesting' → 'ingested'/'failed'
-- still works exactly as before; 'text_ready' is a new optional waypoint.
-- =============================================================================

-- Raw text captured by the fast pass (bounded server-side). Nullable — legacy
-- rows and the full/chunk path never populate it.
ALTER TABLE st_documents
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

COMMENT ON COLUMN st_documents.raw_text IS
  'Raw text extracted on upload by the fast text pass (st-ingest-document mode=text), no LLM chunking. Read by st-extract-pillars to propose pillars before the deep knowledge base is built. Bounded server-side.';

-- Additive enum value. PG15 allows ADD VALUE inside a transaction as long as
-- the value is not used in the same transaction (it isn't here).
ALTER TYPE st_document_status ADD VALUE IF NOT EXISTS 'text_ready';
