// Demonstrative "Try asking Nera" panel. Renders a short list of curated
// sample questions tailored to the research-intelligence profile. Clicking a
// chip opens the Nera sheet and dispatches the question via askNera().
//
// The questions below are written to land specifically against the Rural
// Futures Australia corpus (rural health, multidisciplinary care, telehealth,
// workforce, knowledge translation). For other research-vertical engagements
// they're generic enough to still demonstrate the pattern; specific prompts
// per engagement can be added as a separate config later.

import { useStrategicChat } from '@/contexts/StrategicChatContext';
import { useEngagement } from '@/contexts/EngagementContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';

const RESEARCH_PROMPTS = [
  'Which papers contradict each other on whether telehealth deskills rural clinicians?',
  'Who has done research on co-designed integrated care models in Cape York or northern Australia?',
  'What does the corpus say about the gaps in workforce retention strategies for allied health?',
  'Compare what Krahe et al. argue across their 2024 and 2025 papers — has their position shifted?',
  'Which authors have presented on Indigenous-led service models, and who would I invite for next year?',
  'What are the unintended consequences of digital health adoption that the corpus has flagged?',
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
          Try asking Nera
        </CardTitle>
        <CardDescription>
          Click any of these to open Nera and have her answer from the corpus.
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
