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


-- ─── Reporting templates ────────────────────────────────────────────────────

INSERT INTO st_reporting_templates (
  id, engagement_id, name, description, template_markdown, funder_type
) VALUES (
  '70000001-0001-4000-8000-000000000001',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Board Pre-Read',
  'Strategic status overview for quarterly board meetings. Covers each Priority with RAG status, drift signals, and recommended questions.',
  '# Board Pre-Read: {meeting_date}

## Strategic Status Overview

{for_each_priority}
### {priority_title}
**Status**: {rag_status}
**Last update**: {last_update_date}
**Key developments**: {recent_narrative}
{end_for_each}

## Drift Signals

{drift_signals_narrative}

## Items Requiring Board Attention

{attention_items}

## Recommended Questions

{recommended_questions}
',
  NULL
), (
  '70000001-0001-4000-8000-000000000002',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Quarterly Compliance Summary',
  'Summary report for contract KPI compliance across all outlets. Designed for government contract managers.',
  '# Quarterly Compliance Summary: {period_start} to {period_end}

## Executive Summary

{executive_summary}

## KPI Performance by Priority

{for_each_priority}
### {priority_title}
**Compliance status**: {rag_status}
**Evidence base**: {evidence_count} documents, {survey_count} surveys
**Key findings**: {findings_narrative}
{end_for_each}

## Risk Register

{risk_items}

## Recommendations

{recommendations}

## Appendix: Evidence Sources

{source_list}
',
  'Government contract quarterly'
);


-- ─── Organisational pillars (strategic intent above Priorities) ─────────────
-- Pillars are the organisation's standing strategic intent — what the plan is
-- ultimately in service of. They sit above the five Priorities and let Nera
-- answer pillar-level questions ("which pillar is being advanced?") rather
-- than only priority-level ones. Each Priority below maps to one or more
-- pillars conceptually (compliance + workforce + technology serve operational
-- integrity; controlled growth serves disciplined growth; governance serves
-- fiduciary stewardship).

INSERT INTO st_organisational_pillars (
  id, engagement_id, title, description, success_signal,
  distinctiveness_claim, pillar_level, order_index
) VALUES
  ('d0000001-0001-4000-8000-000000000001',
   'a1b2c3d4-0001-4000-8000-000000000001',
   'Operational Integrity at Scale',
   'Run a 120-outlet footprint safely, compliantly, and consistently with a tiny central team. Every outlet should feel the same to a regulator, a hospital partner, and a customer regardless of which jurisdiction it sits in.',
   'Zero critical audit failures across two consecutive financial years AND outlet manager turnover below 35% annually.',
   'Most multi-site operators scale by adding head office. Acme has chosen to scale by tightening the operating model so the central team stays small as the footprint grows — operational integrity earned through system design, not headcount.',
   'organisational', 1),
  ('d0000001-0001-4000-8000-000000000002',
   'a1b2c3d4-0001-4000-8000-000000000001',
   'Disciplined Growth',
   'Add the right new outlets in the right contracts at the right pace. Growth is opt-in: a new site enters the network only when its margin profile and compliance risk pass a documented threshold.',
   'Net 30 new outlets by FY2029 with head office headcount increasing by no more than 2 FTE and no outlet onboarded outside the risk framework.',
   'Most competitors bid every contract they can win. Acme deliberately declines contracts that would degrade the operating model — growth is a function of fit, not appetite.',
   'organisational', 2),
  ('d0000001-0001-4000-8000-000000000003',
   'a1b2c3d4-0001-4000-8000-000000000001',
   'Fiduciary Stewardship',
   'Equip a three-person voluntary board to discharge its governance obligations at a 120-outlet scale without a company secretary. Boardroom information is engineered for the board the company actually has, not the board a textbook assumes.',
   'Board self-assessment score reaches "good" within 12 months; risk register is reviewed at every quarterly meeting with documented owner accountability.',
   'Most operators of this scale have a 5–7 person board with paid secretariat. Acme is engineering its governance posture so a lean voluntary board can meet the same bar — board capability through tooling, not headcount.',
   'organisational', 3)
ON CONFLICT (id) DO NOTHING;


-- ─── st_ai_config (per-engagement profile + vocabulary) ─────────────────────
-- Binds the engagement to the strategic-planning profile (DEFAULT vocabulary:
-- Priorities / Initiatives / Lenses / documents / drift signals). Without this
-- row, the dashboard falls back to default labels but the onboarding wizard
-- and any other profile-gated UI is suppressed.

INSERT INTO st_ai_config (
  id, engagement_id, profile_key, llm_provider, llm_model, vocabulary_map
) VALUES (
  'ac000001-0001-4000-8000-000000000001',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'strategic-planning',
  'anthropic',
  'claude-sonnet-4-20250514',
  '{
    "commitment_top_singular": "Priority",
    "commitment_top_plural": "Priorities",
    "commitment_sub_singular": "Initiative",
    "commitment_sub_plural": "Initiatives",
    "cross_cut_singular": "Lens",
    "cross_cut_plural": "Lenses",
    "commitment_add_verb": "introduce",
    "commitment_archive_verb": "retire",
    "evidence_singular": "document",
    "evidence_plural": "documents",
    "update_singular": "update",
    "update_plural": "updates",
    "drift_singular": "drift signal",
    "drift_plural": "drift signals"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- End of Acme Catering Group demo seed.
-- This engagement is in 'living' status with 3 organisational Pillars,
-- 5 Priorities, 10 Initiatives, 3 Lenses, 1 closed workshop stage, and 2
-- reporting templates (Board Pre-Read and Quarterly Compliance Summary).
-- The strategic-planning profile is bound, so the onboarding wizard fires
-- on first visit. Ready for document uploads, pulse checks, drift-watch
-- runs, and report generation.
-- =============================================================================
