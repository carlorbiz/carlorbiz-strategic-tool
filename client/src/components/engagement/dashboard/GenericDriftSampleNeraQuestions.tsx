// GenericDriftSampleNeraQuestions — the Generic Drift lens's "Try asking Nera"
// panel. Mirrors SampleNeraQuestions (research-intelligence profile) in shape
// and behaviour; the prompts are what differ.
//
// Item #3 of the Generic Drift queue. Tracked as CC Inbox CC-11.
//
// These are written as questions a Chair or a director would actually put to
// the corpus during the two and a half hours the board workbook asks for —
// not "find me the strategic plan" but "has the language outlived the
// organisation it describes". Each maps 1:1 onto one of the eight Chapter 6
// warning signs, in the same order as the Generic Drift Detection report
// template, so a board that clicks through the panel has walked the diagnostic.
//
// The prompts lean on migration 0020's primary_document_type / document_period
// deliberately: every one of them is a question across a window, which is the
// thing the corpus could not answer before the ingestion format expansion.

import { useStrategicChat } from '@/contexts/StrategicChatContext';
import { useEngagement } from '@/contexts/EngagementContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Search, ArrowRight } from 'lucide-react';

const GENERIC_DRIFT_PROMPTS = [
  'Read our strategic plans in order of the period they speak for. Has the language about our position stayed the same across a window in which our operating reality materially changed?',
  'Where do outside voices in the corpus — analysts, media, members, customers — describe us in terms our own documents do not yet use about ourselves?',
  'Find the places where we justify a decision by what the sector or our peers are doing rather than by our own strategic logic. How much of our recent reasoning is benchmarking standing in for judgement?',
  'From the corpus alone, what can you say we have deliberately chosen NOT to do, not to build, and not to claim? If you cannot name our exclusion choices, say so plainly.',
  'Have any changes to our ownership, capital, membership or decision rights quietly removed the operational grounding of a positioning claim we still make in public?',
  'Compare the strategic language before and after our recent leadership changes. Did the transition import the assumptions of our wider field faster than it preserved our own strategic memory?',
  'Where we have grown, has the growth strengthened the lived reality of our central differentiating claim, or has the claim stayed in the language while the substance thinned out?',
  'Are we reaching for new narrative, campaigns and refreshed language faster than we are rebuilding the operations that language describes? Cite the evidence on both sides.',
];

export function GenericDriftSampleNeraQuestions() {
  const { askNera, isLoading, isStreaming } = useStrategicChat();
  const { aiConfig } = useEngagement();
  const isGenericDriftProfile = aiConfig?.profile_key === 'generic-drift';

  // Only show for consulting / Generic-Drift engagements. A research or
  // strategic-plan engagement gets a different panel or none — the eight
  // signals are board-diagnostic questions, not general corpus queries.
  if (!isGenericDriftProfile) return null;

  const disabled = isLoading || isStreaming;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="w-4 h-4" />
          Ask Nera the eight drift signals
        </CardTitle>
        <CardDescription>
          The eight warning signs, put to your own corpus. Click any to have Nera answer
          from your primary documents, with citations. Working through all eight is the
          continuous version of the board workbook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {GENERIC_DRIFT_PROMPTS.map((q, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => askNera(q)}
            className="w-full text-left text-sm p-2.5 rounded border bg-muted/30 hover:bg-muted hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-2 group"
          >
            <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>{q}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
