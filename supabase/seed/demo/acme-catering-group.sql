-- =============================================================================
-- Demo seed: Acme Catering Group
-- supabase/seed/demo/acme-catering-group.sql
--
-- Fictionalised composite modelled on Zouki's structural shape:
--   - 100+ small retail/cafe outlets across Australia, each inside hospital
--     or government-facility contracts
--   - Tiny permanent team (CEO + 3 directors + 2 accountants)
--   - Heavy multi-site compliance: food safety, OH&S, contract KPIs per site,
--     government audit requirements, staff credentialing across jurisdictions
--   - Board meets quarterly, CEO reports monthly
--
-- ANONYMISED: no real Zouki detail. Names, locations, and numbers are
-- invented. The structural shape is real; the content is fiction.
--
-- Run: paste into Supabase SQL Editor after 0001_init.sql and 0002_extend_knowledge_chunks.sql
-- =============================================================================

-- ─── The engagement ─────────────────────────────────────────────────────────

INSERT INTO st_engagements (
  id, name, client_name, description, status, type, profile_key,
  taxonomy_strictness, top_count_warning, top_count_hard_cap, pulse_cadence_days
) VALUES (
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Acme Catering Group — Strategic Plan 2026–2029',
  'Acme Catering Group',
  'Three-year strategic plan for a multi-outlet catering and retail operator with 120+ locations in hospital and government-facility contracts. Engagement covers governance, compliance, growth, workforce, and technology priorities.',
  'living',
  'strategic_planning',
  'strategic-planning',
  'soft',
  6, 7, 42
);


-- ─── Priorities (top-level commitments) ─────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, kind, title, description, success_signal, order_index) VALUES
  ('c0000001-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'top',
   'Compliance Excellence',
   'Achieve and maintain full compliance across all 120+ outlets against food safety, OH&S, and government contract KPIs. No audit failures.',
   'Zero critical non-conformances in government audits for two consecutive financial years.',
   1),
  ('c0000001-0001-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001', 'top',
   'Workforce Sustainability',
   'Build a workforce model that supports 120+ outlets with minimal permanent overhead. Address recruitment, retention, credentialing, and rostering across jurisdictions.',
   'Staff turnover below 35% annually (industry benchmark 55%). All credentialing current within 30 days of expiry.',
   2),
  ('c0000001-0001-4000-8000-000000000003', 'a1b2c3d4-0001-4000-8000-000000000001', 'top',
   'Controlled Growth',
   'Grow from 120 to 150 outlets over three years without proportional increase in head office headcount. New contracts only where margin and compliance risk are acceptable.',
   'Net 30 new outlets by FY2029. Head office headcount increases by no more than 2 FTE.',
   3),
  ('c0000001-0001-4000-8000-000000000004', 'a1b2c3d4-0001-4000-8000-000000000001', 'top',
   'Technology & Systems',
   'Replace manual reporting and spreadsheet-based compliance tracking with integrated systems that give the CEO and board real-time visibility.',
   'All outlet compliance data consolidated into a single dashboard accessible by CEO and board within 18 months.',
   4),
  ('c0000001-0001-4000-8000-000000000005', 'a1b2c3d4-0001-4000-8000-000000000001', 'top',
   'Board Governance & Risk',
   'Strengthen governance so the board can fulfill its fiduciary obligations at scale despite having only three directors and no company secretary.',
   'Board self-assessment score improves from baseline to "good" within 12 months. Risk register reviewed at every quarterly meeting.',
   5);


-- ─── Initiatives (sub-level under Priorities) ───────────────────────────────

INSERT INTO st_commitments (id, engagement_id, parent_id, kind, title, description, order_index) VALUES
  -- Under Compliance Excellence
  ('c0000002-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000001', 'sub',
   'Standardise food safety audit templates across all jurisdictions', 'Create a unified audit checklist that maps to state/territory requirements.', 1),
  ('c0000002-0001-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000001', 'sub',
   'Implement quarterly OH&S self-assessment for outlet managers', 'Digital self-assessment with escalation path for critical findings.', 2),

  -- Under Workforce Sustainability
  ('c0000002-0001-4000-8000-000000000003', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000002', 'sub',
   'Centralise credentialing management', 'Single system tracking all staff credentials with automated expiry alerts.', 1),
  ('c0000002-0001-4000-8000-000000000004', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000002', 'sub',
   'Design a casual-to-permanent pathway for high-performing outlet staff', 'Structured development program with clear milestones.', 2),

  -- Under Controlled Growth
  ('c0000002-0001-4000-8000-000000000005', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000003', 'sub',
   'Develop new-contract risk assessment framework', 'Scoring model for evaluating prospective contracts before bid submission.', 1),
  ('c0000002-0001-4000-8000-000000000006', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000003', 'sub',
   'Pilot a regional cluster management model', 'Group outlets by geography for shared management and reduced overhead.', 2),

  -- Under Technology & Systems
  ('c0000002-0001-4000-8000-000000000007', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000004', 'sub',
   'Select and implement a compliance management platform', 'Replace spreadsheets with a SaaS compliance tool integrated with outlet POS data.', 1),
  ('c0000002-0001-4000-8000-000000000008', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000004', 'sub',
   'Build a CEO/board operational dashboard', 'Real-time KPI visibility across all outlets without manual compilation.', 2),

  -- Under Board Governance & Risk
  ('c0000002-0001-4000-8000-000000000009', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000005', 'sub',
   'Establish a standing risk register with quarterly review cycle', 'Board-owned risk register reviewed at every meeting with owner accountability.', 1),
  ('c0000002-0001-4000-8000-000000000010', 'a1b2c3d4-0001-4000-8000-000000000001', 'c0000001-0001-4000-8000-000000000005', 'sub',
   'Commission annual board self-assessment', 'External or facilitated self-assessment benchmarked against AICD governance principles.', 2);


-- ─── Lenses (cross-cutting tags) ────────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, kind, title, description, order_index) VALUES
  ('c0000003-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'cross_cut',
   'Financial Impact',
   'Cross-cutting view of any commitment or evidence item that has direct financial implications — cost, revenue, margin, investment.',
   1),
  ('c0000003-0001-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001', 'cross_cut',
   'Jurisdictional Variation',
   'Where state/territory differences affect how a Priority or Initiative is implemented across the outlet network.',
   2),
  ('c0000003-0001-4000-8000-000000000003', 'a1b2c3d4-0001-4000-8000-000000000001', 'cross_cut',
   'Scalability',
   'Whether an Initiative or approach scales to 150+ outlets or hits diminishing returns at some threshold.',
   3);


-- ─── Seed one engagement stage (the original workshop) ──────────────────────

INSERT INTO st_engagement_stages (
  id, engagement_id, title, stage_type, status, order_index
) VALUES (
  '50000001-0001-4000-8000-000000000001',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Foundation Workshop — Board Strategic Planning Day',
  'workshop',
  'closed',
  1
);


-- =============================================================================
-- End of Acme Catering Group demo seed.
-- This engagement is in 'living' status with 5 Priorities, 10 Initiatives,
-- 3 Lenses, and 1 closed workshop stage. It's ready for document uploads,
-- pulse checks, and drift-watch runs.
-- =============================================================================
