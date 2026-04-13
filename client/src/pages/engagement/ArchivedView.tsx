import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { Badge } from '@/components/ui/badge';
import { PriorityStatusGrid } from '@/components/engagement/dashboard/PriorityStatusGrid';
import { DriftSignals } from '@/components/engagement/dashboard/DriftSignals';
import { RecentUpdates } from '@/components/engagement/dashboard/RecentUpdates';
import { DocumentList } from '@/components/engagement/DocumentList';

/**
 * Archived view — read-only. The engagement has concluded.
 * Shows the same dashboard widgets as the living view but with
 * no upload capability and no admin tabs.
 */
export function EngagementArchivedView() {
  const { engagement } = useEngagement();
  const v = useVocabulary();

  if (!engagement) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge variant="outline">Archived</Badge>
      </div>
      {engagement.client_name && (
        <p className="text-muted-foreground mb-6">{engagement.client_name}</p>
      )}

      <div className="space-y-6">
        <PriorityStatusGrid />
        <DriftSignals />
        <RecentUpdates />
        <div>
          <h3 className="text-base font-semibold mb-2">{v.evidence_plural}</h3>
          <DocumentList />
        </div>
      </div>
    </div>
  );
}
