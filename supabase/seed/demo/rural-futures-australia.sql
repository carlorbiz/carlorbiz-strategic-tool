-- =============================================================================
-- Demo seed: Rural Futures Australia (RFA)
-- supabase/seed/demo/rural-futures-australia.sql
--
-- Third demo engagement, demonstrating the Research Intelligence Hub vertical
-- of the strategic tool. Same spine as Acme + NAHPC; different doorway.
--
-- RFA is a fictional national rural-health think tank that runs an annual
-- conference on rural health innovation. Their "abstracts corpus" is being
-- built up year on year so a research contribution doesn't get its five seconds
-- at a podium and then disappear — it accumulates into queryable evidence.
--
-- This file seeds the engagement, themes, streams, disciplines (lenses), stages,
-- and the st_ai_config row that maps the engagement to the research-intelligence
-- profile. The 19 abstracts themselves (st_documents + knowledge_chunks) are
-- loaded by scripts/seed-rural-futures-australia.ts, which uploads PDFs to
-- storage and runs them through st-ingest-document.
--
-- Run: apply via Supabase SQL Editor after 0006_st_documents_research_metadata.sql
-- =============================================================================

-- ─── The engagement ─────────────────────────────────────────────────────────

INSERT INTO st_engagements (
  id, name, client_name, description, status, type, profile_key,
  taxonomy_strictness, top_count_warning, top_count_hard_cap, pulse_cadence_days
) VALUES (
  'a1b2c3d4-0003-4000-8000-000000000001',
  'Cross-Specialty Rural Health Research Programme 2023–2027',
  'Rural Futures Australia',
  'Rural Futures Australia is a national rural-health think tank running an annual research symposium since 2023. This engagement is the live research-intelligence hub for the programme. Each year''s abstracts accumulate into a queryable corpus, tagged against four substantive Themes and seven cross-cutting Disciplines. The tool replaces the pattern where a research contribution gets its five seconds at a podium and then disappears — instead, every abstract is searchable, cross-referenced, and reusable.',
  'living',
  'strategic_planning',
  'research-intelligence',
  'soft',
  6, 8, 90
)
ON CONFLICT (id) DO NOTHING;


-- ─── Themes (top commitments) ───────────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, kind, title, description, success_signal, order_index) VALUES
  ('c0000001-0003-4000-8000-000000000001', 'a1b2c3d4-0003-4000-8000-000000000001', 'top',
   'Integrated & Multidisciplinary Care Models',
   'Service models that bring together allied health, primary care, hospital, and community partners around shared accountability for rural patient outcomes. Includes co-designed integrated allied health services, place-based co-planning, and case-management approaches for older rural adults with chronic disease.',
   'Year-on-year growth in the proportion of abstracts demonstrating sustained (>12 month) operational integrated care models rather than pilots. Practitioner adoption signals identified across at least two states.',
   1),
  ('c0000001-0003-4000-8000-000000000002', 'a1b2c3d4-0003-4000-8000-000000000001', 'top',
   'Digital Health & Telehealth Implementation',
   'Implementation, sustainability, and unintended consequences of digital health interventions in rural and remote Australia. Covers telehealth models of care, remote monitoring, eHealth provider/patient perspectives, and the friction between digital promise and on-the-ground rural infrastructure realities.',
   'Corpus contains evidence on outcomes (not just access) for at least three distinct digital interventions, and surfaces at least one documented unintended consequence per year.',
   2),
  ('c0000001-0003-4000-8000-000000000003', 'a1b2c3d4-0003-4000-8000-000000000001', 'top',
   'Workforce Pipeline, Training & Retention',
   'How Australia trains, distributes, and retains rural and remote health professionals. Covers the Rural Health Multidisciplinary Training program, university clinical schools, interprofessional education models, and registrar/practitioner retention strategies.',
   'Corpus tracks named training programmes (RHMT, RCS, UDRH, FACRRM, FARGP) longitudinally and surfaces retention data where reported. Cross-jurisdictional collaborations (Sunraysia-style) are visible.',
   3),
  ('c0000001-0003-4000-8000-000000000004', 'a1b2c3d4-0003-4000-8000-000000000001', 'top',
   'Knowledge Networks & Cross-Sector Translation',
   'Networks and infrastructures that move rural health evidence from research output into practice change — including cross-jurisdictional collaborations, intelligent practice hubs, and cross-sectoral primary care models that bridge education, health, and community.',
   'At least one cited example per year of a corpus contribution being directly referenced in practice or policy change. Repetition signals catch returning presenters covering the same ground.',
   4)
