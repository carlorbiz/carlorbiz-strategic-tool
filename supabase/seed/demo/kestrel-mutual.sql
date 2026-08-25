-- =============================================================================
-- Demo seed: Kestrel Mutual — AI Strategy & Digital Reality Review 2026
-- supabase/seed/demo/kestrel-mutual.sql
--
-- Fictional member-owned insurer, ~400 staff, contact centre + claims
-- operation, two years into a digital transformation, three AI proposals on
-- the table, complaints up. Deliberately not adjacent to any real client.
--
-- The fourth demo, and the first whose corpus is seeded INTAKE rather than
-- documents: sixteen intake dimensions (CC-231's Digital Strategy pro forma)
-- and twelve stakeholder-elicitation chunks land in knowledge_chunks with
-- source_type = 'elicitation', so the report step cites them like any board
-- paper. This is the fix for the empty-corpus defect in the Acme and NAHPC
-- demos, whose report step generates "No evidence chunks".
--
-- profile_key = 'ai-strategy' drives the onboarding wizard's step set
-- (client/src/components/engagement/OnboardingWizard.tsx). tools_in_play uses
-- REAL Intelligence Engine vendor slugs (GET /api/catalogue/vendors) so the
-- Tool Intelligence tab and the report's Vendor Tool Intelligence block are
-- populated on first open.
--
-- Run: paste into the Supabase SQL Editor after 0018_demo_kestrel_mutual.sql.
-- Idempotent: every insert is ON CONFLICT (id) DO NOTHING.
-- =============================================================================

-- ─── The engagement ─────────────────────────────────────────────────────────

INSERT INTO st_engagements (
  id, name, client_name, description, status, type, profile_key,
  taxonomy_strictness, top_count_warning, top_count_hard_cap, pulse_cadence_days,
  tools_in_play
) VALUES (
  'a1b2c3d4-0004-4000-8000-000000000001',
  'Kestrel Mutual — AI Strategy & Digital Reality Review 2026',
  'Kestrel Mutual',
  'AI strategy engagement for a member-owned general insurer (about 400 staff; contact centre and claims). Two years and $6.2m into a digital transformation, three AI proposals on the table, member complaints up 38% year on year. The engagement decides which of the proposals, if any, the organisation should say yes to, and what has to be true first.',
  'living',
  'strategic_planning',
  'ai-strategy',
  'soft',
  6, 7, 42,
  ARRAY['salesforce', 'snowflake', 'gmail-and-outlook', 'slack', 'jira']
)
ON CONFLICT (id) DO NOTHING;


-- ─── Strategic Moves (top-level commitments) — seeded from dimension 16 ──────

INSERT INTO st_commitments (id, engagement_id, kind, title, description, success_signal, order_index) VALUES
  ('c0000001-0004-4000-8000-000000000001', 'a1b2c3d4-0004-4000-8000-000000000001', 'top',
   'Fix the claims handoff before automating it',
   'The claims-to-assessor handoff is where members wait and where complaints start. Redesign the handoff as a human process first; only then decide what an AI triage model would be allowed to touch.',
   'Median claim cycle time back under 10 days (from 19) and handoff rework below 5% of claims by the end of Q2 FY27.',
   1),
  ('c0000001-0004-4000-8000-000000000002', 'a1b2c3d4-0004-4000-8000-000000000001', 'top',
   'One member record, one source of truth',
   'Salesforce Service Cloud and the Snowflake warehouse each hold a partial member picture. Agree the system of record per data element, close the 40% of claims history still outside Snowflake, and name a data product owner.',
   'A single member view served to the contact centre from one record by Q3 FY27; a named data product owner in post within 60 days.',
   2),
  ('c0000001-0004-4000-8000-000000000003', 'a1b2c3d4-0004-4000-8000-000000000001', 'top',
   'Decide the never-automate line and publish it',
   'Write down, sign off and publish internally the decisions that stay with a person regardless of what the models can do: total-loss determinations, vulnerability and hardship cases, and any decline.',
   'The never-automate list approved by the board and visible to every frontline team within 30 days, and referenced in every AI proposal gate thereafter.',
   3),
  ('c0000001-0004-4000-8000-000000000004', 'a1b2c3d4-0004-4000-8000-000000000001', 'top',
   'Put the three AI proposals through one gate',
   'The claims-triage model, the contact-centre copilot and the internal Snowflake build are being sold to three different executives. Run them through a single evidence gate with the same five vendor questions, the same red-flag checklist and the same never-automate test.',
   'All three proposals scored on one gate by the transformation steering committee within 60 days; no AI contract signed outside it.',
   4),
  ('c0000001-0004-4000-8000-000000000005', 'a1b2c3d4-0004-4000-8000-000000000001', 'top',
   'Rebuild frontline belief in the transformation',
   'Contact-centre and claims teams work around two of the systems the transformation delivered. A plan the frontline does not believe will fail in the room, not on paper. Pilot with them, not on them.',
   'Contact-centre voluntary turnover below 25% (from 34%) and a frontline-led pilot live with measured outcomes within 90 days.',
   5)
ON CONFLICT (id) DO NOTHING;


-- ─── Actions (sub-level) ────────────────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, parent_id, kind, title, description, order_index) VALUES
  ('c0000002-0004-4000-8000-000000000001', 'a1b2c3d4-0004-4000-8000-000000000001', 'c0000001-0004-4000-8000-000000000001', 'sub',
   'Map the Tuesday-afternoon claims handoff end to end', 'Observe and document the lodgement-to-assessor path on a busy day, with times, queues and workarounds, before any tooling decision.', 1),
  ('c0000002-0004-4000-8000-000000000002', 'a1b2c3d4-0004-4000-8000-000000000001', 'c0000001-0004-4000-8000-000000000001', 'sub',
   'Retire the parallel spreadsheet tracker', 'The claims team keeps a spreadsheet beside Service Cloud because the case status field lags. Fix the field or retire the spreadsheet; not both.', 2),
  ('c0000002-0004-4000-8000-000000000003', 'a1b2c3d4-0004-4000-8000-000000000001', 'c0000001-0004-4000-8000-000000000002', 'sub',
   'Appoint a data product owner for the member record', 'One accountable person for what the member record contains, who may change it, and how the contact centre reads it.', 1),
  ('c0000002-0004-4000-8000-000000000004', 'a1b2c3d4-0004-4000-8000-000000000001', 'c0000001-0004-4000-8000-000000000002', 'sub',
   'Load the remaining claims history into Snowflake', 'Close the gap from 60% to full claims-history coverage so any model is trained on the whole picture, not the recent half.', 2),
  ('c0000002-0004-4000-8000-000000000005', 'a1b2c3d4-0004-4000-8000-000000000001', 'c0000001-0004-4000-8000-000000000003', 'sub',
   'Draft the never-automate list with claims and the contact centre', 'Frontline authorship, executive sign-off, board endorsement. In that order.', 1),
  ('c0000002-0004-4000-8000-000000000006', 'a1b2c3d4-0004-4000-8000-000000000001', 'c0000001-0004-4000-8000-000000000004', 'sub',
   'Ask every vendor the same five questions in writing', 'Where the model was trained, what happens to member data, how a decision is explained, what the exit looks like, and who is liable when it is wrong.', 1),
  ('c0000002-0004-4000-8000-000000000007', 'a1b2c3d4-0004-4000-8000-000000000001', 'c0000001-0004-4000-8000-000000000004', 'sub',
   'Score all three proposals on the same evidence gate', 'Red-flag checklist, never-automate test, data readiness, and a cost-to-serve estimate that the CFO signs.', 2),
  ('c0000002-0004-4000-8000-000000000008', 'a1b2c3d4-0004-4000-8000-000000000001', 'c0000001-0004-4000-8000-000000000005', 'sub',
   'Run one frontline-designed pilot with a measured baseline', 'The contact-centre team chooses the problem, the measure, and the tool. Ninety days, baseline first.', 1)
