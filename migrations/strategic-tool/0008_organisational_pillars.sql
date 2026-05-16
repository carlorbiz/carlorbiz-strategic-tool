-- =============================================================================
-- Carlorbiz Strategic Tool — Organisational Pillars (Path A / Path B primitive)
-- migrations/strategic-tool/0008_organisational_pillars.sql
--
-- Pillars are the strategic intent the corpus is harvested in service of. They
-- are conceptually distinct from Themes/Streams/Disciplines (which are the
-- intake taxonomy for an engagement). The tool earns its keep by surfacing
-- what the harvest tells the organisation about each pillar.
--
-- Two product-shape entry points use the same primitive at different levels:
--
--   Path A — Strategic Engagement Core: pillars are the organisation's full
--     strategic-plan priorities. `pillar_level = 'organisational'`. Heavy,
--     workshopped, expensive to define.
--
--   Path B — Departmental add-on (research, education, advocacy, etc.):
--     pillars are the department's strategy, sitting under (and ideally
--     feeding) the organisational strategic plan. `pillar_level = 'departmental'`
--     or 'programmatic'. Light, faster to define, can later be promoted.
--
-- For now pillars are engagement-scoped. When organisations become a first-class
-- entity (so multiple engagements within one org can share their pillar set),
-- this table will be extended with an organisation_id column.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS st_organisational_pillars (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id   UUID NOT NULL REFERENCES st_engagements(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  success_signal  TEXT,
  pillar_level    TEXT NOT NULL DEFAULT 'departmental'
    CHECK (pillar_level IN ('organisational', 'departmental', 'programmatic')),
  order_index     INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_st_pillars_engagement
  ON st_organisational_pillars (engagement_id);

CREATE INDEX IF NOT EXISTS idx_st_pillars_level
  ON st_organisational_pillars (engagement_id, pillar_level);

ALTER TABLE st_organisational_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY st_organisational_pillars_select ON st_organisational_pillars
  FOR SELECT USING (st_user_has_engagement_access(engagement_id));
CREATE POLICY st_organisational_pillars_insert ON st_organisational_pillars
  FOR INSERT WITH CHECK (st_user_has_engagement_access(engagement_id));
CREATE POLICY st_organisational_pillars_update ON st_organisational_pillars
  FOR UPDATE USING (st_user_has_engagement_access(engagement_id));
CREATE POLICY st_organisational_pillars_delete ON st_organisational_pillars
  FOR DELETE USING (st_is_admin());

COMMENT ON TABLE st_organisational_pillars IS
  'Strategic intent the corpus is harvested in service of. Separate from the engagement''s intake taxonomy (themes/streams/lenses). One pillar can be referenced by Pillar Briefings, drift signals, and Nera retrieval reranking.';
COMMENT ON COLUMN st_organisational_pillars.pillar_level IS
  'organisational = full strategic-plan priority (Path A); departmental = department-level strategy (Path B); programmatic = a specific programme''s strategy.';

COMMIT;