ON CONFLICT (id) DO NOTHING;


-- ─── Streams (sub commitments) ──────────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, parent_id, kind, title, description, order_index) VALUES
  -- Under Integrated & Multidisciplinary Care Models
  ('c0000002-0003-4000-8000-000000000001', 'a1b2c3d4-0003-4000-8000-000000000001', 'c0000001-0003-4000-8000-000000000001', 'sub',
   'Co-design with rural communities', 'Service-model design led by the communities being served — participatory action research, co-planning networks, and community-centred sustainability strategies.', 1),
  ('c0000002-0003-4000-8000-000000000002', 'a1b2c3d4-0003-4000-8000-000000000001', 'c0000001-0003-4000-8000-000000000001', 'sub',
   'Allied health interdisciplinary models', 'Allied health teams working in integrated, interdisciplinary configurations — bridging pharmacy, physiotherapy, occupational therapy, speech pathology, dietetics.', 2),

  -- Under Digital Health & Telehealth
  ('c0000002-0003-4000-8000-000000000003', 'a1b2c3d4-0003-4000-8000-000000000001', 'c0000001-0003-4000-8000-000000000002', 'sub',
   'Telehealth implementation factors', 'What makes telehealth services succeed or fail in rural and remote contexts — sustainability factors, eHealth user perspectives, recommended strategies.', 1),
  ('c0000002-0003-4000-8000-000000000004', 'a1b2c3d4-0003-4000-8000-000000000001', 'c0000001-0003-4000-8000-000000000002', 'sub',
   'Unintended consequences of digital adoption', 'Workforce deskilling, depersonalisation, infrastructure gaps, and other unanticipated effects of telehealth scale-up in rural settings.', 2),

  -- Under Workforce Pipeline
  ('c0000002-0003-4000-8000-000000000005', 'a1b2c3d4-0003-4000-8000-000000000001', 'c0000001-0003-4000-8000-000000000003', 'sub',
   'University training networks', 'University Departments of Rural Health, Rural Clinical Schools, the RHMT program, and the regional cross-border partnerships (e.g. Sunraysia) that bind them.', 1),
  ('c0000002-0003-4000-8000-000000000006', 'a1b2c3d4-0003-4000-8000-000000000001', 'c0000001-0003-4000-8000-000000000003', 'sub',
   'Interprofessional education', 'Simulation-based, scenario-driven, and placement-based interprofessional learning that prepares the next generation of rural health teams.', 2),

  -- Under Knowledge Networks
  ('c0000002-0003-4000-8000-000000000007', 'a1b2c3d4-0003-4000-8000-000000000001', 'c0000001-0003-4000-8000-000000000004', 'sub',
   'Cross-jurisdictional research collaborations', 'Multi-state, multi-institution research networks (HOT North, RuralHealthConnect, the National Rural Health Alliance proposals) that aggregate evidence beyond any single jurisdiction.', 1),
  ('c0000002-0003-4000-8000-000000000008', 'a1b2c3d4-0003-4000-8000-000000000001', 'c0000001-0003-4000-8000-000000000004', 'sub',
   'Cross-sectoral primary care', 'Service models that explicitly bridge health, education, and community sectors — particularly for paediatric and child/young-person populations.', 2)
ON CONFLICT (id) DO NOTHING;