ON CONFLICT (id) DO NOTHING;


-- ─── Lenses (cross-cutting) ─────────────────────────────────────────────────

INSERT INTO st_commitments (id, engagement_id, kind, title, description, order_index) VALUES
  ('c0000003-0004-4000-8000-000000000001', 'a1b2c3d4-0004-4000-8000-000000000001', 'cross_cut',
   'Member trust',
   'Any move that changes how a member is spoken to, waited on, or decided about. The mutual exists for its members; this lens is the tie-breaker.',
   1),
  ('c0000003-0004-4000-8000-000000000002', 'a1b2c3d4-0004-4000-8000-000000000001', 'cross_cut',
   'Regulation and privacy',
   'CPS 230 operational resilience obligations, the Privacy Act, and the Code of Practice — where a move creates or retires a regulatory exposure.',
   2),
  ('c0000003-0004-4000-8000-000000000003', 'a1b2c3d4-0004-4000-8000-000000000001', 'cross_cut',
   'Cost to serve',
   'The real cost of the current state (rework, attrition, complaints handling) and whether a move reduces it or only moves it.',
   3)
ON CONFLICT (id) DO NOTHING;


-- ─── Organisational pillars — success signals traceable to dimension 15 ─────

INSERT INTO st_organisational_pillars (
  id, engagement_id, title, description, success_signal,
  distinctiveness_claim, pillar_level, order_index
) VALUES
  ('d0000001-0004-4000-8000-000000000001', 'a1b2c3d4-0004-4000-8000-000000000001',
   'Members feel known, not processed',
   'A member who calls twice should not have to explain themselves twice. Every channel reads the same record and every person who speaks to a member can see what the last person did.',
   'Complaints back to the 2024 level (down 38%) and first-contact resolution at or above 70% within twelve months.',
   'Most insurers of this size are buying AI to deflect contact. Kestrel is a mutual; it will use AI so that the contact a member does make is better, not rarer.',
   'organisational', 1),
  ('d0000001-0004-4000-8000-000000000002', 'a1b2c3d4-0004-4000-8000-000000000001',
   'Claims decided in days, not weeks',
   'The claim cycle is the moment the promise is kept or broken. The target is a median under ten days without a single decision being made faster than it can be made well.',
   'Median claim cycle at or under 10 days (from 19), with no increase in overturned decisions on review.',
   'Speed here comes from removing handoffs and rework, not from letting a model decide. That order is the whole difference between this plan and the vendor decks.',
   'organisational', 2),
  ('d0000001-0004-4000-8000-000000000003', 'a1b2c3d4-0004-4000-8000-000000000001',
   'Judgement stays human where it matters',
   'The organisation has decided, in writing, which decisions it will never hand to a machine: total-loss determinations, vulnerability and hardship, and any decline. The list is public inside the organisation and binding on every proposal.',
   'The never-automate list board-approved within 30 days and cited in every AI proposal gate; zero automated declines.',
   'Competitors treat the human-in-the-loop as a cost to be minimised. Kestrel treats it as the product.',
   'organisational', 3),
  ('d0000001-0004-4000-8000-000000000004', 'a1b2c3d4-0004-4000-8000-000000000001',
   'Data the organisation can trust',
   'One member record with a named owner, complete claims history in the warehouse, and a contact centre that reads from it rather than around it.',
   'Single member view live in the contact centre by Q3 FY27; claims-history coverage in Snowflake from 60% to 100%; data product owner in post within 60 days.',
   'Kestrel is choosing to finish the data work it already paid for before buying a model that would have to guess around the gaps.',
   'organisational', 4),
  ('d0000001-0004-4000-8000-000000000005', 'a1b2c3d4-0004-4000-8000-000000000001',
   'AI bought on evidence, not urgency',
   'Three proposals, one gate. Every vendor answers the same five questions in writing; every proposal passes the never-automate test and a CFO-signed cost-to-serve estimate before it reaches the board.',
   'All three current proposals scored on the single gate within 60 days; no AI contract signed outside it in FY27.',
   'Most boards see one proposal at a time, each with its own urgency. Kestrel will see them side by side, on the same evidence, once.',
   'organisational', 5),
  ('d0000001-0004-4000-8000-000000000006', 'a1b2c3d4-0004-4000-8000-000000000001',
   'A frontline that believes the plan',
   'The people who answer the phones and assess the claims designed the last two years of workarounds. The next phase is built with them: they choose the first pilot, the measure, and the tool.',
   'Contact-centre voluntary turnover below 25% (from 34%) and a frontline-designed pilot live with a measured baseline within 90 days.',
   'The transformation so far was done to the frontline. This pillar is the organisation admitting that, on the record, and changing the order of authorship.',
   'organisational', 6)
ON CONFLICT (id) DO NOTHING;


-- ─── Stages — the first in the system with a populated question_set ─────────

