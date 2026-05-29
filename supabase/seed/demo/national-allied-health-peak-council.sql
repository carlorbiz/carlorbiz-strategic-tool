-- =============================================================================
-- Demo seed: National Allied Health Peak Council (NAHPC)
-- supabase/seed/demo/national-allied-health-peak-council.sql
--
-- Fictionalised composite modelled on GPSA's structural shape:
--   - Small national peak body for allied health professionals
--   - Single $2.8M government grant (Department of Health) with quarterly
--     reporting obligations and annual acquittal
--   - Voluntary board of 9 (larger than staff)
--   - Staff: CEO (sole full-time) + 4 part-time equivalents
--   - Governance-heavy: answer to board, funder, membership, and sector
--
-- ANONYMISED: no real GPSA detail. Names, specialties, and numbers are
-- invented. The structural shape is real; the content is fiction.
--
-- Run: paste into Supabase SQL Editor after 0001_init.sql and 0002_extend_knowledge_chunks.sql
-- =============================================================================

-- ─── The engagement ─────────────────────────────────────────────────────────

INSERT INTO st_engagements (
  id, name, client_name, description, status, type, profile_key,
  taxonomy_strictness, top_count_warning, top_count_hard_cap, pulse_cadence_days
) VALUES (
  'a1b2c3d4-0002-4000-8000-000000000001',
  'NAHPC Strategic & Grant Implementation Plan 2026–2029',
  'National Allied Health Peak Council',
  'Combined strategic plan and grant implementation framework for a small national peak body. The $2.8M Department of Health grant funds workforce development, advocacy, and member services. The plan must satisfy both the board and the funder.',
  'living',
  'strategic_planning',
  'strategic-planning',
  'medium',
  6, 7, 42
);


-- ─── Priorities ─────────────────────────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, kind, title, description, success_signal, order_index) VALUES
  ('c0000001-0002-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'top',
   'Workforce Pipeline',
   'Increase the pipeline of allied health professionals entering and staying in the workforce, particularly in rural and remote areas.',
   'Net increase of 150 allied health graduates entering the rural workforce by FY2029 (measured via annual workforce survey).',
   1),
  ('c0000001-0002-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'top',
   'Policy & Advocacy',
   'Influence national health workforce policy to recognise and support the allied health sector. Maintain standing as the sector''s authoritative voice.',
   'At least 3 policy submissions cited in government reports per financial year. Invited to 100% of relevant parliamentary inquiries.',
   2),
  ('c0000001-0002-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'top',
   'Member Value & Engagement',
   'Deliver tangible value to member organisations through CPD programs, shared resources, and networking. Grow membership.',
   'Member satisfaction survey score ≥ 4.0/5.0. Net membership growth of 15% over three years.',
   3),
  ('c0000001-0002-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'top',
   'Grant Compliance & Reporting',
   'Meet all Department of Health grant obligations: quarterly activity reports, annual acquittal, milestone evidence. Zero compliance flags.',
   'All quarterly reports submitted on time with zero rework requests from the Department.',
   4),
  ('c0000001-0002-4000-8000-000000000005', 'a1b2c3d4-0002-4000-8000-000000000001', 'top',
   'Organisational Sustainability',
   'Build the internal capacity to sustain operations beyond the current grant cycle. Diversify funding. Develop the team.',
   'At least one non-grant revenue stream contributing ≥ 15% of total income by FY2028.',
   5);


-- ─── Initiatives ────────────────────────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, parent_id, kind, title, description, order_index) VALUES
  -- Under Workforce Pipeline
  ('c0000002-0002-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'c0000001-0002-4000-8000-000000000001', 'sub',
   'Launch rural placement matching service', 'Online platform connecting final-year students with rural placement opportunities across member organisations.', 1),
  ('c0000002-0002-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'c0000001-0002-4000-8000-000000000001', 'sub',
   'Publish annual allied health workforce data report', 'Authoritative data product establishing NAHPC as the sector reference point.', 2),

  -- Under Policy & Advocacy
  ('c0000002-0002-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'c0000001-0002-4000-8000-000000000002', 'sub',
   'Establish a policy advisory committee with rotating membership', 'Formal structure to develop evidence-based policy positions with broad sector input.', 1),

  -- Under Member Value & Engagement
  ('c0000002-0002-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'c0000001-0002-4000-8000-000000000003', 'sub',
   'Develop a shared CPD resource library', 'Curated, evidence-based continuing professional development materials accessible to all member orgs.', 1),
  ('c0000002-0002-4000-8000-000000000005', 'a1b2c3d4-0002-4000-8000-000000000001', 'c0000001-0002-4000-8000-000000000003', 'sub',
   'Run bi-annual national allied health conference', 'Flagship event for networking, knowledge sharing, and public visibility.', 2),

  -- Under Grant Compliance & Reporting
  ('c0000002-0002-4000-8000-000000000006', 'a1b2c3d4-0002-4000-8000-000000000001', 'c0000001-0002-4000-8000-000000000004', 'sub',
   'Systematise quarterly reporting with evidence pipeline', 'Automate evidence collection so quarterly reports write themselves from accumulated data.', 1),

  -- Under Organisational Sustainability
  ('c0000002-0002-4000-8000-000000000007', 'a1b2c3d4-0002-4000-8000-000000000001', 'c0000001-0002-4000-8000-000000000005', 'sub',
   'Launch fee-for-service consulting arm', 'Offer NAHPC expertise to state governments and large health services on a commercial basis.', 1),
  ('c0000002-0002-4000-8000-000000000008', 'a1b2c3d4-0002-4000-8000-000000000001', 'c0000001-0002-4000-8000-000000000005', 'sub',
   'Develop a succession plan for the CEO role', 'Document critical knowledge, cross-train the team, establish a deputy structure.', 2);