-- ─── Disciplines (cross-cut lenses) ─────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, kind, title, description, order_index) VALUES
  ('c0000003-0003-4000-8000-000000000001', 'a1b2c3d4-0003-4000-8000-000000000001', 'cross_cut',
   'Allied Health', 'Cross-cutting lens for abstracts written by or focused on allied health professionals — physiotherapy, OT, speech, dietetics, pharmacy when sitting alongside other allied disciplines.', 1),
  ('c0000003-0003-4000-8000-000000000002', 'a1b2c3d4-0003-4000-8000-000000000001', 'cross_cut',
   'General Practice & Rural Generalism', 'Abstracts grounded in general practice, rural generalist models, FACRRM/FARGP pathways, or GP-led service redesign.', 2),
  ('c0000003-0003-4000-8000-000000000003', 'a1b2c3d4-0003-4000-8000-000000000001', 'cross_cut',
   'Indigenous Health', 'Contributions where Aboriginal and Torres Strait Islander health, culturally safe care, or Indigenous workforce development is the primary lens.', 3),
  ('c0000003-0003-4000-8000-000000000004', 'a1b2c3d4-0003-4000-8000-000000000001', 'cross_cut',
   'Paediatric & Young Person Health', 'Abstracts where rural children and young people are the primary population — paediatric outpatient access, school-based health, cross-sectoral child health models.', 4),
  ('c0000003-0003-4000-8000-000000000005', 'a1b2c3d4-0003-4000-8000-000000000001', 'cross_cut',
   'Pharmacy', 'Abstracts foregrounding the pharmacist role — particularly bridging pharmacy with the wider allied health team.', 5),
  ('c0000003-0003-4000-8000-000000000006', 'a1b2c3d4-0003-4000-8000-000000000001', 'cross_cut',
   'Nursing & Paramedicine', 'Abstracts where nursing or paramedicine is the primary professional lens, including interprofessional simulations involving these disciplines.', 6),
  ('c0000003-0003-4000-8000-000000000007', 'a1b2c3d4-0003-4000-8000-000000000001', 'cross_cut',
   'Public Health Policy', 'Editorials, commentaries, and policy-level analyses — Australian Government reviews, National Rural Health Commissioner statements, peak-body position pieces.', 7)
ON CONFLICT (id) DO NOTHING;


-- ─── Stages (annual symposium cycle) ────────────────────────────────────────

INSERT INTO st_engagement_stages (id, engagement_id, title, stage_type, status, order_index, description) VALUES
  ('50000001-0003-4000-8000-000000000001', 'a1b2c3d4-0003-4000-8000-000000000001',
   '2023 Annual Symposium — Sydney', 'reporting_cycle', 'closed', 1,
   'First year of the programme. Foundation cohort of abstracts ingested; baseline themes established.'),
  ('50000001-0003-4000-8000-000000000002', 'a1b2c3d4-0003-4000-8000-000000000001',
   '2024 Annual Symposium — Brisbane', 'reporting_cycle', 'closed', 2,
   'Year-two abstracts added. First year where repetition signals could be checked against prior corpus.'),
  ('50000001-0003-4000-8000-000000000003', 'a1b2c3d4-0003-4000-8000-000000000001',
   '2025 Annual Symposium — Adelaide', 'reporting_cycle', 'closed', 3,
   'Year-three abstracts added. Inaugural research roundup report produced.'),
  ('50000001-0003-4000-8000-000000000004', 'a1b2c3d4-0003-4000-8000-000000000001',
   '2026 Annual Symposium — Perth', 'reporting_cycle', 'open', 4,
   'Current year. Call for abstracts open; programme committee using the corpus to identify themes deserving deeper attention and to spot repeat presenters covering identical ground.')
ON CONFLICT (id) DO NOTHING;


-- ─── Reporting templates (engagement-scoped) ────────────────────────────────

