import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * Active view — the engagement is in progress.
 * Shown when engagement.status === 'active'.
 * Participants see the stage list and can enter open stages.
 * Admins see the full admin panel plus the stage list.
 *
 * Phase 2b will build the participation surfaces (Nera interviews,
 * workshop facilitation, photo upload). For now, this renders the
 * stage list with status badges.
 */
export function EngagementActiveView() {
  const { engagement, stages, commitments } = useEngagement();
  const v = useVocabulary();

  if (!engagement) return null;

  const openStages = stages.filter(s => s.status === 'open');
  const closedStages = stages.filter(s => s.status === 'closed');

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge>Active</Badge>
      </div>

      {openStages.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Open stages</h2>
          <div className="grid gap-3">
            {openStages.map(s => (
              <Card key={s.id} className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">{s.stage_type}</Badge>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                  </div>
                </CardHeader>
                {s.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {closedStages.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Completed stages</h2>
          <div className="grid gap-2">
            {closedStages.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">{s.stage_type}</Badge>
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 border rounded-lg bg-muted/50 text-sm text-muted-foreground">
        This engagement is <strong>active</strong>. Stage participation surfaces (Nera interviews,
        workshop facilitation, photo upload) will be built in Phase 2b.
      </div>
    </div>
  );
}
