-- =============================================================================
-- 0016_document_status_purged.sql  (Strategy Engine sovereignty overhaul)
-- =============================================================================
-- st-purge-engagement marks purged documents 'purged' (rows kept as the audit
-- record of what was removed, content-derived fields cleared). Enum ADD VALUE
-- must run outside an explicit transaction block.
-- =============================================================================

ALTER TYPE st_document_status ADD VALUE IF NOT EXISTS 'purged';