INSERT INTO st_engagement_stages (
  id, engagement_id, title, description, stage_type, status, order_index, nera_system_prompt, question_set
) VALUES
  ('50000001-0004-4000-8000-000000000001', 'a1b2c3d4-0004-4000-8000-000000000001',
   'Intake — the sixteen dimensions', 'The Digital Strategy pro forma run with the Chief Executive. Sixteen dimensions, 180 words each, distilled by the consultant after the session and landed in the corpus as elicitation chunks.',
   'interview', 'closed', 1,
   'You are Nera, running the Digital Strategy intake for Kestrel Mutual. Draw out concrete moments, not categories. Never read the dimension names aloud. One question at a time; follow the answer before moving on.',
   '[
     {"dimension":"transformation_history","ask":"Walk me through what you have already invested in. What did you buy, roughly when, and what actually changed afterwards?","capture":"What was bought, over what period, what observably changed."},
     {"dimension":"service_reality","ask":"Tell me about a Tuesday afternoon when it is busy. Where does it come unstuck?","capture":"Specific break points: the handoff, the queue, the workaround."},
     {"dimension":"theatre_vs_change","ask":"What is officially finished that people still work around?","capture":"Systems that look complete from outside."},
     {"dimension":"values_behaviour_gap","ask":"What does the organisation say it values, and where would I see something different if I sat in for a week?","capture":"Stated versus observed, in examples."},
     {"dimension":"ai_in_play","ask":"What software does the work actually run on? And what are people using that was not officially approved?","capture":"Sanctioned and unsanctioned, by name. Feeds tools_in_play."},
     {"dimension":"ai_readiness","ask":"If you wanted to automate something meaningful tomorrow, what would be in the way?","capture":"Data, process and governance obstacles as described. Do not score."},
     {"dimension":"never_automate","ask":"What in your service would you never hand to a machine, and why not?","capture":"The line and the reasoning."},
     {"dimension":"vendor_exposure","ask":"What is on your desk right now that someone wants you to sign?","capture":"Live proposals, who is pushing them, warning signs present."},
     {"dimension":"hidden_costs","ask":"What is the current state costing you, in rework, in people leaving, in members who do not come back?","capture":"Figures where they exist; estimates labelled as estimates."},
     {"dimension":"investment_appetite","ask":"What could you actually spend on this, and whose signature does it need?","capture":"The number and the name."},
     {"dimension":"board_argument","ask":"When you take this to the board, who pushes back and what do they say?","capture":"The argument to be won and the specific objection."},
     {"dimension":"decision_rights","ask":"Who actually decides this? And where do decisions like this normally get stuck?","capture":"The real path, not the org chart."},
     {"dimension":"capability_gaps","ask":"To do what you are describing, who would you need that you have not got?","capture":"Roles and skills; note defensiveness."},
     {"dimension":"change_capacity","ask":"What else is competing for the same attention this quarter?","capture":"Other programmes and deadlines."},
     {"dimension":"success_signals","ask":"A year from now, what would you be seeing that would tell you this worked?","capture":"Observable signals. Seeds pillar success signals."},
     {"dimension":"commitments_30_60_90","ask":"If you had to start with one thing in the next thirty days, what would it be?","capture":"What they would commit to, and by when. Seeds commitments."}
   ]'::jsonb),
  ('50000001-0004-4000-8000-000000000002', 'a1b2c3d4-0004-4000-8000-000000000001',
   'Stakeholder elicitation — three more voices', 'Nera against the same dimensions with the Chief Operating Officer, a contact-centre team leader, and the Head of Data. The point is where the accounts diverge, which a single intake cannot show.',
   'interview', 'closed', 2,
   'You are Nera, interviewing one stakeholder at Kestrel Mutual about the AI strategy review. Ask about their world, their Tuesday, what they work around. Never ask them to rate anything. Where their account differs from what you have already heard, follow the difference without naming who said what.',
   '[
     {"dimension":"service_reality","ask":"Describe the last time a member had to be called back because something fell between two teams."},
     {"dimension":"ai_readiness","ask":"If a model had to read your data tomorrow, what would it get wrong first?"},
     {"dimension":"never_automate","ask":"Which decision on your desk would you refuse to let a system make, even a good one?"},
     {"dimension":"vendor_exposure","ask":"Which of the three proposals have you actually seen demonstrated on Kestrel data?"},
     {"dimension":"decision_rights","ask":"When your team needs a yes, where does it go and how long does it take?"},
     {"dimension":"capability_gaps","ask":"Who did the last big change lean on that is no longer here?"},
     {"dimension":"change_capacity","ask":"What is already on your calendar for the next quarter that cannot move?"},
     {"dimension":"success_signals","ask":"What would you notice on a Tuesday afternoon a year from now if this had worked?"}
   ]'::jsonb),
  ('50000001-0004-4000-8000-000000000003', 'a1b2c3d4-0004-4000-8000-000000000001',
   'Synthesis — themes, tensions, surprises', 'Closing the two interview stages into six organisational pillars. The tensions between the four accounts (executive, frontline, data, chief executive) are recorded as pillars, not smoothed over.',
   'workshop', 'closed', 3,
   'You are Nera, assisting the synthesis workshop for Kestrel Mutual. Surface themes, tensions and surprises across the intake and stakeholder chunks. Where two accounts contradict, say so and cite both.',
   '[
     {"prompt":"Where do the four accounts agree without having been asked the same question?"},
     {"prompt":"Where does the executive account and the frontline account describe the same system differently?"},
     {"prompt":"Which of the three proposals survives the never-automate test as described by claims?"},
     {"prompt":"What would each pillar need to be true by Q3 FY27?"}
   ]'::jsonb),
  ('50000001-0004-4000-8000-000000000004', 'a1b2c3d4-0004-4000-8000-000000000001',
   'The AI Strategy Report', 'Generated from the corpus with citations back to intake and stakeholder chunks, plus [tool:…] references from the Intelligence Engine for the tools in play.',
   'report', 'open', 4,
   NULL,
   '[
     {"prompt":"Every claim in the report must cite an intake or stakeholder chunk, or a tool-intelligence chunk. Where the corpus is silent, say so."}
   ]'::jsonb)
ON CONFLICT (id) DO NOTHING;


-- ─── Reporting template — sections mirror the five dimension groups ─────────

