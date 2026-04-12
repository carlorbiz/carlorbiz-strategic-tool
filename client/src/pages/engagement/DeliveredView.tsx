import { useEngagement } from '@/contexts/EngagementContext';
import { Badge } from '@/components/ui/badge';

/**
 * Delivered view — the deliverable has been produced but the engagement
 * hasn't yet transitioned to living mode.
 * Shown when engagement.status === 'delivered'.
 *
 * The deliverable composer and the deliverable renderer will be built
 * in Phase 3. For now, this is a placeholder that shows the engagement
 * metadata and a note about the handover flow.
 */
export function EngagementDeliveredView() {
  const { engagement, isEngagementAdmin } = useEngagement();

  if (!engagement) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge variant="secondary">Delivered</Badge>
      </div>

      {engagement.client_name && (
        <p className="text-muted-foreground mb-6">{engagement.client_name}</p>
      )}

      <div className="mt-4 p-4 border rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p className="mb-2">
          This engagement has been <strong>delivered</strong>. The deliverable document
          has been produced and is ready for review.
        </p>
        {isEngagementAdmin && (
          <p>
            When the client is ready to begin using the tool independently, transition
            this engagement to <strong>living</strong> mode. This will hand over ownership
            to the client admin and open the document upload, drift-watch, and
            reporting surfaces. The handover flow will be built in Phase 3.
          </p>
        )}
      </div>
    </div>
  );
}
