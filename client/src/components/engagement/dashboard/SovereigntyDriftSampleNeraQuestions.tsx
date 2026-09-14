// SovereigntyDriftSampleNeraQuestions — the Sovereignty Drift lens's "Try
// asking Nera" panel, and the third lens of the Drift Trilogy in the tool.
//
// Mirrors SampleNeraQuestions and GenericDriftSampleNeraQuestions in shape,
// behaviour and profile gating. Tracked as CC Inbox CC-11.
//
// One prompt per signal, in the order the six are locked in migration 0010
// and in Sovereignty Drift Ch 5:
//   1. Shadow AI usage
//   2. Off-system IP creation
//   3. Contractor-blur boundaries
//   4. AI-tool licensing exposure
//   5. Data-residency drift
//   6. Oversight-without-visibility
//
// Framed for the board and the governance register, not for HR. The question
// a director asks is never "who broke the policy" — it is "can we demonstrate
// to a regulator, an auditor, an acquirer or a court that we hold what we say
// we hold". Every prompt below is pointed at the register, the evidence and
// the control, and none of them asks the corpus to identify an individual.

import { useStrategicChat } from '@/contexts/StrategicChatContext';
import { useEngagement } from '@/contexts/EngagementContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ShieldAlert, ArrowRight } from 'lucide-react';

const SOVEREIGNTY_DRIFT_PROMPTS = [
  'Shadow AI. What do our own documents show about AI tools actually in use across the organisation, and how does that compare with the tools our policies and registers say we have approved? Report the gap at organisational level, not by person.',
  'Off-system IP. Where does the corpus show work of real value — method, analysis, client deliverables, models, training material — being created in places we do not control or cannot retrieve from? What would we be unable to produce if the tool or the account went away tomorrow?',
  'Contractor blur. For the contractors, agencies and associates named in our documents, can we point to the clause that assigns the IP and the control over the working environment? Where the boundary is asserted but not evidenced, say so.',
  'Licensing exposure. Read our AI-tool agreements, procurement records and renewals against what we actually do with those tools. Where do the terms we have accepted conflict with the confidentiality, IP or client commitments we have made elsewhere?',
  'Data residency. What does the corpus tell us about where our data and our clients’ data physically sit and who can compel access to it? Where have the answers moved without a decision being recorded?',
  'Oversight without visibility. Which of our sovereignty commitments does the board formally hold but have no reporting line for? Name the commitments we assure and cannot currently evidence — that gap is the board’s exposure, not management’s.',
];

export function SovereigntyDriftSampleNeraQuestions() {
  const { askNera, isLoading, isStreaming } = useStrategicChat();
  const { aiConfig } = useEngagement();
  const isSovereigntyProfile = aiConfig?.profile_key === 'sovereignty-watch';

  // Only show on the sovereignty-watch profile — the same gate PillarsPanel
  // uses for the sovereignty_claim nudge (commit 26f9e77), so research and
  // strategic-plan engagements never see the lens.
  if (!isSovereigntyProfile) return null;

  const disabled = isLoading || isStreaming;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Ask Nera the six sovereignty signals
        </CardTitle>
        <CardDescription>
          Six register-level questions about what this organisation can still demonstrate it
          holds. Click any to have Nera answer from your own corpus, with citations. These are
          board questions, not staff ones — they ask what is evidenced, never who.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {SOVEREIGNTY_DRIFT_PROMPTS.map((q, i) => (
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