INSERT INTO st_reporting_templates (
  id, engagement_id, name, description, template_markdown, funder_type
) VALUES (
  '70000001-0004-4000-8000-000000000001',
  'a1b2c3d4-0004-4000-8000-000000000001',
  'AI Strategy Report',
  'Board-ready AI strategy report structured on the five intake groups (Situation, AI posture, Economics, Organisation, Direction), with a Vendor Tool Intelligence section drawn live from the Intelligence Engine and a References list.',
  '# AI Strategy Report: {client_name} — {period_start} to {period_end}

## Executive summary

{executive_summary}

## 1. Situation — what has actually changed

{situation_narrative}

## 2. AI posture — what is in play, what is ready, what stays human

{ai_posture_narrative}

### The never-automate line

{never_automate}

## 3. Economics — what the current state costs and what can be spent

{economics_narrative}

## 4. Organisation — who decides, what is missing, what competes

{organisation_narrative}

## 5. Direction — the moves

{for_each_priority}
### {priority_title}
**Status**: {rag_status}
**Why this move**: {recent_narrative}
{end_for_each}

## 6. The three proposals, on one gate

{proposal_assessment}

## 7. Vendor Tool Intelligence

{tool_intelligence}

## Recommended questions for the board

{recommended_questions}

## References

{source_list}
',
  NULL
)
ON CONFLICT (id) DO NOTHING;


-- ─── st_ai_config — the ai-strategy profile, bound to the engagement ────────

INSERT INTO st_ai_config (
  id, engagement_id, profile_key, llm_provider, llm_model, vocabulary_map, system_prompt_report
) VALUES (
  'ac000001-0004-4000-8000-000000000001',
  'a1b2c3d4-0004-4000-8000-000000000001',
  'ai-strategy',
  'anthropic',
  'claude-sonnet-4-20250514',
  '{
    "commitment_top_singular": "Strategic Move",
    "commitment_top_plural": "Strategic Moves",
    "commitment_sub_singular": "Action",
    "commitment_sub_plural": "Actions",
    "cross_cut_singular": "Lens",
    "cross_cut_plural": "Lenses",
    "commitment_add_verb": "add",
    "commitment_archive_verb": "retire",
    "evidence_singular": "source",
    "evidence_plural": "sources",
    "update_singular": "update",
    "update_plural": "updates",
    "drift_singular": "drift signal",
    "drift_plural": "drift signals"
  }'::jsonb,
  'You are Nera, generating the AI Strategy Report for Kestrel Mutual. The corpus contains two kinds of evidence: elicitation chunks (the chief executive intake and three stakeholder interviews, each stamped with its respondent and marked single-respondent) and vendor tool intelligence from the Intelligence Engine. Treat a single-respondent chunk as one account, not organisational truth; where accounts diverge, say so and cite both. Every claim must cite a chunk id or a [tool:…] reference. Never invent a figure; where the corpus is silent, write that it is silent. Use the vocabulary map: Strategic Moves, Actions, Lenses. Australian English. The never-automate line is binding: do not recommend automating any decision the corpus places on that list.'
)
ON CONFLICT (id) DO NOTHING;


-- ─── The corpus: 16 intake chunks (Chief Executive) ─────────────────────────
-- source_type = 'elicitation' so st-generate-report cites them like documents.
-- Every chunk is stamped single_respondent so the report treats it as one
-- account (the first of the three cautions in the CC-231 spec).