INSERT INTO st_reporting_templates (id, engagement_id, name, description, template_markdown, funder_type) VALUES
  ('ab000001-0003-4000-8000-000000000001', 'a1b2c3d4-0003-4000-8000-000000000001',
   'Conference Research Roundup',
   'Cross-corpus synthesis for a given period (typically annual). Pulls all abstracts in the engagement, groups by Theme, surfaces repetition and silence signals, and recommends programme committee actions.',
   E'# {client_name} Research Roundup\n\n**Period:** {period_start} – {period_end}\n**Themes covered:** {theme_count}\n**Abstracts in corpus:** {abstract_count}\n\n---\n\n## Executive synthesis\n\n{executive_synthesis}\n\n## Theme-by-theme summary\n\n{for_each_theme}\n### {theme_title}\n\n**Contributions this period:** {abstracts_this_period}\n**Cumulative:** {abstracts_total}\n**Key institutions:** {top_institutions}\n\n**What the corpus says:**\n\n{theme_synthesis}\n\n**Notable abstracts:**\n\n{notable_abstracts_list}\n\n**Open questions surfaced:**\n\n{open_questions}\n{end_for_each}\n\n## Repetition and silence signals\n\n{repetition_signals_narrative}\n\n## Recommended actions for the programme committee\n\n{recommended_actions}\n',
   null),
  ('ab000002-0003-4000-8000-000000000001', 'a1b2c3d4-0003-4000-8000-000000000001',
   'Speaker Follow-up Brief',
   'Per-researcher pull: everything a named author has contributed to the corpus, with cross-references to adjacent work, suggested follow-up questions, and Themes where their work could advance current gaps. Generated on demand by the programme committee when re-inviting a speaker.',
   E'# Speaker Follow-up Brief: {researcher_name}\n\n**Affiliation:** {institution}\n**Total contributions in corpus:** {abstract_count}\n**Years active:** {years_active}\n**Primary Themes:** {primary_themes}\n**Disciplines:** {disciplines}\n\n---\n\n## Contribution summary\n\n{contribution_summary}\n\n## Abstracts in the corpus\n\n{for_each_abstract}\n### {abstract_title}\n\n**Year:** {year}\n**Journal:** {journal}\n**Theme:** {theme_title}\n\n**Key takeaway:** {takeaway}\n\n**How it relates to other corpus contributions:** {cross_references}\n{end_for_each}\n\n## Suggested questions for a follow-up conversation\n\n{follow_up_questions}\n\n## Where their work could advance current Themes\n\n{theme_advancement_opportunities}\n',
   null)
ON CONFLICT (id) DO NOTHING;


-- ─── st_ai_config (per-engagement profile + vocabulary) ─────────────────────
-- This row is what the application reads to render Themes/Streams/Disciplines/
-- Abstracts terminology and to load the research-intelligence Nera prompts.

INSERT INTO st_ai_config (
  id, engagement_id, profile_key, llm_provider, llm_model, vocabulary_map
) VALUES (
  'ac000001-0003-4000-8000-000000000001',
  'a1b2c3d4-0003-4000-8000-000000000001',
  'research-intelligence',
  'anthropic',
  'claude-sonnet-4-20250514',
  '{
    "commitment_top_singular": "Theme",
    "commitment_top_plural": "Themes",
    "commitment_sub_singular": "Stream",
    "commitment_sub_plural": "Streams",
    "cross_cut_singular": "Discipline",
    "cross_cut_plural": "Disciplines",
    "commitment_add_verb": "introduce",
    "commitment_archive_verb": "retire",
    "evidence_singular": "abstract",
    "evidence_plural": "abstracts",
    "update_singular": "follow-up",
    "update_plural": "follow-ups",
    "drift_singular": "repetition signal",
    "drift_plural": "repetition signals"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- End of Rural Futures Australia demo seed.
--
-- After this runs: engagement exists with 4 Themes, 8 Streams, 7 Disciplines,
-- 4 stages, and the research-intelligence vocabulary map.
--
-- Next: run scripts/seed-rural-futures-australia.ts to upload the 19 abstract
-- PDFs to storage, create st_documents rows with author/journal/year/DOI
-- metadata from the Consensus CSV, and trigger st-ingest-document on each.
-- =============================================================================
