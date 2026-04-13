import { useEffect, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { fetchSurveys, triggerSurveyIngestion } from '@/lib/surveyApi';
import type { StSurvey, SurveyStatus } from '@/types/engagement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { RefreshCw, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Clock } from 'lucide-react';

const STATUS_CONFIG: Record<SurveyStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  icon: typeof FileSpreadsheet;
}> = {
  uploaded: { label: 'Queued', variant: 'outline', icon: Clock },
  ingesting: { label: 'Analysing', variant: 'secondary', icon: Loader2 },
  ingested: { label: 'Complete', variant: 'default', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: AlertTriangle },
};

interface SurveyListProps {
  refreshTrigger?: number;
}

export function SurveyList({ refreshTrigger }: SurveyListProps) {
  const { engagement } = useEngagement();
  const [surveys, setSurveys] = useState<StSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadSurveys = async () => {
    if (!engagement) return;
    setIsLoading(true);
    try {
      const data = await fetchSurveys(engagement.id, { limit: 50 });
      setSurveys(data);
    } catch (err) {
      console.error('Failed to load surveys:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, [engagement?.id, refreshTrigger]);

  // Auto-refresh every 10s if any surveys are ingesting
  useEffect(() => {
    const hasIngesting = surveys.some(s => s.status === 'ingesting');
    if (!hasIngesting) return;

    const interval = setInterval(loadSurveys, 10000);
    return () => clearInterval(interval);
  }, [surveys]);

  const handleRetry = async (surveyId: string) => {
    setRetrying(surveyId);
    try {
      await triggerSurveyIngestion(surveyId);
      toast.success('Retry triggered — survey re-queued for analysis');
      await loadSurveys();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      toast.error(msg);
    } finally {
      setRetrying(null);
    }
  };

  if (!engagement) return null;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading surveys...</p>;
  }

  if (surveys.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          No surveys uploaded yet. Upload your first survey export and
          Nera will analyse it into the knowledge base.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {surveys.length} {surveys.length === 1 ? 'survey' : 'surveys'}
        </p>
        <Button size="sm" variant="ghost" onClick={loadSurveys}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-28">Period</TableHead>
              <TableHead className="w-24">Responses</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-28">Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveys.map(survey => {
              const statusConf = STATUS_CONFIG[survey.status];
              const StatusIcon = statusConf.icon;

              return (
                <TableRow key={survey.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{survey.name}</span>
                      {survey.overall_summary && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {survey.overall_summary}
                        </p>
                      )}
                      {survey.contains_pii && (
                        <Badge variant="outline" className="text-xs mt-0.5">PII flagged</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{survey.period ?? '—'}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {survey.response_count != null ? survey.response_count : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConf.variant} className="text-xs gap-1">
                      <StatusIcon className={`w-3 h-3 ${survey.status === 'ingesting' ? 'animate-spin' : ''}`} />
                      {statusConf.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(survey.created_at).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short',
                    })}
                  </TableCell>
                  <TableCell>
                    {survey.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRetry(survey.id)}
                        disabled={retrying === survey.id}
                      >
                        {retrying === survey.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