INSERT INTO knowledge_chunks (
  id, source_app, engagement_id, source_type, source_id, document_source, section_reference,
  chunk_text, chunk_summary, topic_tags, content_type, metadata, is_active, extraction_version
) VALUES
  ('e0000001-0004-4000-8000-000000000001', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'transformation_history',
   $q$Over two years Kestrel has spent about $6.2m on the transformation. Salesforce Service Cloud replaced the old contact-centre desktop in March 2025 and is the system the frontline lives in. A Snowflake warehouse went live in late 2024 and now holds roughly 60% of claims history; the rest is still in the policy administration system and a set of departmental extracts. Slack replaced email for internal case chatter in 2024, and Jira is used by the technology team and, unofficially, by the claims improvement group. What observably changed: average handling time in the contact centre fell in the first quarter after Service Cloud and has since crept back; the claims cycle went the other way, from 11 days to 19. The chief executive's own words: "we bought the systems we were told a modern insurer has, and the member experience got slower."$q$,
   'Two years, $6.2m: Service Cloud (Mar 2025), Snowflake at ~60% of claims history, Slack, Jira. Handling time improved then reverted; claim cycle lengthened from 11 to 19 days.',
   ARRAY['transformation history','salesforce','snowflake','claims cycle','investment'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":1}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000002', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'service_reality',
   $q$On a busy Tuesday afternoon a member lodges a motor claim through the app. The contact centre sees it in Service Cloud, but the assessor team works from a queue in the policy administration system, and the case does not appear there until an overnight sync. If a member calls the next morning, the contact centre can see the claim was lodged but not that an assessor has it, so they promise a call-back that the assessor does not know has been promised. The claims team keeps a shared spreadsheet beside Service Cloud to track what is really happening, because the case status field lags by a day. The chief executive estimates a fifth of complaints begin at exactly this point: not a wrong decision, a member who was told two different things by two people who could not see each other.$q$,
   'The lodgement-to-assessor handoff runs across two systems with an overnight sync; a parallel spreadsheet fills the gap; about a fifth of complaints start here.',
   ARRAY['service reality','claims handoff','contact centre','workaround','complaints'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":2}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000003', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'theatre_vs_change',
   $q$Two things are officially finished. The "single member view" was declared delivered in Service Cloud in mid-2025; in practice the view shows contact history but not claims status or payments, so the frontline opens two other screens for every call. The knowledge base was also declared complete; it is where the contact centre is told to look, and where most of them do not, because the articles were written by the vendor's implementation team and the phrasing does not match how members ask. The chief executive was candid that both were reported green to the board because the milestones were delivered as contracted. "Nobody lied. We just measured whether the thing was built, not whether anyone used it."$q$,
   'Two green-reported deliverables are worked around: the single member view (missing claims and payments) and the knowledge base (vendor-written, unused).',
   ARRAY['transformation theatre','single member view','knowledge base','workaround','board reporting'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":3}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000004', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'values_behaviour_gap',
   $q$Kestrel's stated values are "members first" and "we keep our word". The chief executive would expect a visitor to see the first in the contact centre, where staff routinely stay past shift to finish a member's call. She would expect them to see the opposite in the transformation programme, where the frontline was consulted after decisions rather than before and where the phrase "adoption problem" is used to describe people declining to use tools that make their day longer. "We say members first. The programme behaved as if the vendor came first and the frontline third." She also named a smaller gap: the values talk about keeping promises, and the handoff makes staff break small promises to members daily through no fault of their own.$q$,
   'Values say members first and keeping promises; the programme consulted the frontline after decisions and labelled non-use an adoption problem.',
   ARRAY['values','behaviour gap','frontline','adoption','culture'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":4}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000005', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'ai_in_play',
   $q$Sanctioned: Salesforce Service Cloud for the contact centre and case management; Snowflake as the warehouse; Microsoft 365 with Outlook for email and the executive calendar; Slack for internal case chatter; Jira in technology and, by adoption rather than decision, in the claims improvement group. AI features in use officially: the Salesforce case summarisation feature, switched on for team leaders only. Unsanctioned: several contact-centre staff use a consumer AI assistant on their phones to rephrase difficult emails to members, and at least one claims assessor pastes anonymised claim descriptions into a public chatbot to draft decline letters. The chief executive learned of the second from a team leader, not from any control. Nothing has been written down about what is permitted.$q$,
   'Sanctioned: Salesforce Service Cloud, Snowflake, Microsoft 365 with Outlook, Slack, Jira; Salesforce summarisation for team leaders. Shadow: consumer chatbots for member emails and decline letters.',
   ARRAY['tools in play','salesforce','snowflake','slack','jira','shadow AI'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":5}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000006', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'ai_readiness',
   $q$Asked what would be in the way of automating something meaningful tomorrow, the chief executive listed three things without pausing. Data: claims history is split between Snowflake and the policy administration system, and the member identifier differs between them, so any model would train on the recent 60% and guess at the rest. Process: the handoff is not documented anywhere; it lives in the spreadsheet and in people's heads, so there is nothing yet for a model to follow. Governance: there is no policy on AI use, no model-risk role, and the audit and risk committee has asked twice for a position on CPS 230 implications and received a holding reply both times. She resisted scoring readiness. "We are ready to fix the plumbing. We are not ready to buy a model, and I would rather say that than pretend."$q$,
   'Three obstacles: split claims data with mismatched member identifiers; undocumented handoff; no AI policy, no model-risk role, CPS 230 position outstanding.',
   ARRAY['AI readiness','data quality','governance','CPS 230','model risk'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":6}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000007', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'never_automate',
   $q$The chief executive answered this one fastest of all sixteen. Total-loss determinations stay with a person, because a member whose car or home has been written off needs to hear it from someone who can explain and can be argued with. Vulnerability and hardship cases stay with a person, because the signals are subtle and the cost of a machine missing one is a member the mutual failed. Any decline stays with a person. She was explicit that this is not a technical limitation but a decision about what kind of insurer Kestrel is: "if we let a model say no to a member, we have stopped being a mutual and started being a platform." She would accept a model preparing the file, surfacing the history, and drafting the letter, provided a named person decides and signs.$q$,
   'Never automate: total-loss determinations, vulnerability and hardship, any decline. Models may prepare, surface and draft; a named person decides and signs.',
   ARRAY['never automate','human judgement','declines','vulnerability','member trust'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":7}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000008', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'vendor_exposure',
   $q$Three proposals are on the desk. First, a claims-triage model from an insurtech vendor, Larkfield AI, pushed by the Chief Operating Officer; it promises to route and score claims at lodgement, has been demonstrated on the vendor's own sample data only, and the contract as drafted trains on Kestrel claims data with no stated deletion terms. Second, a contact-centre copilot from the CRM vendor, pushed by the Head of Customer; it is the path of least resistance because it lives inside Service Cloud, and it is also the one the frontline has heard least about. Third, an internal build on Snowflake, pushed by the Head of Data; it is the cheapest on paper and depends on the 40% of claims history that is not yet in the warehouse. The chief executive's concern: each proposal arrives with its own urgency and its own sponsor, and the board has never seen them side by side.$q$,
   'Three proposals with three sponsors: Larkfield AI claims triage (demo on vendor data, trains on Kestrel data, no deletion terms), CRM-vendor copilot, internal Snowflake build dependent on missing data.',
   ARRAY['vendor exposure','proposals','claims triage','copilot','data rights'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":8}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000009', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'hidden_costs',
   $q$Figures the chief executive is sure of: member complaints up 38% year on year; contact-centre voluntary turnover at 34%, against 22% two years ago; a complaints team that has grown from three to seven people. Estimates she labelled as estimates: rework on claims handoffs at roughly one in eight claims, which the claims manager puts at four to five full-time roles of effort; member lapse at renewal for members who complained in the prior year running at about double the base rate, which finance has not yet costed but which she believes is the largest number on the page. What she does not have: a cost-to-serve figure per claim that includes rework and complaints handling. "We know what the transformation cost. We have never added up what the current state costs. That is the number the board should be looking at."$q$,
   'Known: complaints +38%, turnover 34% (was 22%), complaints team 3 to 7. Estimated: rework on 1 in 8 claims (~4-5 FTE), lapse among complainants double the base rate. Missing: cost to serve per claim.',
   ARRAY['hidden costs','complaints','turnover','rework','cost to serve'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":9}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000010', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'investment_appetite',
   $q$The FY27 budget holds $1.5m for "digital and data", of which about $400k is already committed to licence renewals. The chief executive can approve up to $500k on her own signature; anything above that goes to the board, and any multi-year contract goes to the board regardless of value. She would rather spend the discretionary amount finishing the data work than on a new licence, and said so before being asked. On the three proposals: Larkfield's indicative price is $900k over three years; the CRM copilot is an add-on at roughly $180k a year; the internal build is "whatever the data team can do with two more people", which she costed at about $350k a year. Her appetite in one line: "I will spend on things I can explain to a member at the annual meeting."$q$,
   'FY27 digital and data budget $1.5m ($400k committed). CEO signs to $500k; board above that or any multi-year term. Proposal prices: Larkfield ~$900k/3yr, copilot ~$180k/yr, internal build ~$350k/yr.',
   ARRAY['investment appetite','budget','approval','board','proposal pricing'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":10}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000011', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'board_argument',
   $q$Two directors push back, from opposite directions. The chair's objection is member trust: he has read the newspaper coverage of automated claims decisions elsewhere and does not want Kestrel's name in a story like that, so any proposal with "AI" in the title starts behind. The chair of the audit and risk committee has the opposite worry: that Kestrel is falling behind, that CPS 230 makes operational resilience a board obligation, and that the current handoff mess is itself a resilience failure the regulator could ask about. The argument the chief executive has to win is that these two objections are the same argument: fix the process and publish the never-automate line, and both directors get what they want. She has not yet made that argument in the room. "I have been answering each of them separately, which means I lose to both."$q$,
   'Chair: member trust, wary of AI headlines. Audit and risk chair: falling behind, CPS 230 resilience. The winning argument treats both as one: fix the process, publish the never-automate line.',
   ARRAY['board argument','member trust','CPS 230','governance','objections'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":11}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000012', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'decision_rights',
   $q$On paper the transformation steering committee decides, chaired by the chief executive, meeting monthly. In practice the Chief Operating Officer and the Chief Information Officer each hold a veto they exercise by delay: a proposal one of them does not favour is "taken offline for more detail" and returns two meetings later, if at all. Decisions above $500k or with a multi-year term go to the board, which meets every second month, so a proposal raised in the wrong month waits four. The Head of Customer, who sponsors the copilot, is not on the steering committee. The chief executive's own description of where things stall: "between the COO and the CIO, in the gap where neither of them owns the member." She would like the committee to make one decision on all three proposals in one sitting, and doubts it will without a rule that forces it.$q$,
   'Steering committee monthly; COO and CIO veto by delay; board bi-monthly for >$500k or multi-year; Head of Customer not on the committee. Decisions stall between COO and CIO.',
   ARRAY['decision rights','steering committee','veto','board cadence','ownership'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":12}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000013', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'capability_gaps',
   $q$Three roles are missing and one is unfilled. Missing: a data product owner for the member record (nobody is accountable for what it contains); a model-risk or AI governance role (the audit and risk committee has asked for one); and a service designer who can map the handoff with the frontline rather than for them. Unfilled: the change lead resigned in May 2026 and has not been replaced, so the transformation programme currently has a project manager and no one whose job is the people. The chief executive noted, unprompted, that the technology team describes itself as "under-resourced" and that she is not sure whether that is a capability gap or a defensive reflex. "They have never been asked to do this, so I do not yet know whether they can."$q$,
   'Missing: data product owner, model-risk/AI governance role, service designer. Unfilled since May 2026: change lead. Technology team self-describes as under-resourced; CEO unsure if that is gap or defence.',
   ARRAY['capability gaps','data product owner','model risk','change lead','service design'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":13}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000014', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'change_capacity',
   $q$This quarter the same people are carrying three other things. The CPS 230 programme has its first attestation due at the end of the financial year and is consuming the risk team and a third of technology. The policy administration system migration, deferred twice, is now scheduled for the fourth quarter and will freeze changes to claims data for six weeks. The annual member renewal cycle peaks in October and the contact centre cannot release anyone for pilots in that window. The chief executive was blunt that any AI initiative launched into the fourth quarter would compete with all three and lose. Her preferred window for anything that touches the frontline is the second quarter of FY27, after the migration settles and before the next renewal peak.$q$,
   'Competing this quarter: CPS 230 attestation at EOFY, policy admin migration in Q4 (six-week data freeze), October renewal peak. Frontline window: Q2 FY27.',
   ARRAY['change capacity','CPS 230','migration','renewal peak','sequencing'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":14}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000015', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'success_signals',
   $q$A year from now the chief executive would want to see, in this order: complaints back to the 2024 level, which means reversing the 38% rise; the median claim cycle at or under ten days, from nineteen, without any rise in decisions overturned on review; first-contact resolution in the contact centre at or above 70%, which nobody currently measures because the systems cannot; contact-centre turnover under 25%; and a never-automate list that the frontline can quote without looking it up. Pushed for something she could point at on a Tuesday afternoon, she chose the spreadsheet: "if the claims team has closed the spreadsheet because they do not need it, I will know the handoff is fixed. Nobody will need to tell me."$q$,
   'Signals: complaints back to 2024 level; median claim cycle ≤10 days with no rise in overturns; first-contact resolution ≥70%; turnover <25%; never-automate list known by heart; the claims spreadsheet closed.',
   ARRAY['success signals','complaints','claim cycle','first contact resolution','turnover'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":15}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000001-0004-4000-8000-000000000016', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000001',
   'Intake — Digital Strategy pro forma (Chief Executive, 12 Aug 2026)', 'commitments_30_60_90',
   $q$Thirty days: map the claims handoff end to end with the people who run it, and publish the never-automate list with board endorsement. Sixty days: put all three AI proposals through a single evidence gate at one steering committee sitting, with the same five vendor questions answered in writing, and appoint a data product owner for the member record. Ninety days: one frontline-designed pilot live with a measured baseline, in the contact centre, on a problem the team chose. The chief executive added a condition to all three: nothing is signed with any vendor until the ninety days are up. "If a proposal cannot wait ninety days for us to fix our own plumbing, it was never about us."$q$,
   '30 days: map the handoff, publish never-automate. 60 days: one gate for all three proposals, appoint data owner. 90 days: frontline pilot with baseline. No vendor contract inside the 90 days.',
   ARRAY['commitments','30 60 90','handoff','never automate','pilot'], 'governance',
   '{"respondent":"Chief Executive","single_respondent":true,"self_reported":true,"captured_at":"2026-08-12","stage":"intake","dimension":16}'::jsonb, true, 'st-elicitation-1.0')
ON CONFLICT (id) DO NOTHING;


-- ─── The corpus: 12 stakeholder chunks — where the accounts diverge ─────────

INSERT INTO knowledge_chunks (
  id, source_app, engagement_id, source_type, source_id, document_source, section_reference,
  chunk_text, chunk_summary, topic_tags, content_type, metadata, is_active, extraction_version
) VALUES
  ('e0000002-0004-4000-8000-000000000001', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Chief Operating Officer (14 Aug 2026)', 'service_reality',
   $q$The Chief Operating Officer describes the handoff differently from the chief executive. In his account the overnight sync is a known limitation that was accepted at go-live to hit the date, and the spreadsheet is "a temporary measure that has been temporary for sixteen months". He puts the share of complaints originating at the handoff lower, at around one in ten, and attributes more to assessor capacity: two assessor vacancies have been open since March. He sees the Larkfield triage model as the fix, because it would route claims before the sync matters. He acknowledged, when asked, that the model would route claims into the same queue the assessors cannot see until morning.$q$,
   'COO: overnight sync was an accepted go-live trade-off; complaints at the handoff nearer 1 in 10, assessor vacancies matter more; sees Larkfield triage as the fix, but it routes into the same unseen queue.',
   ARRAY['service reality','claims handoff','assessor capacity','divergence','triage'], 'governance',
   '{"respondent":"Chief Operating Officer","single_respondent":true,"self_reported":true,"captured_at":"2026-08-14","stage":"stakeholder","dimension":2}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000002', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Chief Operating Officer (14 Aug 2026)', 'vendor_exposure',
   $q$The Chief Operating Officer has seen the Larkfield AI triage model demonstrated twice, both times on the vendor's sample portfolio, and has been offered a "proof of value" on Kestrel data at no charge. He has not read the data clauses in the draft contract and was surprised to learn it grants the vendor training rights with no deletion terms; he said he had assumed legal would catch that. He considers the internal Snowflake build "a science project" and the CRM copilot "a distraction from claims". Asked which proposal he would sign tomorrow if he could, he said Larkfield, and asked why, he said "because it is the only one that talks about the claims cycle."$q$,
   'COO has seen Larkfield twice on vendor data; unaware of the training-rights clause; dismisses the internal build and the copilot; would sign Larkfield because it targets the claims cycle.',
   ARRAY['vendor exposure','larkfield','data rights','proof of value','sponsorship'], 'governance',
   '{"respondent":"Chief Operating Officer","single_respondent":true,"self_reported":true,"captured_at":"2026-08-14","stage":"stakeholder","dimension":8}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000003', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Chief Operating Officer (14 Aug 2026)', 'decision_rights',
   $q$The Chief Operating Officer does not recognise the description of a veto by delay. In his account, proposals go "offline for more detail" because they arrive at the steering committee without a business case, and he would rather ask for one than approve on a slide. He agrees the board's bi-monthly cadence adds a month or more to anything over $500k. He was not aware the Head of Customer is not on the steering committee and thought she was. He would support a rule that all three proposals are decided at one sitting, provided each comes with the same one-page case, and offered to write the template for that case himself.$q$,
   'COO rejects the veto-by-delay framing (proposals lack business cases); confirms the board cadence cost; unaware the Head of Customer is off the committee; would back a one-sitting decision with a common one-page case.',
   ARRAY['decision rights','steering committee','business case','divergence'], 'governance',
   '{"respondent":"Chief Operating Officer","single_respondent":true,"self_reported":true,"captured_at":"2026-08-14","stage":"stakeholder","dimension":12}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000004', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Chief Operating Officer (14 Aug 2026)', 'success_signals',
   $q$A year from now the Chief Operating Officer would want to see the claims cycle under ten days and the two assessor vacancies filled, in that order of importance. He does not track first-contact resolution and was doubtful it could be measured with the current systems. He would consider the never-automate list a reasonable thing to publish but does not think it changes anything operationally, "because we were never going to let a model decline a claim anyway". Asked what he would notice on a Tuesday afternoon, he said fewer escalations reaching his inbox by four o'clock; he currently receives, on his estimate, six to ten a day.$q$,
   'COO: claim cycle <10 days and assessor vacancies filled; doubts first-contact resolution is measurable; sees the never-automate list as reasonable but non-operational; Tuesday signal: fewer than six to ten daily escalations.',
   ARRAY['success signals','claim cycle','escalations','never automate','divergence'], 'governance',
   '{"respondent":"Chief Operating Officer","single_respondent":true,"self_reported":true,"captured_at":"2026-08-14","stage":"stakeholder","dimension":15}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000005', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Contact Centre Team Leader (15 Aug 2026)', 'service_reality',
   $q$The team leader's Tuesday afternoon has more detail than either executive account. A member calls about a claim lodged the day before; the agent sees the lodgement in Service Cloud, cannot see an assessor, and has three choices: promise a call-back nobody will know to make, put the member on hold to message the claims team on Slack and wait for someone to check the spreadsheet, or tell the member honestly that they cannot see what is happening. Agents are coached to do the second, which adds four to six minutes to the call and is the reason average handling time has crept back up. She counts the spreadsheet check as happening on "most calls about a claim lodged in the last two days", which she estimates at 60 to 80 calls a day across the floor.$q$,
   'Frontline detail: the agent's three options at the handoff; coached to hold and check the spreadsheet via Slack (4-6 min per call), which explains handling time creeping back; 60-80 such calls a day.',
   ARRAY['service reality','contact centre','handling time','slack','spreadsheet'], 'governance',
   '{"respondent":"Contact Centre Team Leader","single_respondent":true,"self_reported":true,"captured_at":"2026-08-15","stage":"stakeholder","dimension":2}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000006', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Contact Centre Team Leader (15 Aug 2026)', 'never_automate',
   $q$The team leader's never-automate line is longer than the chief executive's. She adds two items: the first conversation after a bereavement claim, and any call where the member is angry, "because an angry member is telling you something the system missed and a machine will hear the words and not the thing". She is not opposed to a copilot that drafts the follow-up email or finds the policy wording; she is opposed to anything that talks to a member without an agent choosing to send it. She had not heard of the CRM copilot proposal before the interview and was visibly unhappy that a tool for her team was being considered without anyone on her team having seen it.$q$,
   'Team leader adds bereavement first-contact and angry calls to the never-automate line; accepts drafting and lookup copilots; had not heard of the copilot proposal for her own team.',
   ARRAY['never automate','frontline','copilot','bereavement','consultation'], 'governance',
   '{"respondent":"Contact Centre Team Leader","single_respondent":true,"self_reported":true,"captured_at":"2026-08-15","stage":"stakeholder","dimension":7}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000007', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Contact Centre Team Leader (15 Aug 2026)', 'capability_gaps',
   $q$The last big change, the Service Cloud go-live, leaned on the change lead who left in May and on two senior agents who wrote the unofficial cheat sheets everyone actually uses instead of the knowledge base. Both senior agents are still on the floor; neither has been asked to help with anything since. The team leader's view of the gap is practical: nobody is currently paid to turn what the floor knows into something the systems know. She would want one of those two agents seconded, half-time, to any pilot, and said the pilot would fail without it. She was careful to say the technology team are "good people who have never sat on the floor".$q$,
   'The Service Cloud go-live depended on the departed change lead and two senior agents whose cheat sheets replaced the knowledge base; nobody now converts floor knowledge into system knowledge; second one agent half-time to any pilot.',
   ARRAY['capability gaps','change lead','frontline knowledge','pilot','secondment'], 'governance',
   '{"respondent":"Contact Centre Team Leader","single_respondent":true,"self_reported":true,"captured_at":"2026-08-15","stage":"stakeholder","dimension":13}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000008', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Contact Centre Team Leader (15 Aug 2026)', 'success_signals',
   $q$On a Tuesday afternoon a year from now the team leader would want an agent to be able to answer "where is my claim" in one screen and one sentence. She would measure it by the number of Slack messages to the claims channel, which she can already count and which currently runs at over a hundred a day. She agrees with the turnover target and thinks it is achievable "if people stop having to apologise for things they cannot see". She does not expect to notice the never-automate list day to day but wants it in writing so that the next executive who arrives with a proposal has to read it first.$q$,
   'Team leader's signal: "where is my claim" answered in one screen; measure = Slack messages to the claims channel (currently >100/day); turnover target achievable if agents stop apologising for what they cannot see.',
   ARRAY['success signals','single member view','slack','turnover','measurement'], 'governance',
   '{"respondent":"Contact Centre Team Leader","single_respondent":true,"self_reported":true,"captured_at":"2026-08-15","stage":"stakeholder","dimension":15}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000009', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Head of Data (18 Aug 2026)', 'ai_readiness',
   $q$The Head of Data was precise about what a model would get wrong first: identity. The policy administration system keys members on a policy number; Service Cloud keys them on an email address; Snowflake carries both and matches them with a rule that fails for about 7% of members, typically households with more than one policy or members who changed email. Any triage model trained on Snowflake would treat those members as strangers with no history. He puts the remaining claims-history load at eight to ten weeks of work for two people, which is the same two people the CPS 230 programme has borrowed. He does not think the data is "bad"; he thinks it is unfinished, and objects to vendors describing it as a reason to buy their model rather than a reason to finish.$q$,
   'Head of Data: identity mismatch across three keys fails ~7% of members; remaining history load is 8-10 weeks for two people currently on CPS 230; data is unfinished, not bad.',
   ARRAY['AI readiness','identity resolution','snowflake','data quality','capacity'], 'governance',
   '{"respondent":"Head of Data","single_respondent":true,"self_reported":true,"captured_at":"2026-08-18","stage":"stakeholder","dimension":6}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000010', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Head of Data (18 Aug 2026)', 'vendor_exposure',
   $q$The Head of Data sponsors the internal build and was open about its dependency: it needs the full claims history, which is the same work his team cannot start until CPS 230 releases them. He has read the Larkfield contract and is the person who noticed the training-rights clause; he raised it with the Chief Operating Officer in an email in July and did not receive a reply. He is not opposed to the CRM copilot in principle but points out it would read the same incomplete member view the agents already distrust. His own proposal is cheapest because it assumes the data work is done, which he concedes is "the assumption doing all the work". He would support a single gate and expects his build to lose on timing.$q$,
   'Head of Data flagged the Larkfield training-rights clause to the COO in July with no reply; the copilot would read the same distrusted member view; his own build assumes finished data; expects to lose on timing at a single gate.',
   ARRAY['vendor exposure','larkfield','data rights','internal build','single gate'], 'governance',
   '{"respondent":"Head of Data","single_respondent":true,"self_reported":true,"captured_at":"2026-08-18","stage":"stakeholder","dimension":8}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000011', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Head of Data (18 Aug 2026)', 'change_capacity',
   $q$The Head of Data's calendar for the next two quarters has no free capacity in it. CPS 230 attestation work runs to the end of the financial year; the policy administration migration in the fourth quarter needs his team for the data cutover and imposes a six-week freeze on claims data; and the two people who could finish the Snowflake load are the same two people on both. He was direct that the chief executive's preferred second-quarter window is the only realistic one, and that even that assumes a data product owner is hired before the migration, not after, so that the person owns the cutover decisions. He asked that the report say this plainly, because "every plan so far has assumed my team exists twice".$q$,
   'No free data capacity for two quarters (CPS 230, Q4 migration with a six-week freeze); the Q2 FY27 window holds only if the data product owner is hired before the migration.',
   ARRAY['change capacity','CPS 230','migration','data team','sequencing'], 'governance',
   '{"respondent":"Head of Data","single_respondent":true,"self_reported":true,"captured_at":"2026-08-18","stage":"stakeholder","dimension":14}'::jsonb, true, 'st-elicitation-1.0'),
  ('e0000002-0004-4000-8000-000000000012', 'strategic-tool', 'a1b2c3d4-0004-4000-8000-000000000001', 'elicitation', '50000001-0004-4000-8000-000000000002',
   'Stakeholder elicitation — Head of Data (18 Aug 2026)', 'decision_rights',
   $q$From the Head of Data's seat the steering committee is not where decisions are made; it is where they are recorded. The real decision on Service Cloud was made between the Chief Information Officer and the vendor before the committee saw it, and he expects the same to happen with Larkfield unless a rule prevents it. He has no seat on the committee and presents to it by invitation. He supports the chief executive's one-sitting rule and would add one condition: that no proposal is heard until the data readiness section of its case has been written by his team rather than by the vendor. He did not say this defensively; he said it because "the last three business cases described data we do not have".$q$,
   'Head of Data: the committee records decisions already made between the CIO and vendors; no seat, presents by invitation; backs the one-sitting rule with a condition that data-readiness sections are written by his team, not the vendor.',
   ARRAY['decision rights','steering committee','CIO','vendor influence','data readiness'], 'governance',
   '{"respondent":"Head of Data","single_respondent":true,"self_reported":true,"captured_at":"2026-08-18","stage":"stakeholder","dimension":12}'::jsonb, true, 'st-elicitation-1.0')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- End of Kestrel Mutual demo seed.
-- 1 engagement (profile ai-strategy, 5 tools in play), 6 organisational
-- pillars, 5 Strategic Moves, 8 Actions, 3 Lenses, 4 stages with populated
-- question sets, 1 AI Strategy Report template, 1 ai_config with a report
-- prompt, and a 28-chunk elicitation corpus (16 intake + 12 stakeholder), all
-- stamped single-respondent. The report step has evidence to cite from the
-- first open. Requires 0018_demo_kestrel_mutual.sql for public demo access.
-- =============================================================================
