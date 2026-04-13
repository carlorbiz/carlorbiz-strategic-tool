import { useEffect, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { fetchChangeLog, type ChangeLogEntry } from '@/lib/commitmentApi';
import { Badge } from '@/components/ui/badge';

const CHANGE_TYPE_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  commitment_created: { label: 'Created', variant: 'default' },
  commitment_modified: { label: 'Modified', variant: 'secondary' },
  commitment_archived: { label: 'Archived', variant: 'outline' },
  commitment_merged: { label: 'Merged', variant: 'secondary' },
  scope_extended: { label: 'Scope extended', variant: 'secondary' },
  scope_narrowed: { label: 'Scope narrowed', variant: 'outline' },
  strictness_changed: { label: 'Strictness changed', variant: 'outline' },
  count_cap_overridden: { label: 'Cap overridden', variant: 'destructive' },
};

export function CommitmentChangeLog() {
  const { engagement } = useEngagement();
  const [entries, setEntries] = useState<ChangeLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!engagement) return;
    fetchChangeLog(engagement.id)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [engagement?.id]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading change log...</p>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(entry => {
        const meta = CHANGE_TYPE_LABELS[entry.change_type] ?? { label: entry.change_type, variant: 'outline' as const };
        return (
          <div key={entry.id} className="flex items-start gap-3 p-2 text-sm border-b last:border-b-0">
            <Badge variant={meta.variant} className="text-xs shrink-0 mt-0.5">
              {meta.label}
            </Badge>
            <div className="flex-1 min-w-0">
              {entry.commitment?.title && (
                <span className="font-medium">{entry.commitment.title}</span>
              )}
              {entry.reason_narrative && (
                <p className="text-muted-foreground text-xs mt-0.5">{entry.reason_narrative}</p>
              )}
            </div>
            <time className="text-xs text-muted-foreground shrink-0">
              {new Date(entry.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </time>
          </div>
        );
      })}
    </div>
  );
}
