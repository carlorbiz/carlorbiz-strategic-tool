-- =============================================================================
-- Carlorbiz Strategic Tool — Distinctiveness signal on the Pillar Briefing
-- supabase/seed/templates/pillar-briefing-distinctiveness-signal.sql
--
-- Item #4 of the Generic Drift queue per migration 0009. Tracked as CC-11.
--
-- Migration 0009 named this change precisely: a "distinctiveness signal
-- column" on the Pillar Briefing that "assesses whether the corpus evidence
-- supporting this pillar would equally support a peer's claim".
--
-- A note on "column". The Pillar Briefing is not a table — it is a per-pillar
-- markdown block repeated under {for_each_pillar}. The plainer reading, and
-- the one taken here, is the sense migration 0009 itself uses when it calls
-- distinctiveness_claim a column: a named field carried for every pillar. So
-- the signal ships as a named subsection inside the per-pillar block, in the
-- position a board reads it — after the evidence, before the implications,
-- because it is a judgement ON the evidence rather than more of it.
--
-- The section body is prose rather than a bare {placeholder} because
-- st-generate-report fills placeholders section by section from the
-- surrounding template text (parseTemplateSections). The framing IS the
-- prompt: the substitution test is what makes the answer honest rather than
-- flattering, so it is stated in the template where the model will read it.
--
-- Idempotent UPDATE rather than INSERT: the Pillar Briefing already exists
-- live (ab000003-0003-4000-8000-000000000001, Rural Futures Australia demo)
-- and had no repo seed file. This checks the change in and is safe to re-run.
-- =============================================================================

BEGIN;

UPDATE st_reporting_templates
SET template_markdown = replace(
  template_markdown,
  E'**Implications surfaced by Nera:**',
  E'**Distinctiveness signal:**\n\n'
  || E'Would the evidence above equally support a peer organisation making the same claim? '
  || E'Read the corpus supporting this pillar against the pillar''s stated point of difference. '
  || E'Say plainly which of three the evidence shows: the claim is EARNED (the evidence is '
  || E'specific to this organisation and a peer could not substitute it), the claim is '
  || E'GENERIC (a peer could adopt the same language verbatim and the same evidence would '
  || E'still read true), or the claim is UNTESTED (the corpus is too thin to tell). Where the '
  || E'pillar carries no stated point of difference at all, say so first — an unarticulated '
  || E'claim cannot be honoured or breached, and naming one is the board''s next move.\n\n'
  || E'{distinctiveness_signal}\n\n'
  || E'**Implications surfaced by Nera:**'
)
WHERE name = 'Pillar Briefing'
  AND template_markdown LIKE '%**Implications surfaced by Nera:**%'
  AND template_markdown NOT LIKE '%{distinctiveness_signal}%';

COMMIT;
