import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * Draft view — admin-only setup surface.
 * Shown when engagement.status === 'draft'.
 * This is where the consultant sets up the taxonomy, stages, roles, and config
 * before opening the engagement to participants.
 *
 * Phase 2b will build the full admin surfaces here (commitment editor, stage
 * editor, role manager, vocabulary editor). For now, this is a structural stub
 * that renders the engagement metadata and commitment tree read-only.
 */
export function EngagementDraftView() {
  const { engagement, stages, commitments, isEngagementAdmin } = useEngagement();
  const v = useVocabulary();

  if (!engagement) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge variant="outline">Draft</Badge>
      </div>

      {engagement.client_name && (
        <p className="text-muted-foreground mb-6">{engagement.client_name}</p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{v.commitment_top_plural}</CardTitle>
          </CardHeader>
          <CardContent>
            {commitments.filter(c => c.kind === 'top').length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {v.commitment_top_plural.toLowerCase()} defined yet.
                {isEngagementAdmin && ' Open the editor to add them.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {commitments.filter(c => c.kind === 'top').map(c => (
                  <li key={c.id} className="text-sm">
                    <span className="font-medium">{c.title}</span>
                    {c.description && (
                      <p className="text-muted-foreground text-xs mt-0.5">{c.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stages</CardTitle>
          </CardHeader>
          <CardContent>
            {stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No stages defined yet.
                {isEngagementAdmin && ' Open the editor to add them.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {stages.map(s => (
                  <li key={s.id} className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{s.stage_type}</Badge>
                    <span>{s.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 p-4 border rounded-lg bg-muted/50 text-sm text-muted-foreground">
        This engagement is in <strong>draft</strong> mode. The {v.commitment_top_plural.toLowerCase()} editor, stage editor,
        and role manager will be built in Phase 2b. For now, use the demo seed SQL
        to populate the engagement with sample data.
      </div>
    </div>
  );
}
