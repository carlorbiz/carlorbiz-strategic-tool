import { useEffect, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { fetchRecentUpdates } from '@/lib/engagementApi';
import type { InitiativeUpdate, UpdateRagStatus } from '@/types/engagement';
import { Badge } from '@/components/ui/badge';

const RAG_BADGE: Record<UpdateRagStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  on_track: { label: 'On track', variant: 'default' },
  at_risk: { label: 'At risk', variant: 'secondary' },
  blocked: { label: 'Blocked', variant: 'destructive' },
  done: { label: 'Done', variant: 'outline' },
};

export function RecentUpdates() {
  const { engagement, commitments } = useEngagement();
  const v = useVocabulary();
  const [updates, setUpdates] = useState<InitiativeUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!engagement) return;
    fetchRecentUpdates(engagement.id, 15)
      .then(setUpdates)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [engagement?.id]);

  if (isLoading) return null;

  const getCommitmentTitle = (id: string) =>
    commitments.find(c => c.id === id)?.title ?? 'Unknown';

  if (updates.length === 0) {
    return (
      <div>
        <h3 className="text-base font-semibold mb-2">Recent Updates</h3>
        <p className="text-sm text-muted-foreground">
          No updates yet. Updates appear here when someone uses the conversational
          update mode, or when initiative statuses change.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-base font-semibold mb-2">Recent Updates</h3>
      <div className="space-y-2">
        {updates.map(u => {
          const ragConf = RAG_BADGE[u.rag_status];
          return (
            <div key={u.id} className="flex items-start gap-3 p-2 text-sm border-b last:border-b-0">
              <Badge variant={ragConf.variant} className="text-xs shrink-0 mt-0.5">
                {ragConf.label}
              </Badge>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-xs">{getCommitmentTitle(u.commitment_id)}</span>
                <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{u.narrative}</p>
              </div>
              <time className="text-xs text-muted-foreground shrink-0">
                {new Date(u.created_at).toLocaleDateString('en-AU', {
                  day: 'numeric', month: 'short',
                })}
              </time>
            </div>
          );
        })}
      </div>
    </div>
  );
}
