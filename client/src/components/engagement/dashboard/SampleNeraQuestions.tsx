// Demonstrative "Try asking Nera" panel. Renders a curated list of pillar-aware
// prompts that tie the corpus back to organisational purpose. Clicking a chip
// opens the Nera sheet and dispatches the question via askNera().
//
// These are deliberately written as questions a Programme Director or board
// member would actually ask — not librarian queries ("find me a paper") but
// strategic-intelligence queries ("which pillar is best served, which is silent,
// what should our next strategic plan emphasise"). The corpus is the input;
// pillar progress is the output.

import { useStrategicChat } from '@/contexts/StrategicChatContext';
import { useEngagement } from '@/contexts/EngagementContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';

const RESEARCH_PROMPTS = [
  'Of our four strategic pillars, which one is best served by the current corpus, and which is the weakest?',
  'Where is the corpus suggesting our assumptions about workforce uptake are wrong, and what should we change?',
  'Which voices are dominating the corpus, and whose perspectives are missing relative to what our pillars need?',
  'What evidence in the corpus is strong enough to put in a policy submission tomorrow, and against which pillar would it land hardest?',
  "What does the corpus suggest we should programme into next year's symposium to close the gaps in our weakest pillar?",
  'Has anything in the corpus actually been adopted into rural health practice or policy in the last 12 months — and which pillar did it advance?',
];

export function SampleNeraQuestions() {
  const { askNera, isLoading, isStreaming } = useStrategicChat();
  const { aiConfig } = useEngagement();
  const isResearchProfile = aiConfig?.profile_key === 'research-intelligence';

  // Only show for research-vertical engagements. Other profiles get a different
  // panel or none.
  if (!isResearchProfile) return null;

  const disabled = isLoading || isStreaming;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Ask Nera about your strategic pillars
        </CardTitle>
        <CardDescription>
          Strategic questions a Programme Director or board would ask. Click any to
          open Nera and have her answer from the corpus, tied back to your pillars.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {RESEARCH_PROMPTS.map((q, i) => (
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
