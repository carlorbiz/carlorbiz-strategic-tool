import { useEffect, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { fetchDocuments, triggerIngestion } from '@/lib/documentApi';
import type { StDocument, DocumentStatus } from '@/types/engagement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { RefreshCw, FileText, AlertTriangle, CheckCircle2, Loader2, Clock, ExternalLink } from 'lucide-react';

const STATUS_CONFIG: Record<DocumentStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  icon: typeof FileText;
}> = {
  uploaded: { label: 'Queued', variant: 'outline', icon: Clock },
  ingesting: { label: 'Processing', variant: 'secondary', icon: Loader2 },
  ingested: { label: 'Chunked', variant: 'default', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: AlertTriangle },
};

interface DocumentListProps {
  refreshTrigger?: number;
}

export function DocumentList({ refreshTrigger }: DocumentListProps) {
  const { engagement, commitments } = useEngagement();
  const v = useVocabulary();
  const [documents, setDocuments] = useState<StDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadDocuments = async () => {
    if (!engagement) return;
    setIsLoading(true);
    try {
      const docs = await fetchDocuments(engagement.id, { limit: 50 });
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [engagement?.id, refreshTrigger]);

  // Auto-refresh every 10s if any documents are in 'ingesting' state
  useEffect(() => {
    const hasIngesting = documents.some(d => d.status === 'ingesting');
    if (!hasIngesting) return;
    const interval = setInterval(loadDocuments, 10000);
    return () => clearInterval(interval);
  }, [documents]);

  const handleRetry = async (docId: string) => {
    setRetrying(docId);
    try {
      await triggerIngestion(docId);
      toast.success('Retry triggered — document re-queued for chunking');
      await loadDocuments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      toast.error(msg);
    } finally {
      setRetrying(null);
    }
  };

  const getCommitmentTitle = (commitmentId: string | null): string | null => {
    if (!commitmentId) return null;
    return commitments.find(c => c.id === commitmentId)?.title ?? null;
  };

  if (!engagement) return null;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading {v.evidence_plural.toLowerCase()}...</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          No {v.evidence_plural.toLowerCase()} uploaded yet.
          Upload your first {v.evidence_singular.toLowerCase()} and Nera will start building
          the knowledge base for this engagement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {documents.length} {documents.length === 1 ? v.evidence_singular.toLowerCase() : v.evidence_plural.toLowerCase()}
        </p>
        <Button size="sm" variant="ghost" onClick={loadDocuments}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {documents.map(doc => {
          const statusConf = STATUS_CONFIG[doc.status];
          const StatusIcon = statusConf.icon;
          const commitmentTitle = getCommitmentTitle(doc.primary_commitment_id);

          return (
            <Card key={doc.id}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{doc.title}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{doc.file_type ?? '?'}</Badge>
                    {doc.external_link && (
                      <a
                        href={doc.external_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Open source"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {(doc.authors || doc.journal || doc.publication_year) && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {[doc.authors, doc.journal, doc.publication_year].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {doc.summary && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {commitmentTitle && (
                      <span className="text-xs text-muted-foreground">{commitmentTitle}</span>
                    )}
                    {doc.chunk_count > 0 && (
                      <span className="text-xs text-muted-foreground">{doc.chunk_count} chunks</span>
                    )}
                    {doc.institution && (
                      <span className="text-xs text-muted-foreground">{doc.institution}</span>
                    )}
                    {doc.contains_pii && (
                      <Badge variant="outline" className="text-xs">PII</Badge>
                    )}
                  </div>
                </div>
                <Badge variant={statusConf.variant} className="text-xs gap-1 shrink-0">
                  <StatusIcon className={`w-3 h-3 ${doc.status === 'ingesting' ? 'animate-spin' : ''}`} />
                  {statusConf.label}
                </Badge>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(doc.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
                {doc.status === 'failed' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRetry(doc.id)}
                    disabled={retrying === doc.id}
                  >
                    {retrying === doc.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
