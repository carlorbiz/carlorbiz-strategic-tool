-- =============================================================================
-- Carlorbiz Strategic Tool — Generic Drift Detection report template
-- supabase/seed/templates/generic-drift-detection.sql
--
-- The continuous version of Generic Drift Chapter 4's Verbal-Actual Lag Test
-- workbook exercise. Eight sections, one per Chapter 6 warning sign. The
-- report and the chapter are structural mirrors of each other by design.
--
-- Item #5 of the Generic Drift queue per the Carlorbiz Strategic Tool —
-- Living Platform Projects page. Tracked as CC Inbox CC-14.
--
-- Inserted with engagement_id NULL as the global canonical template. Admin-
-- only by RLS design (st_user_has_engagement_access(NULL) returns false for
-- non-admins; admins bypass via the internal_admin branch). The intent is
-- that when a consulting / Generic-Drift profile engagement is created,
-- the application clones this template into an engagement-scoped row so the
-- engagement's reporting UI can see it. The clone mechanism is part of the
-- sovereignty-watch / consulting profile work queued under CC-11.
--
-- The eight signals come verbatim from Generic Drift Ch 6 — Early Warning
-- Signs of Generic Drift (MTMOT Books DB, Claude GUI 2026-05-17):
--   1. The verbal-actual lag
--   2. Outsiders see the problem first
--   3. Defensive benchmarking
--   4. Exclusion choices have become hard to name
--   5. Governance-form change treated as merely structural
--   6. Leadership transition imports category logic faster than strategic memory
--   7. Scale breaks community-embedded distinctiveness
--   8. Language repair before operations repair
-- =============================================================================

INSERT INTO st_reporting_templates (engagement_id, name, description, template_markdown, funder_type)
VALUES (
  NULL,
  'Generic Drift Detection',
  'Eight-signal diagnostic surfacing the gap between an organisation''s stated strategic position and what its corpus actually demonstrates. Mirrors Generic Drift Ch 6''s eight warning signs. Board-grade annual artefact; the continuous version of the Verbal-Actual Lag Test workbook exercise. Available to any engagement on a consulting / Generic-Drift profile.',
$template$# {client_name} — Generic Drift Detection

**Period:** {period_start} – {period_end}
**Pillars assessed:** {pillar_count}
**Primary documents in corpus:** {document_count}

---

## Executive synthesis

A cross-signal reading of how the corpus describes this organisation against how the organisation describes itself. Where stated position and lived evidence align, the synthesis confirms. Where they have drifted, the synthesis surfaces the gap before the market does.

{executive_synthesis}

---

## Signal 1 — The verbal-actual lag

Has the language the organisation uses about its strategic position remained stable across a window in which its operating reality has materially changed? The most reliable early signal of generic drift is the gap between the position the organisation remembers and the position it now actually inhabits.

{signal_verbal_actual_lag}

---

## Signal 2 — Outsiders see the problem first

Are analysts, journalists, customers, or sector observers describing this organisation's positioning in terms the organisation's internal documents do not yet acknowledge? External visibility consistently precedes internal acknowledgement in the case research.

{signal_outsiders_first}

---

## Signal 3 — Defensive benchmarking

Has benchmarking shifted from informing judgement to substituting for it? Peers stop being comparators to think against and become permission structures to defer to. Sentences like "everyone else is doing this" or "we cannot be too far out of line with the sector" begin to dominate strategic conversation.

{signal_defensive_benchmarking}

---

## Signal 4 — Exclusion choices have become hard to name

Can leadership name what the organisation is deliberately NOT pursuing, NOT building, NOT claiming? A genuinely held position has an inverse: a set of exclusion choices that make the position real. If exclusion choices cannot be named, the position is probably decorative rather than strategic.

{signal_exclusion_choices}

---

## Signal 5 — Governance-form change treated as merely structural

Has any recent change to ownership structure, capital sourcing, member relationships, or decision-rights architecture quietly removed the operational grounding of an organisational positioning claim? Governance-form changes are positioning decisions with a long tail.

{signal_governance_change}

---

## Signal 6 — Leadership transition imports category logic faster than strategic memory

Have recent leadership changes imported the assumptions of the wider field faster than the organisation has preserved its strategic logic? Transitions are moments when distinctive positioning is most at risk of being replaced by industry norms.

{signal_leadership_transition}

---

## Signal 7 — Scale breaks community-embedded distinctiveness

Are scaling decisions strengthening the lived reality of the organisation's central differentiating claim, or hollowing it out while the language stays the same? Community-, mission-, or local-embeddedness claims are especially vulnerable to scale-driven flattening.

{signal_scale_community}

---

## Signal 8 — Language repair before operations repair

Is the organisation reaching for refreshed narrative, new campaigns, or new strategic language faster than it is rebuilding the operating reality the language describes? Language-first repair without operational substance widens the trust gap rather than closing it.

{signal_language_first_repair}

---

## Where the drift is most advanced

A short ranked reading of which signals are firing hardest, which are quiet, and which sit between. Boards should treat any two-or-more firing signals as a board-level conversation, not a management one.

{drift_concentration}

---

## Recommended next moves

Concrete next steps the board can take in the next planning cycle, ordered by leverage. Includes both diagnostic deepening (where the corpus needs more evidence) and structural moves (where the operating model needs adjustment to honour the stated position).

{recommended_actions}

---

*Generated by Nera from the {client_name} corpus, read against each pillar's distinctiveness_claim and against the organisation's primary documents (strategic plans, board papers, annual reports, public communications) ingested over the {period_start} – {period_end} window. Every claim cites a specific source. This report is the continuous version of the Verbal-Actual Lag Test exercise — read it as the diagnostic any board can run when it wants to know whether its stated position is still recognisably its own.*
$template$,
  NULL
)
ON CONFLICT DO NOTHING;
