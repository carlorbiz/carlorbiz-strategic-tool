-- =============================================================================
-- Carlorbiz Strategic Tool — Sovereignty signal on the Pillar Briefing
-- supabase/seed/templates/pillar-briefing-sovereignty-signal.sql
--
-- The Sovereignty Drift half of the Pillar Briefing, per migration 0010.
-- Tracked as CC Inbox CC-11.
--
-- Exact parallel of pillar-briefing-distinctiveness-signal.sql, and sits
-- immediately after it so the two lenses read in the order the trilogy runs:
-- is this position still ours (distinctiveness), and can we still demonstrate
-- we hold it (sovereignty). Reads against the pillar's sovereignty_claim.
--
-- Board and governance-register framing, not HR. The question is never who
-- breached a policy — it is what the organisation can evidence to a regulator,
-- an auditor, an acquirer or a court. The template says so where the model
-- will read it, because st-generate-report fills placeholders section by
-- section from the surrounding template text.
--
-- Idempotent UPDATE, safe to re-run.
-- =============================================================================

BEGIN;

UPDATE st_reporting_templates
SET template_markdown = replace(
  template_markdown,
  E'**Implications surfaced by Nera:**',
  E'**Sovereignty signal:**\n\n'
  || E'Can the organisation still demonstrate it holds what this pillar commits it to hold? '
  || E'Read the corpus against the pillar''s stated sovereignty commitment across the six '
  || E'signals: shadow AI usage, off-system IP creation, contractor-blur boundaries, AI-tool '
  || E'licensing exposure, data-residency drift, and oversight-without-visibility. Say plainly '
  || E'which of three the evidence shows: the commitment is DEMONSTRABLE (the corpus contains '
  || E'the register entry, the clause or the control that evidences it), the commitment is '
  || E'ASSERTED (it is stated in our documents but nothing in the corpus evidences it in '
  || E'practice), or the commitment has DRIFTED (the corpus shows practice that contradicts '
  || E'it). Where the pillar carries no stated sovereignty commitment, say so first. Write this '
  || E'for the governance register: name the exposure, the evidence and the control, never an '
  || E'individual.\n\n'
  || E'{sovereignty_signal}\n\n'
  || E'**Implications surfaced by Nera:**'
)
WHERE name = 'Pillar Briefing'
  AND template_markdown LIKE '%**Implications surfaced by Nera:**%'
  AND template_markdown NOT LIKE '%{sovereignty_signal}%';

COMMIT;
