import { useEffect, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { fetchLatestDriftReport } from '@/lib/engagementApi';
import type { DriftReport } from '@/types/engagement';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface DriftSignal {
  type: string;
  commitment_title?: string;
  severity?: 'info' | 'warning' | 'critical';
  message: string;
}

export function DriftSignals() {
  const { engagement } = useEngagement();
  const [report, setReport] = useState<DriftReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!engagement) return;
    fetchLatestDriftReport(engagement.id)
      .then(setReport)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [engagement?.id]);

  if (isLoading) return null;

  // Parse signals from the drift report's JSONB
  const signals: DriftSignal[] = Array.isArray(report?.signals)
    ? (report.signals as DriftSignal[])
    : [];

  const merges: unknown[] = Array.isArray(report?.merge_suggestions)
    ? report.merge_suggestions
    : [];

  if (!report && signals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Drift Watch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No drift signals yet. Once documents start flowing in and the drift-watch
            agent runs, signals will appear here when Nera notices something worth
            your attention.
          </p>
        </CardContent>
      </Card>
    );
  }

  const severityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      default: return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Drift Signals</CardTitle>
          {report && (
            <span className="text-xs text-muted-foreground">
              Last checked: {new Date(report.created_at).toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short',
              })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {signals.length === 0 && report?.narrative ? (
          <p className="text-sm text-muted-foreground">{report.narrative}</p>
        ) : (
          signals.map((signal, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              {severityIcon(signal.severity)}
              <div>
                {signal.commitment_title && (
                  <Badge variant="outline" className="text-xs mr-1">{signal.commitment_title}</Badge>
                )}
                <span>{signal.message}</span>
              </div>
            </div>
          ))
        )}

        {merges.length > 0 && (
          <div className="mt-3 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">Merge suggestions</p>
            {merges.map((m: any, idx) => (
              <p key={idx} className="text-xs text-muted-foreground">{m.message ?? JSON.stringify(m)}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
