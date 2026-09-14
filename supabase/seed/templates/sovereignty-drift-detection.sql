-- =============================================================================
-- Carlorbiz Strategic Tool — Sovereignty Drift Detection report template
-- supabase/seed/templates/sovereignty-drift-detection.sql
--
-- The third lens of the Drift Trilogy in the tool, and the structural parallel
-- of supabase/seed/templates/generic-drift-detection.sql (commit e39a0c0).
-- Six sections, one per sovereignty signal. The report and Sovereignty Drift
-- Ch 5 are structural mirrors of each other by design, exactly as the Generic
-- Drift report mirrors Generic Drift Ch 6.
--
-- Tracked as CC Inbox CC-11.
--
-- Inserted with engagement_id NULL as the global canonical template. Admin-
-- only by RLS design (st_user_has_engagement_access(NULL) returns false for
-- non-admins; admins bypass via the internal_admin branch). Cloned into an
-- engagement-scoped row when a sovereignty-watch profile engagement is
-- created, same as the Generic Drift template.
--
-- The six signals, locked at chapter-section granularity in Sovereignty Drift
-- Ch 5 (3639440556f78138bb8fdd7f42255555) and recorded in migration 0010:
--   1. Shadow AI usage
--   2. Off-system IP creation
--   3. Contractor-blur boundaries
--   4. AI-tool licensing exposure
--   5. Data-residency drift
--   6. Oversight-without-visibility
--
-- Board and governance-register framing throughout, not HR. This report is
-- written to be tabled, minuted and acted on by directors. It names exposures,
-- evidence and controls; it never names an individual, and the template says
-- so where the model will read it.
-- =============================================================================

INSERT INTO st_reporting_templates (engagement_id, name, description, template_markdown, funder_type)
VALUES (
  NULL,
  'Sovereignty Drift Detection',
  'Six-signal diagnostic surfacing the gap between the control an organisation believes it holds over its own knowledge, IP and data and what its corpus can actually evidence. Mirrors Sovereignty Drift Ch 5''s six signals. Board-grade annual artefact, written for the governance register rather than for management. Available to any engagement on a sovereignty-watch profile.',
$template$# {client_name} — Sovereignty Drift Detection

**Period:** {period_start} – {period_end}
**Pillars assessed:** {pillar_count}
**Primary documents in corpus:** {document_count}

---

## How to read this report

This is a board document. Every finding below is written as an exposure, the evidence for it, and the control that would close it. It does not name individuals and it is not a compliance audit of staff behaviour — where a signal is firing, the finding is about what the organisation can and cannot demonstrate, which is a governance question and sits with the board.

The standard applied throughout is the demonstrability standard: not "do we believe we hold this", but "could we show a regulator, an auditor, an acquirer or a court that we hold this". A commitment the organisation sincerely holds and cannot evidence is still an exposure.

---

## Executive synthesis

A cross-signal reading of what this organisation can still demonstrate it holds over its own knowledge, intellectual property and data, set against what its stated sovereignty commitments claim. Where commitment and evidence align, the synthesis confirms. Where they have parted, the synthesis surfaces the gap while it is still a governance matter rather than a dispute.

{executive_synthesis}

---

## Signal 1 — Shadow AI usage

Which AI tools does the corpus show actually in use across the organisation's work, and how does that compare with the tools its policies, registers and procurement records say have been approved? The gap between the sanctioned estate and the operating estate is the most common entry point for sovereignty drift, and it is almost never visible from the register alone. Report this at organisational level.

{signal_shadow_ai}

---

## Signal 2 — Off-system IP creation

Where is work of real value — method, analysis, client deliverables, models, prompts, training material — being created in places the organisation does not control and cannot retrieve from? The test is retrievability: what could this organisation not produce tomorrow if a tool, an account, or a relationship ended today?

{signal_off_system_ip}

---

## Signal 3 — Contractor-blur boundaries

For the contractors, agencies, associates and partners the corpus names, can the organisation point to the clause that assigns the intellectual property and governs the working environment? Where the boundary is asserted in narrative but not evidenced in an instrument, the assertion is the exposure. Distinguish carefully between relationships that are evidenced, those that are assumed, and those the corpus cannot see at all.

{signal_contractor_blur}

---

## Signal 4 — AI-tool licensing exposure

Read the organisation's AI-tool agreements, procurement records and renewals against what it actually does with those tools. Where do accepted terms — training rights, sub-processing, retention, jurisdiction — conflict with the confidentiality, intellectual-property or client commitments the organisation has made elsewhere? A term accepted at procurement and a promise made in a client contract are rarely read against each other, which is precisely why they drift apart.

{signal_licensing_exposure}

---

## Signal 5 — Data-residency drift

What does the corpus show about where the organisation's data and its clients' data physically sit, and who can compel access to it? Residency answers move quietly — a vendor changes region, a product tier changes default, a subprocessor is added — and the decision that moved them is often not recorded anywhere the board can find. Note both the current position and every point at which it appears to have moved without a recorded decision.

{signal_data_residency}

---

## Signal 6 — Oversight-without-visibility

Which sovereignty commitments does the board formally hold, assure, or report against, while having no reporting line that would tell it whether they are being honoured? This signal is the board's own exposure rather than management's: an assurance given without a line of sight is a governance failure regardless of whether the underlying commitment happens to be intact.

{signal_oversight_visibility}

---

## Where the drift is most advanced

A short ranked reading of which signals are firing hardest, which are quiet, and which sit between. Any two-or-more firing signals should be treated as a board-level conversation and minuted as one, not delegated to management as an operational fix.

{drift_concentration}

---

## Register entries this report recommends

The findings above, restated as governance register entries: the exposure, its evidence, the control that would close it, and whether closing it is a board decision or a management action. Written so they can be lifted into the register as they stand.

{register_entries}

---

## Recommended next moves

Concrete next steps the board can take in the next governance cycle, ordered by leverage. Includes both diagnostic deepening (where the corpus needs more evidence before a finding can be relied on) and structural moves (where an instrument, a control or a reporting line needs to exist for a commitment to be demonstrable).

{recommended_actions}

---

*Generated by Nera from the {client_name} corpus, read against each pillar's sovereignty_claim and against the organisation's primary documents (strategic plans, board papers, governance instruments, agreements, public communications) ingested over the {period_start} – {period_end} window. Every claim cites a specific source. Read this report the way a board reads a risk register: the value is in the exposures it can now name, not in the ones it hoped were absent.*
$template$,
  NULL
)
ON CONFLICT DO NOTHING;
