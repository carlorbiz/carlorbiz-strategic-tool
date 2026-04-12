import { useEngagement } from '@/contexts/EngagementContext';
import { Badge } from '@/components/ui/badge';

/**
 * Archived view — read-only. The engagement has concluded.
 * Shown when engagement.status === 'archived'.
 *
 * This will eventually show a read-only version of the living dashboard
 * with all historical data preserved but no active surfaces.
 */
export function EngagementArchivedView() {
  const { engagement } = useEngagement();

  if (!engagement) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge variant="outline">Archived</Badge>
      </div>

      {engagement.client_name && (
        <p className="text-muted-foreground mb-6">{engagement.client_name}</p>
      )}

      <div className="mt-4 p-4 border rounded-lg bg-muted/50 text-sm text-muted-foreground">
        This engagement has been <strong>archived</strong>. All data is preserved
        as a read-only record. The archived view will mirror the living dashboard
        layout with historical data when Phase 2d is complete.
      </div>
    </div>
  );
}
