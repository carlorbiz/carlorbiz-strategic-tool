import { useEffect, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { fetchLatestDriftReport } from '@/lib/engagementApi';
import type { DriftReport } from '@/types/engagement';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MessageCircleQuestion } from 'lucide-react';

/**
 * Shows open observations from Nera's drift-watch that haven't been triaged.
 * In v1, these come from the drift report's signals array filtered to
 * items that look like questions/observations rather than hard alerts.
 *
 * In Phase 3, this will connect to the Nera conversational interface
 * so the admin can discuss a signal with Nera directly.
 */
export function NeraQuestions() {
  const { engagement } = useEngagement();
  const [report, setReport] = useState<DriftReport | null>(null);

  useEffect(() => {
    if (!engagement) return;
    fetchLatestDriftReport(engagement.id).then(setReport).catch(console.error);
  }, [engagement?.id]);

  // Extract question-like signals from the drift report
  const questions: string[] = [];
  if (report?.narrative) {
    // Simple heuristic: sentences ending with ? are questions
    const sentences = report.narrative.split(/[.!]\s+/);
    for (const s of sentences) {
      if (s.trim().endsWith('?')) {
        questions.push(s.trim());
      }
    }
  }

  // Also check signals for question-type entries
  if (Array.isArray(report?.signals)) {
    for (const sig of report.signals as Array<{ type?: string; message?: string }>) {
      if (sig.type === 'question' || sig.type === 'observation') {
        questions.push(sig.message ?? '');
      }
    }
  }

  if (questions.length === 0) {
    return null; // Don't show the widget if there are no questions
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4" />
          Questions from Nera
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {questions.map((q, idx) => (
          <div key={idx} className="text-sm p-2 rounded bg-muted/50 border-l-2 border-primary/30">
            {q}
          </div>
        ))}
        <p className="text-xs text-muted-foreground mt-2">
          These observations come from Nera's drift-watch analysis. In a future
          version you'll be able to discuss them with Nera directly.
        </p>
      </CardContent>
    </Card>
  );
}
