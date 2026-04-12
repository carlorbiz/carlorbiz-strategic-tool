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
  ('s0000001-0002-4000-8000-000000000001', 'a1b2c3d4-0002-4000-8000-000000000001',
   'Stakeholder Interviews — Board & Staff', 'interview', 'closed', 1),
  ('s0000001-0002-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000001',
   'Vision & Priorities Workshop', 'workshop', 'closed', 2),
  ('s0000001-0002-4000-8000-000000000003', 'a1b2c3d4-0002-4000-8000-000000000001',
   'Grant Alignment Review', 'checkpoint', 'closed', 3);


-- =============================================================================
-- End of NAHPC demo seed.
-- This engagement is in 'living' status with 5 Priorities, 8 Initiatives,
-- 4 Lenses, and 3 closed stages (interview, workshop, checkpoint). It's
-- ready for document uploads, pulse checks, and drift-watch runs.
--
-- The combination of grant-reporting obligations (quarterly to the Department)
-- and board governance (quarterly board meetings with a voluntary board larger
-- than the staff) exercises the multi-role, multi-profile capability — the
-- CEO needs a grant-reporting view, the board needs a governance view, and
-- both need a strategic-planning view. All against the same corpus.
-- =============================================================================
