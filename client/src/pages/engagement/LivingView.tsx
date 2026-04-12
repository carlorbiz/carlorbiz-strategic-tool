import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * Living view — the engagement is handed over and the client is using
 * the tool independently.
 * Shown when engagement.status === 'living'.
 *
 * This is the main dashboard surface. Phase 2d will build the full
 * widget-based dashboard (priority status grid, drift signals, recent
 * documents, Nera questions, pre-read generator). For now, this renders
 * the commitment taxonomy and points at where the dashboard will live.
 */
export function EngagementLivingView() {
  const { engagement, commitments } = useEngagement();
  const v = useVocabulary();

  if (!engagement) return null;

  const priorities = commitments.filter(c => c.kind === 'top');
  const lenses = commitments.filter(c => c.kind === 'cross_cut');

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge>Living</Badge>
      </div>

      {engagement.client_name && (
        <p className="text-muted-foreground mb-6">{engagement.client_name}</p>
      )}

      {/* Priority cards — will become the full status grid in Phase 2d */}
      <h2 className="text-lg font-semibold mb-3">{v.commitment_top_plural}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {priorities.map(p => {
          const initiatives = commitments.filter(c => c.parent_id === p.id && c.kind === 'sub');
          return (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {p.description && (
                  <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                )}
                {initiatives.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {initiatives.length} {initiatives.length === 1
                      ? v.commitment_sub_singular.toLowerCase()
                      : v.commitment_sub_plural.toLowerCase()}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lenses */}
      {lenses.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">{v.cross_cut_plural}</h2>
          <div className="flex flex-wrap gap-2 mb-8">
            {lenses.map(l => (
              <Badge key={l.id} variant="outline">{l.title}</Badge>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 p-4 border rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p className="mb-2">
          This engagement is <strong>living</strong>. The full dashboard with status grid,
          drift signals, recent documents, and Nera pre-read generator will be built in Phase 2d.
        </p>
        <p>
          Document upload and the chunking pipeline will be built in Phase 2c. Once
          those are in place, documents will flow through Nera's knowledge base and
          the dashboard will populate with real-time intelligence.
        </p>
      </div>
    </div>
  );
}