-- ─── Lenses ─────────────────────────────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, kind, title, description, order_index) VALUES
  ('c0000003-0002-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001', 'cross_cut',
   'Grant Milestone Alignment',
   'Which Priorities and Initiatives directly map to Department of Health grant milestones. Used for funder report generation.',
   1),
  ('c0000003-0002-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001', 'cross_cut',
   'Rural & Remote Focus',
   'Cross-cutting view highlighting where Priorities and Initiatives specifically target rural and remote communities vs. metro.',
   2),
  ('c0000003-0002-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001', 'cross_cut',
   'Board Visibility',
   'Items that should be surfaced to the board at quarterly meetings, regardless of which Priority they sit under.',
   3),
  ('c0000003-0002-4000-8000-000000000004', 'a1b2c3d4-0002-4000-8000-000000000001', 'cross_cut',
   'Team Capacity',
   'Initiatives that require more than the current 5 FTE to execute, flagging where additional resource or outsourcing is needed.',
   4);


-- ─── Seed engagement stages ─────────────────────────────────────────────────

INSERT INTO st_engagement_stages (id, engagement_id, title, stage_type, status, order_index) VALUES
  ('50000001-0002-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001',
   'Stakeholder Interviews — Board & Staff', 'interview', 'closed', 1),
  ('50000001-0002-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001',
   'Vision & Priorities Workshop', 'workshop', 'closed', 2),
  ('50000001-0002-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001',
   'Grant Alignment Review', 'checkpoint', 'closed', 3);


-- ─── Organisational pillars (strategic intent above Priorities) ─────────────
-- Pillars are the standing strategic intent for NAHPC as a peak body — what
-- the plan exists in service of beyond any single grant cycle. They sit above
-- the five Priorities so Nera can answer pillar-level questions ("which
-- pillar is the corpus advancing?") rather than only priority-level ones.
-- Each Priority maps to one or more pillars conceptually: Workforce Pipeline
-- + Policy + Member Value serve Sector Authority; Member Value + Workforce
-- Pipeline serve Member Impact; Grant Compliance + Organisational
-- Sustainability serve Institutional Resilience.

INSERT INTO st_organisational_pillars (
  id, engagement_id, title, description, success_signal,
  distinctiveness_claim, pillar_level, order_index
) VALUES
  ('d0000001-0002-4000-8000-000000000001',
   'a1b2c3d4-0002-4000-8000-000000000001',
   'Sector Authority',
   'Be the recognised national voice for allied health — the body government, media, and member organisations come to first when allied health is on the agenda. Authority is earned through evidence, not advocacy alone.',
   'Cited in ≥3 government reports per year AND invited to 100% of relevant parliamentary inquiries AND named first in sector media on workforce stories.',
   'Other peak bodies advocate from member sentiment. NAHPC advocates from data — it publishes the authoritative annual workforce report and runs the policy advisory committee that other peaks now reference.',
   'organisational', 1),
  ('d0000001-0002-4000-8000-000000000002',
   'a1b2c3d4-0002-4000-8000-000000000001',
   'Member-Facing Impact',
   'Deliver tangible value to member organisations week-to-week — CPD resources, rural placement infrastructure, networking, shared services — so membership renews because the value is felt, not because of obligation.',
   'Member satisfaction ≥ 4.0/5.0 AND net membership growth of 15% over three years AND ≥80% of members actively using at least one NAHPC service annually.',
   'Most national peaks are advocacy-first with thin member services. NAHPC is shifting the centre of gravity — member impact is the primary product, advocacy is a downstream consequence of being close to what members are actually facing.',
   'organisational', 2),
  ('d0000001-0002-4000-8000-000000000003',
   'a1b2c3d4-0002-4000-8000-000000000001',
   'Institutional Resilience',
   'Survive — and continue delivering on the above — beyond the current grant cycle. Diversify funding, develop the team, document critical knowledge, so a CEO transition or a funding rebid does not put the organisation at existential risk.',
   '≥15% of total income from non-grant sources by FY2028 AND succession plan documented for CEO role AND quarterly reports auto-generated from accumulated evidence (no firefighting at deadline).',
   'Most peaks built on a single grant are quietly fragile — one rebid loss and the organisation folds. NAHPC is deliberately engineering resilience as a strategic priority, not a contingency plan.',
   'organisational', 3)
ON CONFLICT (id) DO NOTHING;


-- ─── st_ai_config (per-engagement profile + vocabulary) ─────────────────────
-- Binds the engagement to the strategic-planning profile (DEFAULT vocabulary:
-- Priorities / Initiatives / Lenses / documents / drift signals). Without
-- this row, the dashboard falls back to default labels but the onboarding
-- wizard and any other profile-gated UI is suppressed.

INSERT INTO st_ai_config (
  id, engagement_id, profile_key, llm_provider, llm_model, vocabulary_map
) VALUES (
  'ac000001-0002-4000-8000-000000000001',
  'a1b2c3d4-0002-4000-8000-000000000001',
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
-- End of NAHPC demo seed.
-- This engagement is in 'living' status with 3 organisational Pillars,
-- 5 Priorities, 8 Initiatives, 4 Lenses, and 3 closed stages (interview,
-- workshop, checkpoint). The strategic-planning profile is bound, so the
-- onboarding wizard fires on first visit. Ready for document uploads,
-- pulse checks, and drift-watch runs.
--
-- The combination of grant-reporting obligations (quarterly to the Department)
-- and board governance (quarterly board meetings with a voluntary board larger
-- than the staff) exercises the multi-role, multi-profile capability — the
-- CEO needs a grant-reporting view, the board needs a governance view, and
-- both need a strategic-planning view. All against the same corpus.
-- =============================================================================
